import { Hono } from 'hono';
import { loadConfig, type RigConfig } from './config.js';
import { readNight, type NightDigest } from './digest/types.js';
import { lane } from './lane.js';
import { readStatus } from './status.js';
import { DigestPage } from './views/digest.js';
import { Layout } from './views/layout.js';
import { StatusBoard } from './views/status.js';

function nightDigest(runsDir: string, night: string): NightDigest | undefined {
  try {
    return readNight(runsDir, night);
  } catch (err) {
    if (typeof err === 'object' && err !== null && 'code' in err && err.code === 'ENOENT') return undefined;
    throw err;
  }
}

export function createApp(config: RigConfig = loadConfig()) {
  const app = new Hono();

  app.get('/health', (c) => c.json({ ok: true, lane: lane().id }));

  app.get('/', (c) => {
    const status = readStatus(config);
    const nights = status.nights.map((night) => {
      const rows = readNight(config.runsDir, night).rows;
      return {
        night,
        ok: rows.filter((row) => row.lastStatus === 'ok').length,
        retry: rows.filter((row) => row.lastStatus === 'retry').length,
        fail: rows.filter((row) => row.lastStatus === 'fail').length,
      };
    });
    return c.html(
      <Layout title="status" lane={lane()}>
        <StatusBoard status={status} nights={nights} />
      </Layout>,
    );
  });

  app.get('/digest/:night', (c) => {
    const night = c.req.param('night');
    const digest = nightDigest(config.runsDir, night);
    if (!digest) return c.text('not found', 404);
    return c.html(
      <Layout title={`digest ${night}`} lane={lane()}>
        <DigestPage night={night} digest={digest} />
      </Layout>,
    );
  });

  app.get('/api/digest/:night', (c) => {
    const digest = nightDigest(config.runsDir, c.req.param('night'));
    if (!digest) return c.json({ error: 'not found' }, 404);
    return c.json(digest.rows);
  });

  return app;
}
