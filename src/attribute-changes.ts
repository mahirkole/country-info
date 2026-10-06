import type pg from 'pg';
import { ADVISORY_LOCK } from './ingest.js';
import { enqueueDeliveries } from './webhooks.js';

/** Content with sorted keys, so equal content compares equal whatever the key order. */
export const canon = (v: unknown): string => JSON.stringify(v, (_k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.entries(x as object).sort(([a], [b]) => a.localeCompare(b))) : x));

export interface AttrRow { code: string; grp: string; data: unknown }
export interface AttrChange { code: string; op: 'insert' | 'update' | 'delete'; groups: string[]; before: Record<string, unknown>; after: Record<string, unknown> }

/** Per country: the attribute groups that were added, changed or removed between two loads (empty when nothing was stored before: first load). */
export function attributeChanges(old: AttrRow[], next: AttrRow[]): AttrChange[] {
  if (old.length === 0) return [];
  const byCountry = (rows: AttrRow[]) => {
    const m = new Map<string, Map<string, unknown>>();
    for (const r of rows) (m.get(r.code) ?? m.set(r.code, new Map()).get(r.code)!).set(r.grp, r.data);
    return m;
  };
  const o = byCountry(old);
  const n = byCountry(next);
  const out: AttrChange[] = [];
  for (const code of [...new Set([...o.keys(), ...n.keys()])].sort()) {
    const ob = o.get(code) ?? new Map<string, unknown>();
    const nb = n.get(code) ?? new Map<string, unknown>();
    const groups = [...new Set([...ob.keys(), ...nb.keys()])].filter((g) => canon(ob.get(g)) !== canon(nb.get(g))).sort();
    if (!groups.length) continue;
    out.push({
      code, groups,
      op: ob.size === 0 ? 'insert' : nb.size === 0 ? 'delete' : 'update',
      before: Object.fromEntries(groups.filter((g) => ob.has(g)).map((g) => [g, ob.get(g)])),
      after: Object.fromEntries(groups.filter((g) => nb.has(g)).map((g) => [g, nb.get(g)])),
    });
  }
  return out;
}

/**
 * Record attribute changes in the change feed: one snapshot of `source` and one change per country (kind `attributes`, entity id
 * `country:<CC>`, `changed_fields` = attribute groups, before/after = the groups' content), then queue `snapshot.completed` webhooks.
 * Returns the snapshot id, or null when nothing changed.
 */
export async function recordAttributeChanges(pool: pg.Pool, source: string, changes: AttrChange[], reason?: string): Promise<number | null> {
  if (changes.length === 0) return null;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock($1)', [ADVISORY_LOCK]);
    const fromSeq = Number((await client.query('SELECT COALESCE(max(seq), 0) AS s FROM changes')).rows[0].s);
    const snap = (await client.query('INSERT INTO snapshots (source, from_seq, to_seq, reason) VALUES ($1, $2, $2, $3) RETURNING id', [source, fromSeq, reason ?? null])).rows[0];
    const seqs = (await client.query("SELECT nextval('change_seq') AS s FROM generate_series(1, $1)", [changes.length])).rows.map((r) => Number(r.s));
    for (const [i, c] of changes.entries()) {
      await client.query(
        `INSERT INTO changes (seq, snapshot_id, entity_id, kind, country_code, op, changed_fields, before, after) VALUES ($1, $2, $3, 'attributes', $4, $5, $6, $7, $8)`,
        [seqs[i], snap.id, `country:${c.code}`, c.code, c.op, c.groups, c.op === 'insert' ? null : JSON.stringify(c.before), c.op === 'delete' ? null : JSON.stringify(c.after)],
      );
    }
    const counts = { inserted: changes.filter((c) => c.op === 'insert').length, updated: changes.filter((c) => c.op === 'update').length, deleted: changes.filter((c) => c.op === 'delete').length };
    await client.query('UPDATE snapshots SET finished_at = now(), to_seq = $2, inserted = $3, updated = $4, deleted = $5 WHERE id = $1', [snap.id, seqs[seqs.length - 1], counts.inserted, counts.updated, counts.deleted]);
    await enqueueDeliveries(client, Number(snap.id));
    await client.query('COMMIT');
    return Number(snap.id);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}
