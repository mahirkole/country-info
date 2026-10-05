import type pg from 'pg';

export interface Gone { id: string; name: string; parent_id: string | null; country_code: string }
export interface Suggestion {
  from: string;
  to: { id: string; name: string }[];
  relation: 'replaced_by' | 'merged_into' | 'split_into';
  confidence: number;
}

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

/**
 * Pair units that disappeared in a release with units that appeared in the same release, so a rename, a code change
 * or a merger reads as "replaced by" instead of an unrelated delete + insert. Heuristic and conservative: same country and
 * same parent only, and the result is only ever a suggestion for a human (review_items), never applied automatically.
 *  - same normalised name (id/code changed): replaced_by, 0.9
 *  - one name contains the other (≥ 4 chars, e.g. "Aix" -> "Aix-les-Bains"): replaced_by, 0.6
 *  - a new name that contains the names of ≥ 2 vanished units (a merger): merged_into, 0.6 for each of them
 *  - a vanished name contained in ≥ 2 new names (a split, e.g. "Aksu" -> "Aksu Kuzey", "Aksu Güney"): split_into, 0.6 with all targets
 */
export function suggestSuccessors(gone: Gone[], appeared: Gone[]): Suggestion[] {
  const out: Suggestion[] = [];
  const used = new Set<string>();
  const key = (g: Gone) => `${g.country_code}|${g.parent_id ?? ''}`;
  const byGroup = new Map<string, { gone: Gone[]; appeared: Gone[] }>();
  for (const g of gone) (byGroup.get(key(g)) ?? byGroup.set(key(g), { gone: [], appeared: [] }).get(key(g))!).gone.push(g);
  for (const a of appeared) (byGroup.get(key(a)) ?? byGroup.set(key(a), { gone: [], appeared: [] }).get(key(a))!).appeared.push(a);

  for (const grp of byGroup.values()) {
    if (!grp.gone.length || !grp.appeared.length) continue;
    // mergers first: a new name containing several vanished names
    for (const a of grp.appeared) {
      const an = norm(a.name);
      const parts = grp.gone.filter((g) => !used.has(g.id) && norm(g.name).length >= 4 && norm(g.name) !== an && an.includes(norm(g.name)));
      if (parts.length >= 2) for (const g of parts) { used.add(g.id); out.push({ from: g.id, to: [{ id: a.id, name: a.name }], relation: 'merged_into', confidence: 0.6 }); }
    }
    for (const g of grp.gone) {
      if (used.has(g.id)) continue;
      const gn = norm(g.name);
      const exact = grp.appeared.filter((a) => norm(a.name) === gn && a.id !== g.id);
      if (exact.length === 1) { used.add(g.id); out.push({ from: g.id, to: [{ id: exact[0]!.id, name: exact[0]!.name }], relation: 'replaced_by', confidence: 0.9 }); continue; }
      if (gn.length >= 4) {
        const splits = grp.appeared.filter((a) => { const an = norm(a.name); return an !== gn && an.includes(gn); });
        if (splits.length >= 2) { used.add(g.id); out.push({ from: g.id, to: splits.map((a) => ({ id: a.id, name: a.name })), relation: 'split_into', confidence: 0.6 }); continue; }
        const part = grp.appeared.filter((a) => { const an = norm(a.name); return an !== gn && (an.includes(gn) || (an.length >= 4 && gn.includes(an))); });
        if (part.length === 1) { used.add(g.id); out.push({ from: g.id, to: [{ id: part[0]!.id, name: part[0]!.name }], relation: 'replaced_by', confidence: 0.6 }); }
      }
    }
  }
  return out;
}

/** Read the deletes and inserts of one snapshot and queue successor suggestions as open review items (idempotent). */
export async function recordSuccessors(pool: pg.Pool, snapshotId: number, sourceId: string): Promise<number> {
  const rows = (await pool.query(
    `SELECT op, entity_id AS id, country_code::text AS country_code, COALESCE(before, after) AS rec FROM changes WHERE snapshot_id = $1 AND op IN ('delete','insert')`,
    [snapshotId],
  )).rows as { op: string; id: string; country_code: string; rec: { name?: string; parent_id?: string | null } }[];
  const toGone = (r: (typeof rows)[number]): Gone => ({ id: r.id, name: r.rec.name ?? '', parent_id: r.rec.parent_id ?? null, country_code: r.country_code });
  const gone = rows.filter((r) => r.op === 'delete').map(toGone);
  const appeared = rows.filter((r) => r.op === 'insert').map(toGone);
  if (!gone.length || !appeared.length || gone.length > 5000 || appeared.length > 5000) return 0;
  const byId = new Map(gone.map((g) => [g.id, g]));
  let n = 0;
  for (const s of suggestSuccessors(gone, appeared)) {
    const field = `successor:${s.relation}`;
    const exists = (await pool.query(`SELECT 1 FROM review_items WHERE entity_id = $1 AND field = $2 AND status = 'open'`, [s.from, field])).rowCount;
    if (exists) continue;
    const g = byId.get(s.from)!;
    await pool.query(
      `INSERT INTO review_items (entity_id, field, a_source, a_value, b_source, b_value) VALUES ($1, $2, $3, $4, $3, $5)`,
      [s.from, field, sourceId, JSON.stringify({ name: g.name, parent_id: g.parent_id }), JSON.stringify({ to: s.to, confidence: s.confidence, snapshot_id: snapshotId })],
    );
    n++;
  }
  return n;
}
