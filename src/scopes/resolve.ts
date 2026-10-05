import type pg from 'pg';
import { UN_SQL } from '../export.js';
import { CATALOG, SCOPE_IDS, type ScopeDef } from './catalog.js';

export type ScopeData = Record<string, unknown>;
export interface ResolveOpts { locale?: string; level?: 1 | 2; year?: number; region?: string; limit?: number }
export interface Resolved { data: Record<string, Record<string, ScopeData | null>>; unknown_countries: string[]; notes: { country: string; scope: string; reason: string }[] }

type Ctx = { pool: pg.Pool; ccs: string[]; ids: Map<string, string>; rows: Map<string, Record<string, any>>; attrs: Map<string, Record<string, any>>; locales: Map<string, Record<string, any>>; opts: ResolveOpts };
type Resolver = (ctx: Ctx, cc: string) => Promise<ScopeData | null> | ScopeData | null;

const nonEmpty = (o: ScopeData | undefined | null): ScopeData | null => (o && Object.keys(o).length ? o : null);
const attr = (c: Ctx, cc: string, grp: string): Record<string, any> | undefined => c.attrs.get(`${cc}:${grp}`);
/** Locale to take patterns from: the requested one if CLDR formats exist for it, else the country's default; `null` when none is loaded. */
function localeFor(c: Ctx, cc: string): string | null {
  const want = c.opts.locale;
  if (want) return c.locales.has(want) ? want : null;
  const d = attr(c, cc, 'locale')?.default as string | undefined;
  return d && c.locales.has(d) ? d : null;
}

export const RESOLVERS: Record<string, Resolver> = {
  default: (c, cc) => {
    const r = c.rows.get(cc)!;
    const d = r.data ?? {};
    return nonEmpty({ code: r.code, name: r.name, iso3: d.iso3, numeric: d.numeric, capital: d.capital, continent: d.continent, population: d.population, area_km2: d.area_km2, un_status: r.un_x ?? undefined, names: r.names && Object.keys(r.names).length ? r.names : undefined });
  },
  contact: (c, cc) => {
    const d = c.rows.get(cc)!.data ?? {};
    return nonEmpty({ phone_code: d.phone_code, tld: d.tld, postal_code: d.postal_code, languages: d.languages, neighbours: d.neighbours });
  },
  currency: (c, cc) => attr(c, cc, 'currency') ?? null,
  measurement: (c, cc) => {
    const m = attr(c, cc, 'measurement');
    return m ? { ...m, units: attr(c, cc, 'units') ?? undefined } : null;
  },
  locale: (c, cc) => attr(c, cc, 'locale') ?? null,
  numbers: (c, cc) => {
    const loc = localeFor(c, cc);
    return loc ? { locale: loc, ...c.locales.get(loc)!.numbers } : null;
  },
  datetime: (c, cc) => {
    const loc = localeFor(c, cc);
    const week = attr(c, cc, 'week');
    const time = attr(c, cc, 'time');
    const cal = attr(c, cc, 'calendar');
    const fmt = loc ? c.locales.get(loc)! : null;
    return nonEmpty({ locale: loc ?? undefined, date: fmt?.date, time: fmt?.time, datetime: fmt?.datetime, hour_cycle: time?.hour_cycle, ...(week ?? {}), calendars: cal?.preferred });
  },
  divisions: async (c, cc) => {
    const counts = (await c.pool.query(`SELECT kind, count(*)::int AS n FROM entities WHERE country_code = $1 AND kind IN ('admin1','admin2') GROUP BY kind`, [cc])).rows as { kind: string; n: number }[];
    const levels = Object.fromEntries(counts.map((r) => [r.kind, r.n]));
    if (!counts.length) return null;
    const out: ScopeData = { levels };
    if (c.opts.level) {
      const kind = c.opts.level === 2 ? 'admin2' : 'admin1';
      const limit = Math.min(c.opts.limit ?? 500, 5000);
      out.units = (await c.pool.query(`SELECT id, code, name, parent_id, data->>'type' AS type FROM entities WHERE country_code = $1 AND kind = $2 ORDER BY id LIMIT $3`, [cc, kind, limit])).rows;
      out.level = c.opts.level;
    }
    return out;
  },
  holidays: async (c, cc) => {
    const year = c.opts.year ?? new Date().getUTCFullYear();
    const items = (
      await c.pool.query(
        `WITH RECURSIVE chain AS (
           SELECT id, parent_id FROM entities WHERE id = $4::text
           UNION SELECT e.id, e.parent_id FROM entities e JOIN chain ch ON e.id = ch.parent_id
         )
         SELECT id, name, data FROM entities
         WHERE kind = 'holiday' AND country_code = $1 AND data->>'date' >= $2 AND data->>'date' <= $3
           AND (parent_id = 'country:' || $1 OR parent_id IN (SELECT id FROM chain))
         ORDER BY data->>'date', id`,
        [cc, `${year}-01-01`, `${year}-12-31`, c.opts.region ?? null],
      )
    ).rows;
    return items.length ? { year, items } : null;
  },
};

export function validateScopes(scopes: string[]): string | null {
  const bad = scopes.filter((s) => !SCOPE_IDS.includes(s));
  return bad.length ? `unknown scope: ${bad.join(', ')} (known: ${SCOPE_IDS.join(', ')})` : null;
}

/** Resolve the requested scopes for the given country codes (unknown codes are reported, scopes without data come back `null` with a note). */
export async function resolveScopes(pool: pg.Pool, countries: string[], scopes: string[], opts: ResolveOpts = {}): Promise<Resolved> {
  const ccs = [...new Set(countries.map((c) => c.toUpperCase()))];
  const rows = new Map<string, Record<string, any>>();
  const ids = new Map<string, string>();
  for (const r of (await pool.query(`SELECT id, code, name, data, ${UN_SQL} AS un_x FROM entities WHERE kind = 'country' AND code = ANY($1)`, [ccs])).rows) { rows.set(r.code, r); ids.set(r.code, r.id); }
  const names = new Map<string, Record<string, string>>();
  if (scopes.includes('default') && ids.size) {
    for (const n of (await pool.query(`SELECT entity_id, lang, name FROM entity_names WHERE entity_id = ANY($1) ORDER BY entity_id, lang, (source = 'wikidata') DESC, source`, [[...ids.values()]])).rows) {
      const o = names.get(n.entity_id) ?? {};
      if (!(n.lang in o)) o[n.lang] = n.name;
      names.set(n.entity_id, o);
    }
    for (const [cc, r] of rows) r.names = names.get(ids.get(cc)!);
  }
  const attrs = new Map<string, Record<string, any>>();
  const locales = new Map<string, Record<string, any>>();
  if (ids.size) {
    const byId = new Map([...ids].map(([cc, id]) => [id, cc]));
    for (const a of (await pool.query(`SELECT entity_id, grp, data FROM entity_attributes WHERE entity_id = ANY($1)`, [[...ids.values()]])).rows) attrs.set(`${byId.get(a.entity_id)}:${a.grp}`, a.data);
    for (const l of (await pool.query(`SELECT locale, data FROM locale_formats`)).rows) locales.set(l.locale, l.data);
  }
  const ctx: Ctx = { pool, ccs, ids, rows, attrs, locales, opts };
  const data: Resolved['data'] = {};
  const notes: Resolved['notes'] = [];
  for (const cc of ccs) {
    if (!rows.has(cc)) continue;
    data[cc] = {};
    for (const s of scopes) {
      const v = await RESOLVERS[s]!(ctx, cc);
      data[cc]![s] = v;
      if (!v) notes.push({ country: cc, scope: s, reason: s === 'datetime' || s === 'numbers' ? (opts.locale && !locales.has(opts.locale) ? `no CLDR formats loaded for locale ${opts.locale}` : 'no CLDR formats for the default locale') : 'no data' });
    }
  }
  return { data, unknown_countries: ccs.filter((c) => !rows.has(c)), notes };
}

/** Value at a dotted path (`postal_code.format`), `undefined` when absent. */
export function getPath(o: unknown, path: string): unknown {
  let cur = o;
  for (const k of path.split('.')) {
    if (cur === null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[k];
  }
  return cur;
}
export const hasValue = (v: unknown): boolean => v !== undefined && v !== null && !(Array.isArray(v) && !v.length) && !(typeof v === 'object' && !Array.isArray(v) && !Object.keys(v as object).length);

/** Keep only the declared paths in `keep` (a kept path keeps its whole subtree). */
export function pruneToPaths(o: unknown, keep: Set<string>, prefix = ''): unknown {
  if (o === undefined || o === null) return undefined;
  if (prefix && keep.has(prefix)) return o;
  if (typeof o === 'object' && !Array.isArray(o)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
      const r = pruneToPaths(v, keep, prefix ? `${prefix}.${k}` : k);
      if (r !== undefined) out[k] = r;
    }
    return Object.keys(out).length ? out : undefined;
  }
  return undefined;
}

export const scopeDefs = (ids: string[]): ScopeDef[] => ids.map((i) => CATALOG.find((s) => s.id === i)!).filter(Boolean);
