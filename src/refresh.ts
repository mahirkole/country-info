import type pg from 'pg';
import type { EntityInput } from './model.js';
import { ChangeGuardError, DeleteGuardError, ingest } from './ingest.js';
import { fetchPolicy, recordFetches } from './sources/fetch.js';
import { join } from 'node:path';
import { recordSuccessors } from './successors.js';
import { createReleaseNote } from './release-notes.js';
import { syncTargetMetadata, type Cadence, type RefreshTarget } from './targets.js';

export type RunStatus = 'unchanged' | 'success' | 'needs_review' | 'failed' | 'skipped';
export interface RunResult {
  source: string;
  status: RunStatus;
  detail?: string;
  rows?: number;
  inserted?: number;
  updated?: number;
  deleted?: number;
  /** Snapshot created by this run (status success). */
  snapshot?: number;
}
export interface RefreshOptions {
  cacheDir: string;
  /** Run even if the raw inputs are unchanged. */
  force?: boolean;
  /** Download and validate, write nothing. */
  dryRun?: boolean;
}

const DAY = 24 * 3600 * 1000;
export const CADENCE_MS: Record<Cadence, number | null> = { daily: DAY, weekly: 7 * DAY, monthly: 30 * DAY, annual: 365 * DAY, event: null };
const nextDue = (c: Cadence, from = new Date()) => (CADENCE_MS[c] === null ? null : new Date(from.getTime() + CADENCE_MS[c]!));

/** Parents that are neither in the batch nor a country record: the hierarchy of this source is broken. */
export function orphanParents(input: EntityInput[]): string[] {
  const ids = new Set(input.map((e) => e.id));
  return [...new Set(input.filter((e) => e.parent_id && !e.parent_id.startsWith('country:') && !ids.has(e.parent_id)).map((e) => e.parent_id!))];
}

/**
 * `orphanParents` minus parents that already exist in the database. A source may legitimately hang records under another source's
 * units (regional holidays under `div:FR:dep-57` of nat-fr); only a parent that exists nowhere means the hierarchy is broken.
 */
export async function missingParents(pool: pg.Pool, input: EntityInput[]): Promise<string[]> {
  const orphans = orphanParents(input);
  if (orphans.length === 0) return [];
  const known = new Set((await pool.query('SELECT id FROM entities WHERE id = ANY($1)', [orphans])).rows.map((r) => r.id as string));
  return orphans.filter((id) => !known.has(id));
}

export async function runRefresh(pool: pg.Pool, t: RefreshTarget, o: RefreshOptions): Promise<RunResult> {
  const id = t.meta.id;
  await syncTargetMetadata(pool, [t]);
  const lock = await pool.connect(); // session-level advisory lock: one run per source at a time
  try {
    const got = (await lock.query("SELECT pg_try_advisory_lock(hashtext('refresh:' || $1)) AS ok", [id])).rows[0].ok;
    if (!got) return { source: id, status: 'skipped', detail: 'another run holds the lock' };
    try {
      return await run(pool, t, o);
    } finally {
      await lock.query("SELECT pg_advisory_unlock(hashtext('refresh:' || $1))", [id]);
    }
  } finally {
    lock.release();
  }
}

async function run(pool: pg.Pool, t: RefreshTarget, o: RefreshOptions): Promise<RunResult> {
  const id = t.meta.id;
  const src = (await pool.query('SELECT status, content_sha256, version FROM sources WHERE id = $1', [id])).rows[0];
  const record = async (r: RunResult, extra: { raw?: string; snapshot?: number } = {}) => {
    if (o.dryRun) return r;
    await pool.query(
      `INSERT INTO source_runs (source_id, finished_at, status, rows, inserted, updated, deleted, raw_sha256, snapshot_id, detail)
       VALUES ($1, now(), $2, $3, $4, $5, $6, $7, $8, $9)`,
      [id, r.status, r.rows ?? null, r.inserted ?? null, r.updated ?? null, r.deleted ?? null, extra.raw ?? null, extra.snapshot ?? null, r.detail ?? null],
    );
    return r;
  };
  const setStatus = async (status: string, due = true) => {
    if (o.dryRun) return;
    await pool.query('UPDATE sources SET status = $2, last_checked_at = now(), next_due_at = $3 WHERE id = $1', [id, status, due ? nextDue(t.cadence) : new Date(Date.now() + 3600_000)]);
  };

  if (src.status === 'license_changed') {
    return record({ source: id, status: 'skipped', detail: 'license page changed since the last review; run license:ack after reading it' });
  }

  const stop = recordFetches();
  const prevMaxAge = fetchPolicy.maxAgeMs;
  const prevArchive = fetchPolicy.archiveDir;
  fetchPolicy.maxAgeMs = 0; // always look at the publisher's current data (a conditional GET makes that cheap)
  fetchPolicy.archiveDir = join(o.cacheDir, 'raw'); // content-addressed copy of every body this run read
  let input: EntityInput[];
  let raw: string;
  try {
    input = await t.load(o.cacheDir, { pool, dryRun: o.dryRun });
  } catch (e) {
    stop();
    await setStatus('failed', false);
    return record({ source: id, status: 'failed', detail: (e as Error).message });
  } finally {
    fetchPolicy.maxAgeMs = prevMaxAge;
    fetchPolicy.archiveDir = prevArchive;
  }
  raw = stop();

  if (!o.force && src.content_sha256 === raw && src.status === 'ok') {
    await setStatus('ok');
    return record({ source: id, status: 'unchanged', rows: input.length, detail: 'raw inputs identical to the last successful run' }, { raw });
  }

  const [min, max] = t.expectedRows;
  const orphans = await missingParents(pool, input);
  const problem =
    input.length < min || input.length > max
      ? `${input.length} records outside the expected band [${min}, ${max}]`
      : orphans.length
        ? `${orphans.length} parents missing from the batch, e.g. ${orphans.slice(0, 3).join(', ')}`
        : null;
  if (problem) {
    await setStatus('needs_review');
    return record({ source: id, status: 'needs_review', rows: input.length, detail: problem }, { raw });
  }
  if (o.dryRun) return { source: id, status: 'success', rows: input.length, detail: 'dry run: valid, nothing written' };

  const vintageChanged = !!src.version && !!t.meta.version && src.version !== t.meta.version;
  try {
    const r = await ingest(pool, t.meta, input, {
      ...t.scope,
      maxDeleteRatio: vintageChanged ? 0.3 : 0.05,
      maxChangeRatio: vintageChanged ? 1 : 0.5,
      reason: vintageChanged ? `vintage_change: ${src.version} -> ${t.meta.version}` : undefined,
    });
    const changed = r.inserted + r.updated + r.deleted > 0;
    // Renames/mergers show up as delete + insert; queue "replaced by" suggestions for review (never applied automatically).
    let successors = 0;
    if (r.deleted > 0 && r.inserted > 0) successors = await recordSuccessors(pool, r.snapshotId, id).catch(() => 0);
    await pool.query(
      `UPDATE sources SET status = 'ok', content_sha256 = $2, last_checked_at = now(), last_changed_at = CASE WHEN $3 THEN now() ELSE last_changed_at END, next_due_at = $4 WHERE id = $1`,
      [id, raw, changed, nextDue(t.cadence)],
    );
    const detail = [vintageChanged ? `vintage ${src.version} -> ${t.meta.version}` : '', successors ? `${successors} successor suggestions queued` : ''].filter(Boolean).join('; ');
    // Human-readable release note and `release.published` webhooks; a failure here must not undo the applied update.
    if (changed) await createReleaseNote(pool, r.snapshotId, { detail: successors ? detail : undefined }).catch((e) => console.error('release note:', (e as Error).message));
    return record({ source: id, status: 'success', snapshot: r.snapshotId, rows: input.length, inserted: r.inserted, updated: r.updated, deleted: r.deleted, detail: detail || undefined }, { raw, snapshot: r.snapshotId });
  } catch (e) {
    if (e instanceof DeleteGuardError || e instanceof ChangeGuardError) {
      await setStatus('needs_review');
      return record({ source: id, status: 'needs_review', rows: input.length, detail: e.message }, { raw });
    }
    await setStatus('failed', false);
    return record({ source: id, status: 'failed', detail: (e as Error).message }, { raw });
  }
}

/** Sources whose next_due_at has passed (or that never ran / last failed). */
export async function dueSourceIds(pool: pg.Pool, targets: RefreshTarget[]): Promise<string[]> {
  const rows = (await pool.query("SELECT id FROM sources WHERE next_due_at IS NULL OR next_due_at <= now() OR status = 'failed'")).rows.map((r) => r.id as string);
  const due = new Set(rows);
  const known = new Set((await pool.query('SELECT id FROM sources WHERE content_sha256 IS NOT NULL')).rows.map((r) => r.id as string));
  return targets.map((t) => t.meta.id).filter((id) => due.has(id) || !known.has(id));
}
