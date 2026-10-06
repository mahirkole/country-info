import { createHash } from 'node:crypto';
import type pg from 'pg';
import type { EntityInput, SourceMeta } from '../model.js';
import { fetchBytes, fetchText } from './fetch.js';
import { parseCsv } from './csv.js';
import { readXlsx, type Sheet } from './xlsx.js';
import { isAdminType } from '../taxonomy.js';
import { loadEvidence, usable, type UpstreamEvidence } from './cod-evidence.js';

const HDX = 'https://data.humdata.org';
const MAX_LEVEL = 3;
/** Tolerance between the XLSX unit counts and the counts the metadata file states for the same dataset. */
const COUNT_TOLERANCE = 0.05;

export const COD_SOURCE: SourceMeta = {
  id: 'cod-ab',
  authority: 'UN OCHA – Common Operational Datasets, Administrative Boundaries (via HDX)',
  url: `${HDX}/dataset/cod-ab-global`,
  license: 'CC BY 3.0 IGO (HDX package license_id cc-by-igo, read from each country package at refresh); attribute tables only, no geometry; docs/licenses/ocha-cod-ab.md',
  attribution: 'Source: UN OCHA / Humanitarian Data Exchange (HDX), COD-AB administrative boundaries, upstream authority as named per record (data.upstream), CC BY 3.0 IGO; attribute tables adapted by country-info (changes: mapped to the common division schema). Not endorsed by the United Nations or OCHA.',
};

export interface CodCountry {
  iso2: string;
  iso3: string;
  levelFull: number;
  /** Unit counts per level 1..3 as stated by the metadata file (0 = not stated). */
  counts: number[];
  /** Level names per level 1..3 ("Province", "District", …). */
  levelNames: string[];
  source: string;
  methodology: string;
  caveats: string;
  updated: string;
}

export function parseCodMetadata(text: string): CodCountry[] {
  const rows = parseCsv(text);
  if (!rows.length || !('country_iso2' in rows[0]!) || !('admin_level_full' in rows[0]!) || !('source' in rows[0]!)) throw new Error('COD-AB global metadata: unexpected columns — layout changed');
  return rows.flatMap((r) => {
    const iso2 = (r['country_iso2'] ?? '').trim().toUpperCase();
    const iso3 = (r['country_iso3'] ?? '').trim().toLowerCase();
    if (!/^[A-Z]{2}$/.test(iso2) || !/^[a-z]{3}$/.test(iso3)) return [];
    return [{
      iso2, iso3,
      levelFull: Math.min(Number(r['admin_level_full']) || 0, MAX_LEVEL),
      counts: [1, 2, 3].map((n) => Number(r[`admin_${n}_count`]) || 0),
      levelNames: [1, 2, 3].map((n) => (r[`admin_${n}_name`] ?? '').trim()),
      source: (r['source'] ?? '').replace(/\s+/g, ' ').trim(),
      methodology: (r['methodology_dataset'] ?? '').replace(/\s+/g, ' ').trim(),
      caveats: (r['caveats'] ?? '').replace(/\s+/g, ' ').trim(),
      updated: (r['date_updated'] ?? '').trim(),
    }];
  });
}

/**
 * Markers that make a country ineligible without any review. `where: 'source'` markers name a non-national upstream and are looked for in the
 * upstream (`source`) text only — methodology notes routinely say "P-coded by OCHA", which is not the upstream; `where: 'any'` markers are
 * restrictive terms and are looked for everywhere.
 */
const DENY: { re: RegExp; why: string; where: 'source' | 'any' }[] = [
  { re: /humanitarian use|for humanitarian/i, why: 'humanitarian use only', where: 'any' },
  { re: /openstreetmap|\bosm\b/i, why: 'OpenStreetMap-derived', where: 'any' },
  { re: /odbl|non-?commercial|permission|restricted|not for (commercial|redistribution)/i, why: 'restrictive terms', where: 'any' },
  { re: /unicef|unhcr|\bwfp\b|world food programme|\bwho\b|unmil|united nations|\bunocha\b|\bocha\b|\bimwg\b|\bunops\b|\biom\b|\bfao\b/i, why: 'UN/agency compilation, not a national publisher', where: 'source' },
  { re: /\bgadm\b|geoboundaries|\bgaul\b|\bsalb\b|secondary administrative level|\bcdema\b|popgis|pacific community/i, why: 'global/regional compilation, not a national publisher', where: 'source' },
];

export function denyReason(c: CodCountry): string | null {
  const all = `${c.source} | ${c.methodology} | ${c.caveats}`;
  for (const d of DENY) if (d.re.test(d.where === 'source' ? c.source : all)) return d.why;
  return null;
}

export const sourceSha = (c: CodCountry) => createHash('sha256').update(c.source).digest('hex');

/** Exact level names (accent-/case-insensitive, parenthetical removed) -> common vocabulary; anything else stays `other` with the native term in `type_local`. */
const TYPE_WORDS: Record<string, string> = {
  province: 'province', provincia: 'province', state: 'state', estado: 'state', region: 'region', prefecture: 'prefecture', canton: 'canton', county: 'county',
  district: 'district', distrito: 'district', departement: 'department', department: 'department', departamento: 'department', territory: 'territory',
  municipality: 'municipality', municipio: 'municipality', 'local municipality': 'municipality', city: 'city', town: 'town', village: 'village', commune: 'commune',
  borough: 'borough', parish: 'parish', parroquia: 'parish', ward: 'ward',
};
const typeOf = (name: string) => {
  const key = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\([^)]*\)/g, '').trim().toLowerCase();
  const t = TYPE_WORDS[key] ?? 'other';
  return isAdminType(t) ? t : 'other';
};

export interface CodUnit { level: number; pcode: string; parent: string | null; name: string; names: { name: string; lang: string | null }[] }

const col = (header: string[], re: RegExp) => header.findIndex((h) => re.test(h));

/**
 * One country's attribute workbook -> units. Two layouts exist on HDX: `<iso3>_admin<N>` sheets with `adm<N>_name/_pcode` (+ `adm<N>_name1..3`, `lang`, `lang1..3`),
 * and legacy `ADM<N>` sheets with `ADM<N>_<LANG>` / `ADM<N>_PCODE`. Expired rows (valid_to set) are skipped.
 */
export function parseCodWorkbook(sheets: Sheet[], levels: number): CodUnit[] {
  const out: CodUnit[] = [];
  for (let n = 1; n <= levels; n++) {
    const sheet = sheets.find((s) => new RegExp(`(?:^|_)adm(?:in)?${n}$`, 'i').test(s.name.trim()));
    if (!sheet) throw new Error(`COD-AB workbook has no admin${n} sheet — layout changed`);
    const header = (sheet.rows[0] ?? []).map((h) => h.trim().toLowerCase());
    const iP = col(header, new RegExp(`^adm${n}_pcode$`));
    const iN = header.findIndex((h, i) => i !== iP && new RegExp(`^adm${n}_(name|[a-z]{2})$`).test(h));
    const iPar = n > 1 ? col(header, new RegExp(`^adm${n - 1}_pcode$`)) : -1;
    const iTo = col(header, /^(valid_?to)$/);
    if (iP < 0 || iN < 0 || (n > 1 && iPar < 0)) throw new Error(`COD-AB workbook admin${n} sheet: expected name/pcode columns missing — layout changed`);
    const alts = header.flatMap((h, i) => (new RegExp(`^adm${n}(_name[1-3]|alt[1-3]_[a-z]{2})$`).test(h) ? [i] : []));
    const langOf = (h: string) => (/_([a-z]{2})$/.exec(h)?.[1] ?? null);
    const seen = new Set<string>();
    for (const r of sheet.rows.slice(1)) {
      const pcode = (r[iP] ?? '').trim();
      const name = (r[iN] ?? '').trim();
      if (!pcode || !name || (iTo >= 0 && (r[iTo] ?? '').trim())) continue;
      if (seen.has(pcode)) throw new Error(`COD-AB workbook admin${n}: duplicate pcode ${pcode}`);
      seen.add(pcode);
      out.push({
        level: n, pcode, name,
        parent: n > 1 ? (r[iPar] ?? '').trim() || null : null,
        names: alts.flatMap((i) => ((r[i] ?? '').trim() ? [{ name: (r[i] ?? '').trim(), lang: langOf(header[i]!) }] : [])),
      });
    }
  }
  const byLevel = new Set(out.map((u) => `${u.level}:${u.pcode}`));
  for (const u of out) if (u.level > 1 && !byLevel.has(`${u.level - 1}:${u.parent}`)) throw new Error(`COD-AB workbook: ${u.pcode} has no parent ${u.parent} — hierarchy broken`);
  return out;
}

/** Counts per level must agree with the metadata file within tolerance, else the dataset/metadata pair is inconsistent. */
export function checkCodCounts(c: CodCountry, units: CodUnit[]): string | null {
  for (let n = 1; n <= c.levelFull; n++) {
    const want = c.counts[n - 1]!;
    if (!want) continue;
    const got = units.filter((u) => u.level === n).length;
    if (Math.abs(got - want) > Math.max(1, want * COUNT_TOLERANCE)) return `admin${n}: ${got} units in the workbook, ${want} in the metadata`;
  }
  return null;
}

export function codEntities(c: CodCountry, units: CodUnit[], datasetUrl: string, datasetSource: string): EntityInput[] {
  return units.map((u): EntityInput => ({
    id: `div:${c.iso2}:${u.pcode}`,
    kind: 'division',
    parent_id: u.level === 1 ? `country:${c.iso2}` : `div:${c.iso2}:${u.parent}`,
    country_code: c.iso2,
    code: u.pcode,
    name: u.name,
    name_ascii: null,
    lat: null,
    lon: null,
    data: {
      level: u.level,
      type: typeOf(c.levelNames[u.level - 1] ?? ''),
      type_local: c.levelNames[u.level - 1] || null,
      pcode: u.pcode,
      ...(u.names.length ? { names_alt: u.names } : {}),
      upstream: datasetSource || c.source,
      source_ref: datasetUrl,
      vintage: c.updated || null,
    },
  }));
}

interface CkanPackage { license_id?: string; dataset_source?: string; methodology?: string; methodology_other?: string; notes?: string; caveats?: string; resources?: { format?: string; download_url?: string; url?: string }[] }

async function globalMetadataUrl(cacheDir: string): Promise<string> {
  const pkg = JSON.parse(await fetchText(`${HDX}/api/3/action/package_show?id=cod-ab-global`, 'cod_global_package.json', cacheDir)) as { result?: CkanPackage };
  const r = (pkg.result?.resources ?? []).find((x) => /^csv$/i.test(x.format ?? '') && /metadata/i.test(x.download_url ?? x.url ?? ''));
  const url = r?.download_url ?? r?.url;
  if (!url) throw new Error('COD-AB global package: no metadata CSV resource — layout changed');
  return url;
}

export interface CodContext { pool?: pg.Pool; dryRun?: boolean }

/** Review state: `acked` is a human decision pinned to the upstream text hash; `pending`/`excluded` are written by the loader. */
const setReview = async (ctx: CodContext | undefined, c: CodCountry, status: 'pending' | 'excluded', n: string) => {
  if (!ctx?.pool || ctx.dryRun) return;
  await ctx.pool.query(
    `INSERT INTO cod_review (country, status, source_sha256, source_text, note) VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (country) DO UPDATE SET status = $2, source_sha256 = $3, source_text = $4, note = $5, updated_at = now()`,
    [c.iso2, status, sourceSha(c), c.source, n],
  );
};
/** Load outcome of an acknowledged country (never changes the review decision). */
const setNote = async (ctx: CodContext | undefined, c: CodCountry, n: string) => {
  if (!ctx?.pool || ctx.dryRun) return;
  await ctx.pool.query('UPDATE cod_review SET note = $2, updated_at = now() WHERE country = $1', [c.iso2, n]);
};

/** `cod:ack <CC,CC|all>`: record that the upstream text of these countries was read and is a national/official publisher. */
export async function ackCod(pool: pg.Pool, cacheDir: string, arg: string): Promise<string[]> {
  const meta = parseCodMetadata(await fetchText(await globalMetadataUrl(cacheDir), 'cod_global_metadata.csv', cacheDir));
  const want = new Set(arg.split(',').map((x) => x.trim().toUpperCase()).filter(Boolean));
  const done: string[] = [];
  for (const c of meta) {
    if (!(want.has('ALL') || want.has(c.iso2)) || denyReason(c) || c.levelFull < 1 || !usable(loadEvidence().find((e) => e.country === c.iso2))) continue;
    await pool.query(
      `INSERT INTO cod_review (country, status, source_sha256, source_text, note) VALUES ($1, 'acked', $2, $3, 'acknowledged')
       ON CONFLICT (country) DO UPDATE SET status = 'acked', source_sha256 = $2, source_text = $3, updated_at = now()`,
      [c.iso2, sourceSha(c), c.source],
    );
    done.push(c.iso2);
  }
  return done;
}

/**
 * Countries to load = metadata rows that pass the deny filter, have no national adapter, and whose upstream text was acknowledged
 * (`cod:ack`) with the same sha256 as today. Everything else is recorded in `cod_review` with the reason and not loaded.
 */
export async function loadCod(cacheDir: string, skip: ReadonlySet<string>, ctx?: CodContext, evidenceList: UpstreamEvidence[] = loadEvidence()): Promise<EntityInput[]> {
  const evidence = new Map(evidenceList.map((e) => [e.country, e]));
  const meta = parseCodMetadata(await fetchText(await globalMetadataUrl(cacheDir), 'cod_global_metadata.csv', cacheDir));
  const acked = new Map<string, string>();
  if (ctx?.pool) for (const r of (await ctx.pool.query("SELECT country, source_sha256 FROM cod_review WHERE status = 'acked'")).rows) acked.set(r.country as string, r.source_sha256 as string);
  const out: EntityInput[] = [];
  for (const c of meta) {
    if (skip.has(c.iso2)) continue;
    const deny = denyReason(c);
    if (deny) { await setReview(ctx, c, 'excluded', deny); continue; }
    if (c.levelFull < 1) { await setReview(ctx, c, 'excluded', 'no fully covered administrative level'); continue; }
    if (acked.get(c.iso2) !== sourceSha(c)) { await setReview(ctx, c, 'pending', acked.has(c.iso2) ? 'upstream source text changed since it was reviewed' : 'upstream source not reviewed yet (cod:ack)'); continue; }
    if (!usable(evidence.get(c.iso2))) { await setNote(ctx, c, `not loaded: upstream owner's licence not established (docs/licenses/cod-upstream.json: ${evidence.get(c.iso2)?.verdict ?? 'no entry'})`); continue; }
    try {
      const pkg = (JSON.parse(await fetchText(`${HDX}/api/3/action/package_show?id=cod-ab-${c.iso3}`, `cod_pkg_${c.iso3}.json`, cacheDir)) as { result?: CkanPackage }).result;
      if (pkg?.license_id !== 'cc-by-igo') throw new Error(`package license is ${pkg?.license_id ?? 'missing'}, not cc-by-igo`);
      const pkgDeny = denyReason({ ...c, source: pkg.dataset_source ?? c.source, methodology: [pkg.methodology, pkg.methodology_other, pkg.notes].filter(Boolean).join(' '), caveats: pkg.caveats ?? '' });
      if (pkgDeny) throw new Error(pkgDeny);
      const xlsx = (pkg.resources ?? []).find((r) => /^xlsx$/i.test(r.format ?? ''));
      const url = xlsx?.download_url ?? xlsx?.url;
      if (!url) throw new Error('no XLSX attribute table in the package');
      const units = parseCodWorkbook(readXlsx(await fetchBytes(url, `cod_${c.iso3}.xlsx`, cacheDir)), c.levelFull);
      const bad = checkCodCounts(c, units);
      if (bad) throw new Error(bad);
      out.push(...codEntities(c, units, `${HDX}/dataset/cod-ab-${c.iso3}`, pkg.dataset_source ?? ''));
      await setNote(ctx, c, `loaded ${units.length} units, levels 1..${c.levelFull}`);
    } catch (e) {
      await setNote(ctx, c, `not loaded: ${(e as Error).message}`);
    }
  }
  return out;
}
