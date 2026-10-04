import type pg from 'pg';
import { EU27 } from './sources/eu.js';

const EXTRA: Record<string, string> = { ı: 'i', ł: 'l', ø: 'o', đ: 'd', ß: 'ss', æ: 'ae', œ: 'oe', þ: 'th', ð: 'd' };

/** Case-, accent- and punctuation-insensitive form used to compare region names across sources. */
export function normalizeName(s: string | null | undefined): string {
  return (s ?? '')
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[̀-ͯ]/g, '')
    .replace(/[ıłøđßæœþð]/g, (c) => EXTRA[c]!)
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

interface Row {
  id: string;
  country_code: string;
  kind: string;
  names: string[];
}

export interface Link {
  a: string;
  b: string;
  method: string;
}
export interface Ambiguity {
  entity: string;
  candidates: string[];
}
export interface LinkPlan {
  links: Link[];
  ambiguous: Ambiguity[];
  unmatched: string[];
  /** NUTS level chosen per country (the one matching the most GeoNames admin1 records). */
  levelByCountry: Record<string, string>;
}

/**
 * Pure matching: per country pick the NUTS level whose names match the most
 * GeoNames admin1 names, then link one-to-one on normalized name. Names that
 * match several regions (or regions claimed by several admin1) are reported
 * as ambiguous, never guessed.
 */
export function planLinks(admin1: Row[], nuts: Row[]): LinkPlan {
  const plan: LinkPlan = { links: [], ambiguous: [], unmatched: [], levelByCountry: {} };
  const countries = [...new Set(admin1.map((r) => r.country_code))].sort();
  for (const cc of countries) {
    const as = admin1.filter((r) => r.country_code === cc);
    const ns = nuts.filter((r) => r.country_code === cc);
    const byLevel = new Map<string, Map<string, Row[]>>();
    for (const n of ns) {
      const idx = byLevel.get(n.kind) ?? new Map<string, Row[]>();
      for (const name of new Set(n.names.map(normalizeName).filter(Boolean))) idx.set(name, [...(idx.get(name) ?? []), n]);
      byLevel.set(n.kind, idx);
    }
    const score = (kind: string) => as.filter((a) => a.names.some((nm) => byLevel.get(kind)?.has(normalizeName(nm)))).length;
    const level = [...byLevel.keys()].sort().map((k) => ({ k, s: score(k) })).sort((x, y) => y.s - x.s || x.k.localeCompare(y.k))[0];
    if (!level || level.s === 0) {
      plan.unmatched.push(...as.map((a) => a.id));
      continue;
    }
    plan.levelByCountry[cc] = level.k;
    const idx = byLevel.get(level.k)!;
    const claims = new Map<string, string[]>(); // nuts id -> admin1 ids
    const candidatesOf = new Map<string, string[]>(); // admin1 id -> nuts ids
    for (const a of as) {
      const c = [...new Set(a.names.flatMap((nm) => (idx.get(normalizeName(nm)) ?? []).map((n) => n.id)))].sort();
      candidatesOf.set(a.id, c);
      for (const n of c) claims.set(n, [...(claims.get(n) ?? []), a.id]);
    }
    for (const a of as) {
      const c = candidatesOf.get(a.id)!;
      if (c.length === 0) plan.unmatched.push(a.id);
      else if (c.length === 1 && claims.get(c[0]!)!.length === 1) plan.links.push({ a: a.id, b: c[0]!, method: 'name_exact' });
      else plan.ambiguous.push({ entity: a.id, candidates: c });
    }
  }
  return plan;
}

const SCOPE = [...EU27, 'TR'];

/** Recompute GeoNames admin1 <-> NUTS links and review items (derived data, fully rebuilt each run). */
export async function linkRegions(pool: pg.Pool): Promise<LinkPlan> {
  const load = async (kinds: string[], source: string) =>
    (
      await pool.query(
        `SELECT id, country_code::text AS country_code, kind, ARRAY[name, name_ascii, data->>'name_latin'] AS names
         FROM entities WHERE source_id = $1 AND kind = ANY($2) AND country_code = ANY($3)`,
        [source, kinds, SCOPE],
      )
    ).rows.map((r) => ({ ...r, names: (r.names as (string | null)[]).filter((x): x is string => !!x) })) as Row[];
  const plan = planLinks(await load(['admin1'], 'geonames'), await load(['nuts1', 'nuts2', 'nuts3'], 'gisco-nuts'));

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("DELETE FROM entity_links WHERE method = 'name_exact'");
    await client.query("DELETE FROM review_items WHERE field = 'link:nuts' AND status = 'open'");
    if (plan.links.length) {
      await client.query(
        `INSERT INTO entity_links (a_id, b_id, relation, confidence, method)
         SELECT a, b, 'same_as', 1, method FROM jsonb_to_recordset($1::jsonb) AS r(a text, b text, method text) ON CONFLICT DO NOTHING`,
        [JSON.stringify(plan.links)],
      );
    }
    for (const amb of plan.ambiguous) {
      await client.query(
        `INSERT INTO review_items (entity_id, field, a_source, a_value, b_source, b_value) VALUES ($1, 'link:nuts', 'geonames', NULL, 'gisco-nuts', $2)`,
        [amb.entity, JSON.stringify({ candidates: amb.candidates })],
      );
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
  return plan;
}
