import type { EntityInput } from '../model.js';
import { logBody } from './fetch.js';
import { sparql, type Binding } from './wikidata.js';
import { division } from './national/types.js';

/**
 * Administrative levels read from Wikidata (CC0) for countries whose official source is closed or unreadable.
 * Every level names the Wikidata classes whose current (no end date) instances form that level and the count the
 * official statistics give; a level outside its band aborts the load, so a vandalised or reorganised class never
 * reaches the database. Parents come from P131 ancestors in the previous level.
 */
export interface WdLevel {
  key: string;
  /** Wikidata class QIDs (instance of). */
  classes: string[];
  level: number;
  type: string;
  typeLocal: string;
  /** Inclusive band for the number of current instances (after `exclude`). */
  expected: [number, number];
  /** Items that carry the class but are not units of the official structure (QID -> reason), e.g. a proposed merged region. */
  exclude?: Record<string, string>;
}
export interface WdCountry {
  cc: string;
  /** Country QID, used to restrict instances (P17). */
  country: string;
  /** Label languages, native first; English is always the fallback. */
  langs: string[];
  levels: WdLevel[];
}

const qid = (uri: string) => uri.split('/').pop()!;

export function levelQuery(c: WdCountry, l: WdLevel, above: WdLevel[]): string {
  const cls = (xs: string[]) => xs.map((x) => `wd:${x}`).join(' ');
  const parent = above.length ? { classes: above.flatMap((a) => a.classes) } : null;
  const langs = [...new Set([...c.langs, 'en'])].map((x) => `"${x}"`).join(', ');
  return `SELECT ?i ?lang ?label ?p WHERE {
  VALUES ?cls { ${cls(l.classes)} }
  ?i wdt:P31 ?cls ; wdt:P17 wd:${c.country} .
  FILTER NOT EXISTS { ?i wdt:P576 ?end }
  OPTIONAL { ?i rdfs:label ?label . BIND(LANG(?label) AS ?lang) FILTER(?lang IN (${langs})) }
  ${parent ? `OPTIONAL { ?i wdt:P131+ ?p . ?p wdt:P31 ?pc . VALUES ?pc { ${cls(parent.classes)} } FILTER NOT EXISTS { ?p wdt:P576 ?pend } }` : ''}
}`;
}

export interface LevelRows {
  names: Map<string, string>;
  parents: Map<string, string[]>;
}

/** Reduce the rows of one level to a name per item (first language in `langs` wins) and its candidate parents (all ancestors in the levels above). */
export function reduceLevel(rows: Binding[], langs: string[]): LevelRows {
  const order = [...langs, 'en'];
  const best = new Map<string, { rank: number; name: string }>();
  const parents = new Map<string, string[]>();
  const items = new Set<string>();
  for (const r of rows) {
    const i = qid(r.i!.value);
    if (!/^Q\d+$/.test(i)) continue;
    items.add(i);
    const rank = r.lang ? order.indexOf(r.lang.value) : -1;
    if (r.label && rank >= 0 && (!best.has(i) || rank < best.get(i)!.rank)) best.set(i, { rank, name: r.label.value });
    if (r.p) {
      const p = qid(r.p.value);
      const cur = parents.get(i) ?? [];
      if (!cur.includes(p)) cur.push(p);
      parents.set(i, cur);
    }
  }
  const names = new Map<string, string>();
  for (const i of items) names.set(i, best.get(i)?.name ?? i);
  return { names, parents };
}

/** Items without an ancestor in the levels above are skipped (the lower-priority GeoNames layer still covers them); more than 1% of a level is an error. */
export function buildDivisions(c: WdCountry, levels: LevelRows[], skipped: string[] = []): EntityInput[] {
  const out: EntityInput[] = [];
  const known = new Map<string, number>(); // qid -> level index
  levels.forEach((lr, idx) => {
    const l = c.levels[idx]!;
    for (const q of Object.keys(l.exclude ?? {})) { lr.names.delete(q); lr.parents.delete(q); }
    if (lr.names.size < l.expected[0] || lr.names.size > l.expected[1]) {
      throw new Error(`Wikidata ${c.cc} ${l.key}: ${lr.names.size} items, official band ${l.expected[0]}–${l.expected[1]} — not loaded`);
    }
    for (const [q, name] of [...lr.names].sort((a, b) => Number(a[0].slice(1)) - Number(b[0].slice(1)))) {
      // nearest ancestor: the deepest level wins, then the smallest QID
      const p = (lr.parents.get(q) ?? []).filter((x) => known.has(x)).sort((a, b) => known.get(b)! - known.get(a)! || Number(a.slice(1)) - Number(b.slice(1)))[0];
      const parent = idx === 0 ? 'country:' + c.cc : p ? `div:${c.cc}:wd-${p}` : null;
      if (!parent) {
        skipped.push(`${l.key} ${q} ${name}`);
        if (skipped.length > Math.max(1, lr.names.size / 100)) throw new Error(`Wikidata ${c.cc} ${l.key}: too many items without a parent (${skipped.slice(0, 5).join('; ')})`);
        lr.names.delete(q);
        continue;
      }
      out.push(division(c.cc, `wd-${q}`, { parent, name, level: l.level, type: l.type, typeLocal: l.typeLocal, extra: { wikidata: q } }));
    }
    for (const q of lr.names.keys()) known.set(q, idx);
  });
  return out;
}

export async function loadWikidataDivisions(c: WdCountry): Promise<EntityInput[]> {
  const levels: LevelRows[] = [];
  for (const [i, l] of c.levels.entries()) {
    const rows = await sparql(levelQuery(c, l, c.levels.slice(0, i)));
    // Deterministic raw-input hash for `refresh`: sorted compact rows.
    logBody(JSON.stringify(rows.map((r) => [r.i?.value, r.lang?.value, r.label?.value, r.p?.value]).sort()));
    levels.push(reduceLevel(rows, c.langs));
  }
  const skipped: string[] = [];
  const out = buildDivisions(c, levels, skipped);
  if (skipped.length) console.warn(`wikidata ${c.cc}: skipped without parent: ${skipped.join(', ')}`);
  return out;
}
