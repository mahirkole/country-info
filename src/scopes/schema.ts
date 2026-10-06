import type pg from 'pg';
import { CATALOG, SCHEMA_VERSION, scopeById, type FieldDef, type ScopeDef } from './catalog.js';
import { getPath, hasValue, pruneToPaths, resolveScopes, validateScopes, type ResolveOpts, type Resolved } from './resolve.js';

export type Mode = 'union' | 'intersect';
const JSON_SCHEMA = 'https://json-schema.org/draft/2020-12/schema';

type SrcInfo = Record<string, { source_class: string | null; license_verdict: string | null }>;
async function sourceInfo(pool: pg.Pool): Promise<SrcInfo> {
  return Object.fromEntries((await pool.query('SELECT id, source_class, license_verdict FROM sources')).rows.map((r) => [r.id, { source_class: r.source_class, license_verdict: r.license_verdict }]));
}

/** Nested JSON-Schema `properties` from dotted field paths. */
function toProperties(fields: (FieldDef & { present_in?: string[]; coverage?: number })[], src: SrcInfo): Record<string, unknown> {
  const root: Record<string, any> = {};
  for (const fd of fields) {
    const keys = fd.path.split('.');
    let node = root;
    keys.forEach((k, i) => {
      if (i < keys.length - 1) { node = (node[k] ??= { type: 'object', properties: {} }).properties; return; }
      node[k] = {
        type: fd.type, description: fd.description, ...(fd.format ? { format: fd.format } : {}), 'x-source': fd.source_id,
        'x-source-class': src[fd.source_id]?.source_class ?? null, 'x-license-verdict': src[fd.source_id]?.license_verdict ?? null,
        ...(fd.present_in ? { 'x-present-in': fd.present_in, 'x-coverage': fd.coverage } : {}),
      };
    });
  }
  return root;
}

const scopeHeader = (s: ScopeDef) => ({ title: s.title, description: s.description, 'x-applies-to': s.applies_to, 'x-default': s.default, 'x-availability': s.availability });

/** Catalog as a document (no data needed). */
export async function catalogDocument(pool: pg.Pool): Promise<unknown> {
  const src = await sourceInfo(pool);
  return {
    $schema: JSON_SCHEMA, schema_version: SCHEMA_VERSION,
    default_scopes: CATALOG.filter((s) => s.default).map((s) => s.id),
    scopes: Object.fromEntries(CATALOG.map((s) => [s.id, { ...scopeHeader(s), type: 'object', properties: toProperties(s.fields, src) }])),
  };
}

/** Fields of a scope that are populated, with presence per country; mode selects the union or the intersection over the known countries. */
function presence(resolved: Resolved, scope: ScopeDef, ccs: string[], mode: Mode) {
  const known = ccs.filter((c) => resolved.data[c]);
  const fields = scope.fields.map((fd) => {
    const present_in = known.filter((c) => hasValue(getPath(resolved.data[c]![scope.id], fd.path)));
    return { ...fd, present_in, coverage: known.length ? Math.round((present_in.length / known.length) * 1000) / 1000 : 0 };
  });
  const kept = fields.filter((fd) => (mode === 'intersect' ? known.length > 0 && fd.present_in.length === known.length : fd.present_in.length > 0));
  return { known, kept };
}

/**
 * Metadata of the chosen scopes for one or several countries: only fields that actually carry data are listed;
 * `mode=intersect` keeps the fields present in every country, `union` the fields present in any (each with `x-present-in`).
 */
export async function schemaFor(pool: pg.Pool, countries: string[], scopes: string[], mode: Mode, opts: ResolveOpts = {}) {
  const resolved = await resolveScopes(pool, countries, scopes, opts);
  const src = await sourceInfo(pool);
  const ccs = [...new Set(countries.map((c) => c.toUpperCase()))];
  const out: Record<string, unknown> = {};
  for (const id of scopes) {
    const def = scopeById(id)!;
    const { kept } = presence(resolved, def, ccs, mode);
    out[id] = { ...scopeHeader(def), type: 'object', properties: toProperties(kept, src) };
  }
  return { $schema: JSON_SCHEMA, schema_version: SCHEMA_VERSION, countries: ccs.filter((c) => resolved.data[c]), unknown_countries: resolved.unknown_countries, mode, scopes: out };
}

const leaves = (o: unknown, prefix = ''): string[] =>
  o && typeof o === 'object' && !Array.isArray(o) ? Object.entries(o as Record<string, unknown>).flatMap(([k, v]) => leaves(v, prefix ? `${prefix}.${k}` : k)) : o === undefined || o === null ? [] : [prefix];

/**
 * Data of the chosen scopes for several countries. `intersect` removes every field that is missing in at least one country, so all
 * countries come back with the same shape; `union` keeps all data (missing scopes are `null` and listed in `omitted`).
 */
export async function composeProfile(pool: pg.Pool, countries: string[], scopes: string[], mode: Mode, opts: ResolveOpts = {}) {
  const resolved = await resolveScopes(pool, countries, scopes, opts);
  const ccs = [...new Set(countries.map((c) => c.toUpperCase()))];
  const known = ccs.filter((c) => resolved.data[c]);
  const data: Record<string, Record<string, unknown>> = Object.fromEntries(known.map((c) => [c, {}]));
  for (const id of scopes) {
    const def = scopeById(id)!;
    const keep = new Set(presence(resolved, def, ccs, mode).kept.map((f) => f.path));
    for (const c of known) data[c]![id] = mode === 'intersect' ? pruneToPaths(resolved.data[c]![id], keep) ?? null : resolved.data[c]![id];
    if (mode === 'intersect') {
      // Map-like fields (`units`, `names`, ...) are kept as a whole above; narrow them to the keys every country has.
      for (const fd of def.fields.filter((x) => x.type === 'object' && keep.has(x.path))) {
        const per = known.map((c) => new Set(leaves(getPath(data[c]![id], fd.path), fd.path)));
        const common = new Set([...per[0] ?? []].filter((l) => per.every((p) => p.has(l))));
        for (const c of known) {
          const root = data[c]![id] as Record<string, unknown> | null;
          if (!root) continue;
          const narrowed = pruneToPaths(getPath(root, fd.path), common, fd.path) as unknown;
          const keys = fd.path.split('.');
          let holder = root as Record<string, unknown>;
          for (const k of keys.slice(0, -1)) holder = holder[k] as Record<string, unknown>;
          if (narrowed === undefined) delete holder[keys.at(-1)!];
          else holder[keys.at(-1)!] = narrowed;
        }
      }
    }
  }
  return { schema_version: SCHEMA_VERSION, mode, scopes, countries: known, unknown_countries: resolved.unknown_countries, data, omitted: resolved.notes };
}

/** Country-level availability from the data: `full` when ≥90% of the countries carry the scope, `partial` when some do, `none` otherwise; other granularities keep the catalog's statement. */
function derivedAvailability(declared: Record<string, string>, s: ScopeDef, withData: number, total: number): Record<string, string> {
  if (!s.applies_to.includes('country') || total === 0) return declared;
  return { ...declared, country: withData === 0 ? 'none' : withData / total >= 0.9 ? 'full' : 'partial' };
}

let coverageCache: { at: number; value: unknown } | null = null;
/** Global metadata: the catalog plus how many countries carry each scope/field (cached for 10 minutes). */
export async function globalSchema(pool: pg.Pool, now = Date.now()): Promise<unknown> {
  if (coverageCache && now - coverageCache.at < 600_000) return coverageCache.value;
  const all = (await pool.query(`SELECT code FROM entities WHERE kind = 'country' ORDER BY code`)).rows.map((r) => r.code as string);
  const AGG: Record<string, string> = {
    divisions: `SELECT count(DISTINCT country_code)::int AS n FROM entities WHERE kind IN ('admin1','admin2')`,
    cities: `SELECT count(DISTINCT country_code)::int AS n FROM entities WHERE kind = 'city'`,
    holidays: `SELECT count(DISTINCT country_code)::int AS n FROM entities WHERE kind = 'holiday'`,
  };
  const cheap = CATALOG.filter((s) => !(s.id in AGG)).map((s) => s.id);
  const resolved = await resolveScopes(pool, all, cheap);
  const src = await sourceInfo(pool);
  const doc = (await catalogDocument(pool)) as { scopes: Record<string, any> };
  const scopes: Record<string, unknown> = {};
  for (const s of CATALOG) {
    if (cheap.includes(s.id)) {
      const { kept, known } = presence(resolved, s, all, 'union');
      const all_ = s.fields.map((fd) => { const p = kept.find((k) => k.path === fd.path); return p ?? { ...fd, present_in: [] as string[], coverage: 0 }; });
      const withData = known.filter((c) => Object.values(resolved.data[c]![s.id] ?? {}).length).length;
      scopes[s.id] = { ...doc.scopes[s.id], 'x-countries-with-data': withData, 'x-availability': derivedAvailability(doc.scopes[s.id]['x-availability'], s, withData, all.length), properties: toProperties(all_, src) };
    } else {
      const n = (await pool.query(AGG[s.id]!)).rows[0].n;
      scopes[s.id] = { ...doc.scopes[s.id], 'x-countries-with-data': n, 'x-availability': derivedAvailability(doc.scopes[s.id]['x-availability'], s, n, all.length) };
    }
  }
  const value = { ...doc, countries_total: all.length, scopes };
  coverageCache = { at: now, value };
  return value;
}
export const resetSchemaCache = () => { coverageCache = null; };
export { validateScopes };
