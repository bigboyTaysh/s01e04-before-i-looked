import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { RigConfig } from '../src/config.js';

function appIn(dir: string) {
  const config: RigConfig = {
    adapter: 'shim',
    installed: '2026-10-29T14:06:00+01:00',
    beatEverySeconds: 60,
    runsDir: dir,
  };
  return createApp(config);
}

const goodLine =
  '{"at":"2026-10-03T01:00:00+01:00","job":"lane/sync","status":"ok","owner":"rook"}\n';

describe('digest routes', () => {
  it('returns 200 for the page and the JSON', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'rig-routes-'));
    writeFileSync(join(dir, '2026-10-03.jsonl'), goodLine);
    const app = appIn(dir);

    const page = await app.request('/digest/2026-10-03');
    const html = await page.text();
    expect(page.status).toBe(200);
    expect(html).toContain('lane/sync');
    expect(html).toContain('rook');

    const json = await app.request('/api/digest/2026-10-03');
    expect(json.status).toBe(200);
    expect(await json.json()).toEqual([
      {
        job: 'lane/sync',
        owner: 'rook',
        runs: 1,
        retries: 0,
        lastStatus: 'ok',
        lastError: null,
        firstAt: '2026-10-03T01:00:00+01:00',
        lastAt: '2026-10-03T01:00:00+01:00',
      },
    ]);
  });

  it('returns 404 when the night file is missing', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'rig-routes-'));
    const app = appIn(dir);

    const page = await app.request('/digest/1999-01-01');
    expect(page.status).toBe(404);
    expect(await page.text()).toBe('not found');

    const json = await app.request('/api/digest/1999-01-01');
    expect(json.status).toBe(404);
    expect(await json.json()).toEqual({ error: 'not found' });
  });

  it('renders an empty night', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'rig-routes-'));
    writeFileSync(join(dir, '2026-10-04.jsonl'), '');
    const app = appIn(dir);

    const page = await app.request('/digest/2026-10-04');
    const html = await page.text();
    expect(page.status).toBe(200);
    expect(html).toContain('nothing ran');

    const json = await app.request('/api/digest/2026-10-04');
    expect(json.status).toBe(200);
    expect(await json.json()).toEqual([]);
  });

  it('renders a night that has a bad line', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'rig-routes-'));
    writeFileSync(join(dir, '2026-10-05.jsonl'), `${goodLine}not json\n`);
    const app = appIn(dir);

    const page = await app.request('/digest/2026-10-05');
    const html = await page.text();
    expect(page.status).toBe(200);
    expect(html).toContain('lane/sync');
    expect(html).not.toContain('not json');

    const json = await app.request('/api/digest/2026-10-05');
    expect(json.status).toBe(200);
    const rows = await json.json();
    expect(rows).toEqual([
      {
        job: 'lane/sync',
        owner: 'rook',
        runs: 1,
        retries: 0,
        lastStatus: 'ok',
        lastError: null,
        firstAt: '2026-10-03T01:00:00+01:00',
        lastAt: '2026-10-03T01:00:00+01:00',
      },
    ]);
  });
});
