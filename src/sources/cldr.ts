import type pg from 'pg';
import { fetchText } from './fetch.js';
import { enrichCldrAttributes } from './cldr-attrs.js';

export const CLDR_BASE = 'https://raw.githubusercontent.com/unicode-org/cldr-json/main/cldr-json';
export const CLDR_LANGS = ['en', 'tr', 'de', 'fr', 'es', 'it', 'pt', 'ru', 'ar', 'zh', 'ja', 'ko', 'nl', 'pl', 'sv', 'da', 'fi', 'nb', 'cs', 'el', 'hu', 'ro', 'uk', 'he', 'fa', 'hi', 'id', 'th', 'vi'];

export const CLDR_SOURCE = {
  id: 'cldr',
  authority: 'Unicode CLDR (cldr-json) – localized territory names and currency data',
  url: 'https://github.com/unicode-org/cldr-json',
  license: 'Unicode License v3 (unicode.org/license.txt, read): use, copy, modify, merge, publish, distribute and/or sell. territories.json (country names), currencyData and the `UN` grouping of territoryContainment (UN membership) are used; territoryInfo and the rest of territoryContainment are not (UN M.49 / third-party origins, docs/licenses/cldr.md).',
  attribution: 'Copyright © Unicode, Inc. Data from the Unicode Common Locale Data Repository (CLDR), distributed under the Unicode License v3.',
};

type CurrencyEntry = Record<string, { _from?: string; _to?: string; _tender?: string }>;

/** Alpha-2 territory names of one locale: keys that are two capital letters (CLDR also holds regions like 419 and aliases like XA). */
export function parseTerritories(json: unknown, lang: string): Map<string, string> {
  const terr = (json as { main?: Record<string, { localeDisplayNames?: { territories?: Record<string, string> } }> }).main?.[lang]?.localeDisplayNames?.territories;
  if (!terr) throw new Error(`CLDR territories.json for ${lang}: layout changed`);
  const out = new Map<string, string>();
  for (const [k, v] of Object.entries(terr)) if (/^[A-Z]{2}$/.test(k) && !/^X[A-Z]$/.test(k) && !/-alt-/.test(k)) out.set(k, v);
  return out;
}

/** Currencies currently in use as legal tender per region (no `_to`, not `_tender: false`). */
export function parseCurrencies(json: unknown): Map<string, string[]> {
  const region = (json as { supplemental?: { currencyData?: { region?: Record<string, CurrencyEntry[]> } } }).supplemental?.currencyData?.region;
  if (!region) throw new Error('CLDR currencyData: layout changed');
  const out = new Map<string, string[]>();
  for (const [cc, list] of Object.entries(region)) {
    const cur = list.flatMap((e) => Object.entries(e)).filter(([, v]) => !v._to && v._tender !== 'false').sort((a, b) => (b[1]._from ?? '').localeCompare(a[1]._from ?? '')).map(([c]) => c);
    if (cur.length) out.set(cc, cur);
  }
  if (out.size < 150) throw new Error(`CLDR currencyData: only ${out.size} regions — layout changed`);
  return out;
}

/**
 * ISO alpha-2 codes of the UN member states: CLDR's `UN` grouping in territoryContainment. Membership is read from CLDR at every
 * enrichment run (no list typed into this code); CLDR has no observer status, so non-members are `other`.
 */
export function parseUnMembers(json: unknown): Set<string> {
  const un = (json as { supplemental?: { territoryContainment?: Record<string, { _contains?: string[] }> } }).supplemental?.territoryContainment?.UN?._contains;
  if (!un) throw new Error("CLDR territoryContainment: no UN grouping — layout changed");
  const out = new Set(un.filter((c) => /^[A-Z]{2}$/.test(c)));
  if (out.size < 185 || out.size > 200) throw new Error(`CLDR UN grouping: ${out.size} members — layout changed`);
  return out;
}

/** Write localized country names (`entity_names`, source cldr) and the current currency (`entity_xrefs` scheme `currency`) and the UN status (scheme `un_status`: `member` or `other`) for country entities. */
export async function enrichCldr(pool: pg.Pool, cacheDir: string, langs = CLDR_LANGS): Promise<{ names: number; currencies: number; un_members: number; attributes: number; locales: number }> {
  const get = async (path: string, name: string) => JSON.parse(await fetchText(`${CLDR_BASE}/${path}`, name, cacheDir)) as unknown;
  const names = new Map<string, Map<string, string>>();
  for (const l of langs) names.set(l, parseTerritories(await get(`cldr-localenames-full/main/${l}/territories.json`, `cldr_terr_${l}.json`), l));
  const currencies = parseCurrencies(await get('cldr-core/supplemental/currencyData.json', 'cldr_currency.json'));
  const unMembers = parseUnMembers(await get('cldr-core/supplemental/territoryContainment.json', 'cldr_containment.json'));
  await pool.query(
    `INSERT INTO sources (id, authority, url, license, attribution, cadence, license_verdict, commercial_use, source_class, retrieved_at)
     VALUES ($1, $2, $3, $4, $5, 'annual', 'green', 'Unicode License v3: use, copy, modify, publish, distribute and sell; copyright notice required', 'community', now())
     ON CONFLICT (id) DO UPDATE SET authority = EXCLUDED.authority, url = EXCLUDED.url, license = EXCLUDED.license, attribution = EXCLUDED.attribution, retrieved_at = now()`,
    [CLDR_SOURCE.id, CLDR_SOURCE.authority, CLDR_SOURCE.url, CLDR_SOURCE.license, CLDR_SOURCE.attribution],
  );
  const countries = (await pool.query(`SELECT id, code FROM entities WHERE kind = 'country'`)).rows as { id: string; code: string }[];
  const client = await pool.connect();
  let n = 0;
  let c = 0;
  let um = 0;
  try {
    await client.query('BEGIN');
    await client.query(`DELETE FROM entity_names WHERE source = 'cldr'`);
    await client.query(`DELETE FROM entity_xrefs WHERE source = 'cldr'`);
    for (const { id, code } of countries) {
      for (const [lang, m] of names) {
        const nm = m.get(code);
        if (nm) {
          await client.query('INSERT INTO entity_names (entity_id, lang, name, source) VALUES ($1, $2, $3, $4)', [id, lang, nm, 'cldr']);
          n++;
        }
      }
      await client.query(`INSERT INTO entity_xrefs (entity_id, scheme, value, source) VALUES ($1, 'un_status', $2, 'cldr')`, [id, unMembers.has(code) ? 'member' : 'other']);
      if (unMembers.has(code)) um++;
      const cur = currencies.get(code);
      if (cur) {
        await client.query(`INSERT INTO entity_xrefs (entity_id, scheme, value, source) VALUES ($1, 'currency', $2, 'cldr')`, [id, cur.join(',')]);
        c++;
      }
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
  const attrs = await enrichCldrAttributes(pool, cacheDir, currencies, langs);
  return { names: n, currencies: c, un_members: um, attributes: attrs.attributes, locales: attrs.locales };
}
