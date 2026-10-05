import type pg from 'pg';
import { lookupQuery, parseLookup, sparql, type Binding } from './sources/wikidata.js';

export const DEFAULT_LANGS = ['en', 'tr', 'de', 'fr', 'es', 'it', 'pt', 'ru', 'ar', 'zh', 'ja', 'ko', 'nl', 'pl'];
const BATCH = 300;

/** How to find an entity's Wikidata item: which Wikidata property holds which of our identifiers. */
export interface LookupSpec {
  name: string;
  property: string;
  /** SQL predicate on `e` (entities) selecting the entities this spec covers. */
  where: string;
  /** SQL expression yielding the identifier value to look up. */
  value: string;
}

export const SPECS: LookupSpec[] = [
  { name: 'geonames', property: 'P1566', where: "e.source_id = 'geonames' AND e.data->>'geonames_id' IS NOT NULL", value: "e.data->>'geonames_id'" },
  { name: 'nuts', property: 'P605', where: "e.kind IN ('nuts1','nuts2','nuts3')", value: 'e.code' },
  { name: 'fr-commune', property: 'P374', where: "e.id LIKE 'div:FR:com-%' AND e.data->>'cog_type' = 'COM'", value: "e.data->>'insee'" },
  { name: 'fr-departement', property: 'P2586', where: "e.id LIKE 'div:FR:dep-%'", value: "e.data->>'insee'" },
  { name: 'fr-region', property: 'P2585', where: "e.id LIKE 'div:FR:reg-%'", value: "e.data->>'insee'" },
  { name: 'de-gemeinde', property: 'P439', where: "e.id LIKE 'div:DE:gem-%'", value: "e.data->>'ags'" },
  { name: 'at-gemeinde', property: 'P964', where: "e.id LIKE 'div:AT:gem-%'", value: "e.data->>'code'" },
  { name: 'it-comune', property: 'P635', where: "e.id LIKE 'div:IT:com-%'", value: "e.data->>'istat'" },
  { name: 'ch-gemeinde', property: 'P771', where: "e.id LIKE 'div:CH:gem-%'", value: "e.data->>'bfs_code'" },
];

export interface EnrichOptions {
  specs?: string[];
  langs?: string[];
  /** Stop after this many entities (per spec); for incremental runs and tests. */
  limit?: number;
  /** Look again at entities checked longer ago than this. */
  olderThanDays?: number;
  run?: (query: string) => Promise<Binding[]>;
}
export interface EnrichResult {
  spec: string;
  asked: number;
  matched: number;
  ambiguous: number;
  missing: number;
  names: number;
}

export const WIKIDATA_SOURCE = {
  id: 'wikidata',
  authority: 'Wikidata (Wikimedia Foundation) – structured data',
  url: 'https://www.wikidata.org/',
  license: 'CC0 1.0 (Wikidata:Licensing, read): "All structured data… is released into the public domain under Creative Commons Zero". Community-maintained, not an official source (docs/licenses/wikidata.md).',
  attribution: 'Contains data from Wikidata (CC0 1.0).',
};

async function ensureSource(pool: pg.Pool): Promise<void> {
  await pool.query(
    `INSERT INTO sources (id, authority, url, license, attribution, cadence, license_verdict, commercial_use, source_class, retrieved_at)
     VALUES ($1, $2, $3, $4, $5, 'monthly', 'green', 'CC0: commercial use and redistribution allowed, no attribution required; user-agent and rate limits apply', 'community', now())
     ON CONFLICT (id) DO UPDATE SET authority = EXCLUDED.authority, url = EXCLUDED.url, license = EXCLUDED.license, attribution = EXCLUDED.attribution, retrieved_at = now()`,
    [WIKIDATA_SOURCE.id, WIKIDATA_SOURCE.authority, WIKIDATA_SOURCE.url, WIKIDATA_SOURCE.license, WIKIDATA_SOURCE.attribution],
  );
}

/**
 * Attach Wikidata QIDs (`entity_xrefs`) and multilingual labels (`entity_names`) to entities by looking up the
 * identifiers they already carry. Incremental: entities already checked recently are skipped, so a run only asks
 * about new or stale ones. Ambiguous identifiers (several QIDs) are recorded as "looked up, no unique match".
 */
export async function enrichWikidata(pool: pg.Pool, o: EnrichOptions = {}): Promise<EnrichResult[]> {
  const langs = o.langs ?? DEFAULT_LANGS;
  const run = o.run ?? ((q: string) => sparql(q));
  const specs = SPECS.filter((s) => !o.specs || o.specs.includes(s.name));
  await ensureSource(pool);
  const startedAt = new Date();
  const results: EnrichResult[] = [];
  for (const spec of specs) {
    const todo = (
      await pool.query(
        `SELECT e.id, ${spec.value} AS v FROM entities e
         LEFT JOIN entity_xrefs x ON x.entity_id = e.id AND x.scheme = 'wikidata'
         WHERE ${spec.where} AND ${spec.value} IS NOT NULL AND (x.entity_id IS NULL OR x.checked_at < now() - make_interval(days => $1))
         ORDER BY e.id ${o.limit ? 'LIMIT ' + Number(o.limit) : ''}`,
        [o.olderThanDays ?? 90],
      )
    ).rows as { id: string; v: string }[];
    const r: EnrichResult = { spec: spec.name, asked: todo.length, matched: 0, ambiguous: 0, missing: 0, names: 0 };
    for (let i = 0; i < todo.length; i += BATCH) {
      const part = todo.slice(i, i + BATCH);
      const lookup = parseLookup(await run(lookupQuery(spec.property, [...new Set(part.map((p) => p.v))], langs)));
      const xrefs: { entity_id: string; value: string | null }[] = [];
      const names: { entity_id: string; lang: string; name: string }[] = [];
      for (const p of part) {
        const q = lookup.qids.get(p.v);
        if (q?.size === 1) {
          const qid = [...q][0]!;
          r.matched++;
          xrefs.push({ entity_id: p.id, value: qid });
          for (const [lang, name] of lookup.labels.get(qid) ?? []) names.push({ entity_id: p.id, lang, name });
        } else {
          if (q && q.size > 1) r.ambiguous++;
          else r.missing++;
          xrefs.push({ entity_id: p.id, value: null });
        }
      }
      await pool.query(
        `INSERT INTO entity_xrefs (entity_id, scheme, value, source, checked_at)
         SELECT entity_id, 'wikidata', value, 'wikidata', now() FROM jsonb_to_recordset($1::jsonb) AS r(entity_id text, value text)
         ON CONFLICT (entity_id, scheme) DO UPDATE SET value = EXCLUDED.value, checked_at = now()`,
        [JSON.stringify(xrefs)],
      );
      if (names.length) {
        await pool.query(
          `INSERT INTO entity_names (entity_id, lang, name, source)
           SELECT entity_id, lang, name, 'wikidata' FROM jsonb_to_recordset($1::jsonb) AS r(entity_id text, lang text, name text)
           ON CONFLICT (entity_id, lang, source) DO UPDATE SET name = EXCLUDED.name`,
          [JSON.stringify(names)],
        );
      }
      r.names += names.length;
    }
    results.push(r);
  }
  await pool.query(
    `INSERT INTO source_runs (source_id, started_at, finished_at, status, rows, detail) VALUES ('wikidata', $1, now(), 'success', $2, $3)`,
    [startedAt, results.reduce((n, r) => n + r.matched, 0), JSON.stringify(results.map((r) => `${r.spec}:${r.matched}/${r.asked}`))],
  );
  return results;
}

/**
 * Link entities of different sources that point at the same Wikidata item (`same_as`, method `wikidata_qid`).
 * Derived data, rebuilt each run; entities of the same source are never linked to each other.
 */
export async function linkByQid(pool: pg.Pool): Promise<number> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("DELETE FROM entity_links WHERE method = 'wikidata_qid'");
    const r = await client.query(
      `INSERT INTO entity_links (a_id, b_id, relation, confidence, method)
       SELECT a.entity_id, b.entity_id, 'same_as', 1, 'wikidata_qid'
       FROM entity_xrefs a JOIN entity_xrefs b ON b.scheme = a.scheme AND b.value = a.value AND a.entity_id < b.entity_id
       JOIN entities ea ON ea.id = a.entity_id JOIN entities eb ON eb.id = b.entity_id
       WHERE a.scheme = 'wikidata' AND a.value IS NOT NULL AND ea.source_id <> eb.source_id
       ON CONFLICT DO NOTHING`,
    );
    await client.query('COMMIT');
    return r.rowCount ?? 0;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}
