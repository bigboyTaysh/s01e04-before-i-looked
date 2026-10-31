import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/types.js';

const night = {
  rows: [
    {
      job: 'digest/render',
      owner: null,
      runs: 1,
      retries: 0,
      lastStatus: 'ok',
      lastError: null,
      firstAt: '2026-10-29T05:41:09+01:00',
      lastAt: '2026-10-29T05:41:09+01:00',
    },
    {
      job: 'fixtures/refresh',
      owner: 'rook',
      runs: 4,
      retries: 3,
      lastStatus: 'ok',
      lastError: null,
      firstAt: '2026-10-29T01:30:00+01:00',
      lastAt: '2026-10-29T01:37:00+01:00',
    },
    {
      job: 'lane/sync',
      owner: 'rook',
      runs: 8,
      retries: 1,
      lastStatus: 'ok',
      lastError: null,
      firstAt: '2026-10-28T23:00:06+01:00',
      lastAt: '2026-10-29T05:00:04+01:00',
    },
    {
      job: 'notes/backup',
      owner: 'lane-07',
      runs: 1,
      retries: 0,
      lastStatus: 'fail',
      lastError: 'quota exceeded',
      firstAt: '2026-10-29T04:00:01+01:00',
      lastAt: '2026-10-29T04:00:01+01:00',
    },
    {
      job: 'rig/rotate-logs',
      owner: 'lane-07',
      runs: 1,
      retries: 0,
      lastStatus: 'ok',
      lastError: null,
      firstAt: '2026-10-28T23:00:02+01:00',
      lastAt: '2026-10-28T23:00:02+01:00',
    },
  ],
  badLines: 1,
};

describe('readNight', () => {
  it('reads runs/2026-10-28.jsonl into 5 jobs and 1 bad line', () => {
    expect(readNight('runs', '2026-10-28')).toEqual(night);
  });

  it('throws ENOENT when the night file is missing', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rig-digest-'));
    expect(() => readNight(dir, '1999-01-01')).toThrow(
      expect.objectContaining({ code: 'ENOENT' }),
    );
  });

  it('returns no rows for an empty file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rig-digest-'));
    writeFileSync(join(dir, '2026-10-01.jsonl'), '');
    expect(readNight(dir, '2026-10-01')).toEqual({ rows: [], badLines: 0 });
  });

  it('counts a bad line and keeps the good one', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rig-digest-'));
    writeFileSync(
      join(dir, '2026-10-02.jsonl'),
      '{"at":"2026-10-02T00:00:00+01:00","job":"a","status":"ok","owner":"x"}\nnot json\n',
    );
    expect(readNight(dir, '2026-10-02')).toEqual({
      badLines: 1,
      rows: [
        {
          job: 'a',
          owner: 'x',
          runs: 1,
          retries: 0,
          lastStatus: 'ok',
          lastError: null,
          firstAt: '2026-10-02T00:00:00+01:00',
          lastAt: '2026-10-02T00:00:00+01:00',
        },
      ],
    });
  });
});
