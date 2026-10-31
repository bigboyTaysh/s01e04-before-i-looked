import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DigestRow, JobStatus, NightDigest } from './types.js';

type Event = {
  at: string;
  job: string;
  status: JobStatus;
  owner: string | null;
  error: string | null;
};

const STATUSES: ReadonlySet<string> = new Set(['ok', 'retry', 'fail']);

function isJobStatus(value: unknown): value is JobStatus {
  return typeof value === 'string' && STATUSES.has(value);
}

function parseLine(line: string): Event | null {
  let value: unknown;
  try {
    value = JSON.parse(line);
  } catch {
    return null;
  }
  if (typeof value !== 'object' || value === null) return null;
  const record = value as Record<string, unknown>;
  if (typeof record.at !== 'string' || typeof record.job !== 'string') return null;
  if (!isJobStatus(record.status)) return null;
  if (record.owner !== undefined && record.owner !== null && typeof record.owner !== 'string') return null;
  return {
    at: record.at,
    job: record.job,
    status: record.status,
    owner: typeof record.owner === 'string' ? record.owner : null,
    error: typeof record.error === 'string' ? record.error : null,
  };
}

export function readNight(runsDir: string, night: string): NightDigest {
  const text = readFileSync(join(runsDir, `${night}.jsonl`), 'utf8');
  let badLines = 0;
  const groups = new Map<string, Event[]>();

  for (const line of text.split('\n')) {
    if (line.trim() === '') continue;
    const event = parseLine(line);
    if (!event) {
      badLines += 1;
      continue;
    }
    const list = groups.get(event.job);
    if (list) list.push(event);
    else groups.set(event.job, [event]);
  }

  const rows: DigestRow[] = [];
  for (const [job, events] of groups) {
    const ordered = [...events].sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
    const first = ordered[0];
    const last = ordered[ordered.length - 1];
    if (!first || !last) continue;
    rows.push({
      job,
      owner: last.owner,
      runs: ordered.length,
      retries: ordered.filter((event) => event.status === 'retry').length,
      lastStatus: last.status,
      lastError: last.error,
      firstAt: first.at,
      lastAt: last.at,
    });
  }

  rows.sort((a, b) => (a.job < b.job ? -1 : a.job > b.job ? 1 : 0));
  return { rows, badLines };
}
