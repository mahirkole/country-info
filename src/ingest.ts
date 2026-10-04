import { createHash } from 'node:crypto';
import type pg from 'pg';
import type { EntityInput, SourceMeta } from './model.js';
import { enqueueDeliveries } from './webhooks.js';

export interface IngestResult {
  snapshotId: number;
  fromSeq: number;
  toSeq: number;
  inserted: number;
  updated: number;
  deleted: number;
  unchanged: number;
}

const CHUNK = 2000;
const ADVISORY_LOCK = 727001;

/** Key-sorted JSON so equal content always hashes equal. */
export function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o).sort().map((k) => `${JSON.stringify(k)}:${canonical(o[k])}`).join(',')}}`;
  }
  return JSON.stringify(v) ?? 'null';
}

type Fields = Omit<EntityInput, 'id'>;
const FIELDS: (keyof Fields)[] = ['kind', 'parent_id', 'country_code', 'code', 'name', 'name_ascii', 'lat', 'lon', 'data'];

const fieldsOf = (e: EntityInput | Record<string, unknown>): Fields =>
  Object.fromEntries(FIELDS.map((k) => [k, (e as Record<string, unknown>)[k] ?? null])) as unknown as Fields;
export const hashOf = (e: EntityInput | Record<string, unknown>): string =>
  createHash('sha256').update(canonical(fieldsOf(e))).digest('hex');

/** Names of top-level fields, plus `data.<key>` for nested attribute changes. */
export function changedFields(before: Fields, after: Fields): string[] {
  const out: string[] = [];
  for (const k of FIELDS) {
    if (k === 'data') {
      const b = before.data ?? {};
      const a = after.data ?? {};
      for (const dk of new Set([...Object.keys(b), ...Object.keys(a)])) {
        if (canonical(b[dk]) !== canonical(a[dk])) out.push(`data.${dk}`);
      }
    } else if (canonical(before[k]) !== canonical(after[k])) out.push(k);
  }
  return out;
}

function* chunks<T>(xs: T[], n = CHUNK): Generator<T[]> {
  for (let i = 0; i < xs.length; i += n) yield xs.slice(i, i + n);
}

export interface IngestScope {
  kinds: string[];
  /** Limit deletion to these countries; omit when the input covers every country the source owns. */
  countries?: string[];
  /**
   * Abort (roll back) if more than this share of the source's existing records would be deleted.
   * Guards against a truncated or broken download wiping the dataset. Default 0.05; only applies
   * when at least MIN_FOR_DELETE_GUARD records exist. Pass 1 to allow any deletion.
   */
  maxDeleteRatio?: number;
}

export const MIN_FOR_DELETE_GUARD = 100;
export class DeleteGuardError extends Error {}

/**
 * Reconcile the database with `input`. Only entities owned by `source`, of the
 * scope's kinds (and countries, if given), that are absent from `input` are
 * deleted, so independent sources never remove each other's records. Everything
 * happens in one transaction and produces one snapshot plus an ordered change log.
 */
export async function ingest(pool: pg.Pool, source: SourceMeta, input: EntityInput[], scope: IngestScope): Promise<IngestResult> {
  const { kinds, countries, maxDeleteRatio = 0.05 } = scope;
  const ids = new Set<string>();
  for (const e of input) {
    if (ids.has(e.id)) throw new Error(`duplicate entity id in source: ${e.id}`);
    ids.add(e.id);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock($1)', [ADVISORY_LOCK]);

    await client.query(
      `INSERT INTO sources (id, authority, url, license, version, retrieved_at) VALUES ($1, $2, $3, $4, $5, now())
       ON CONFLICT (id) DO UPDATE SET authority = EXCLUDED.authority, url = EXCLUDED.url, license = EXCLUDED.license,
         version = EXCLUDED.version, retrieved_at = now()`,
      [source.id, source.authority, source.url ?? null, source.license ?? null, source.version ?? null],
    );

    const existing = new Map<string, { hash: string; kind: string }>();
    for (const r of (
      await client.query(
        'SELECT id, kind, content_hash FROM entities WHERE source_id = $1 AND kind = ANY($2) AND ($3::text[] IS NULL OR country_code = ANY($3))',
        [source.id, kinds, countries ?? null],
      )
    ).rows) {
      existing.set(r.id, { hash: r.content_hash, kind: r.kind });
    }
    const hashes = new Map(input.map((e) => [e.id, hashOf(e)]));

    const inserts = input.filter((e) => !existing.has(e.id)).sort((a, b) => a.id.localeCompare(b.id));
    const updates = input.filter((e) => existing.has(e.id) && existing.get(e.id)!.hash !== hashes.get(e.id)).sort((a, b) => a.id.localeCompare(b.id));
    const deleteIds = [...existing.keys()].filter((id) => !ids.has(id)).sort();
    const unchanged = input.length - inserts.length - updates.length;
    if (existing.size >= MIN_FOR_DELETE_GUARD && deleteIds.length / existing.size > maxDeleteRatio) {
      throw new DeleteGuardError(
        `source ${source.id}: refusing to delete ${deleteIds.length} of ${existing.size} records (> ${maxDeleteRatio * 100}%); source data looks incomplete. Re-run with maxDeleteRatio if intended.`,
      );
    }

    // Ids not owned by this source in scope but already present belong to someone else: refuse to take them over.
    for (const part of chunks(inserts.map((e) => e.id))) {
      const clash = (await client.query('SELECT id, source_id FROM entities WHERE id = ANY($1)', [part])).rows[0];
      if (clash) throw new Error(`entity ${clash.id} already exists (source ${clash.source_id}); source ${source.id} cannot claim it`);
    }

    const fromSeq = Number((await client.query('SELECT COALESCE(max(seq), 0) AS s FROM changes')).rows[0].s);
    const snap = (
      await client.query(
        'INSERT INTO snapshots (source, from_seq, to_seq) VALUES ($1, $2, $2) RETURNING id',
        [source.id, fromSeq],
      )
    ).rows[0];
    const snapshotId = Number(snap.id);

    // Previous full rows for updates and deletes, for the change log.
    const before = new Map<string, Record<string, unknown>>();
    for (const part of chunks([...updates.map((e) => e.id), ...deleteIds])) {
      const r = await client.query(
        'SELECT id, kind, parent_id, country_code::text AS country_code, code, name, name_ascii, lat, lon, data FROM entities WHERE id = ANY($1)',
        [part],
      );
      for (const row of r.rows) before.set(row.id, row);
    }

    type Change = { entity: EntityInput | null; id: string; op: 'insert' | 'update' | 'delete'; fields: string[]; before: unknown; after: unknown };
    const changes: Change[] = [
      ...inserts.map((e): Change => ({ entity: e, id: e.id, op: 'insert', fields: [], before: null, after: e })),
      ...updates.map((e): Change => {
        const b = before.get(e.id)!;
        return { entity: e, id: e.id, op: 'update', fields: changedFields(fieldsOf(b), fieldsOf(e)), before: b, after: e };
      }),
      ...deleteIds.map((id): Change => ({ entity: null, id, op: 'delete', fields: [], before: before.get(id), after: null })),
    ];

    let toSeq = fromSeq;
    if (changes.length > 0) {
      const seqs = (await client.query('SELECT nextval(\'change_seq\') AS s FROM generate_series(1, $1)', [changes.length])).rows.map((r) => Number(r.s));
      changes.forEach((c, i) => ((c as Change & { seq: number }).seq = seqs[i]!));
      toSeq = seqs[seqs.length - 1]!;

      // Upserts first, then deletes; FK to parent is deferred to commit.
      for (const part of chunks(changes.filter((c) => c.entity) as (Change & { seq: number })[])) {
        const recs = part.map((c) => ({ ...c.entity!, content_hash: hashes.get(c.id)!, updated_seq: c.seq, source_id: source.id }));
        await client.query(
          `INSERT INTO entities (id, kind, parent_id, country_code, code, name, name_ascii, lat, lon, data, content_hash, updated_seq, source_id)
           SELECT id, kind, parent_id, country_code, code, name, name_ascii, lat, lon, COALESCE(data, '{}'::jsonb), content_hash, updated_seq, source_id
           FROM jsonb_to_recordset($1::jsonb) AS r(id text, kind text, parent_id text, country_code text, code text, name text,
             name_ascii text, lat float8, lon float8, data jsonb, content_hash text, updated_seq bigint, source_id text)
           ON CONFLICT (id) DO UPDATE SET kind = EXCLUDED.kind, parent_id = EXCLUDED.parent_id, country_code = EXCLUDED.country_code,
             code = EXCLUDED.code, name = EXCLUDED.name, name_ascii = EXCLUDED.name_ascii, lat = EXCLUDED.lat, lon = EXCLUDED.lon,
             data = EXCLUDED.data, content_hash = EXCLUDED.content_hash, updated_seq = EXCLUDED.updated_seq, updated_at = now()`,
          [JSON.stringify(recs)],
        );
      }
      for (const part of chunks(deleteIds)) await client.query('DELETE FROM entities WHERE id = ANY($1)', [part]);

      for (const part of chunks(changes as (Change & { seq: number })[])) {
        const recs = part.map((c) => {
          const row = (c.after ?? c.before) as { kind: string; country_code: string };
          return {
            seq: c.seq, snapshot_id: snapshotId, entity_id: c.id, kind: row.kind, country_code: row.country_code,
            op: c.op, changed_fields: c.fields, before: c.before, after: c.after,
          };
        });
        await client.query(
          `INSERT INTO changes (seq, snapshot_id, entity_id, kind, country_code, op, changed_fields, before, after)
           SELECT seq, snapshot_id, entity_id, kind, country_code, op, changed_fields, before, after
           FROM jsonb_to_recordset($1::jsonb) AS r(seq bigint, snapshot_id bigint, entity_id text, kind text, country_code text,
             op text, changed_fields text[], before jsonb, after jsonb)`,
          [JSON.stringify(recs)],
        );
      }
    }

    await client.query(
      'UPDATE snapshots SET finished_at = now(), to_seq = $2, inserted = $3, updated = $4, deleted = $5, unchanged = $6 WHERE id = $1',
      [snapshotId, toSeq, inserts.length, updates.length, deleteIds.length, unchanged],
    );
    if (changes.length > 0) await enqueueDeliveries(client, snapshotId);
    await client.query('COMMIT');
    return { snapshotId, fromSeq, toSeq, inserted: inserts.length, updated: updates.length, deleted: deleteIds.length, unchanged };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}
