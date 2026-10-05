import type pg from 'pg';
import { fetchText } from './fetch.js';
import { CLDR_BASE } from './cldr.js';

/** CLDR files that are keyed by territory; `001` is the world default. */
type Terr<T> = Record<string, T>;
const sup = (json: unknown, key: string): Record<string, unknown> => {
  const v = (json as { supplemental?: Record<string, unknown> }).supplemental?.[key];
  if (!v || typeof v !== 'object') throw new Error(`CLDR ${key}: layout changed`);
  return v as Record<string, unknown>;
};
const pick = <T>(m: Terr<T> | undefined, cc: string): T | undefined => m?.[cc] ?? m?.['001'];

export function cldrVersion(json: unknown): string {
  const v = (json as { supplemental?: { version?: { _cldrVersion?: string } } }).supplemental?.version?._cldrVersion;
  if (!v) throw new Error('CLDR: no version in supplemental file');
  return `CLDR ${v}`;
}

export interface WeekData { first_day: string; weekend_start: string; weekend_end: string; min_days: number }
/** Week conventions per territory (firstDay, weekend, minDays); territories without an entry use the world default `001`. */
export function parseWeek(json: unknown): (cc: string) => WeekData {
  const w = sup(json, 'weekData') as { minDays?: Terr<string>; firstDay?: Terr<string>; weekendStart?: Terr<string>; weekendEnd?: Terr<string> };
  if (!w.firstDay?.['001'] || !w.weekendStart?.['001'] || !w.weekendEnd?.['001'] || !w.minDays?.['001']) throw new Error('CLDR weekData: layout changed');
  return (cc) => ({ first_day: pick(w.firstDay, cc)!, weekend_start: pick(w.weekendStart, cc)!, weekend_end: pick(w.weekendEnd, cc)!, min_days: Number(pick(w.minDays, cc)) });
}

export interface MeasurementData { system: string; paper_size: string; temperature: string }
export function parseMeasurement(json: unknown): (cc: string) => MeasurementData {
  const m = sup(json, 'measurementData') as { measurementSystem?: Terr<string>; paperSize?: Terr<string>; 'measurementSystem-category-temperature'?: Terr<string> };
  if (!m.measurementSystem?.['001'] || !m.paperSize?.['001']) throw new Error('CLDR measurementData: layout changed');
  return (cc) => {
    const system = pick(m.measurementSystem, cc)!;
    return { system, paper_size: pick(m.paperSize, cc)!, temperature: m['measurementSystem-category-temperature']?.[cc] ?? system };
  };
}

const HOUR_CYCLE: Record<string, string> = { H: 'h23', h: 'h12', K: 'h11', k: 'h24' };
export interface TimeData { hour_cycle: string; preferred: string; allowed: string[] }
/** Preferred hour cycle per territory; CLDR lists only territories that differ from the locale default, so unlisted ones are absent. */
export function parseTime(json: unknown): (cc: string) => TimeData | undefined {
  const t = sup(json, 'timeData') as Terr<{ _allowed?: string; _preferred?: string }>;
  if (Object.keys(t).length < 100) throw new Error('CLDR timeData: layout changed');
  return (cc) => {
    const e = t[cc];
    if (!e?._preferred) return undefined;
    return { hour_cycle: HOUR_CYCLE[e._preferred.charAt(0)] ?? e._preferred, preferred: e._preferred, allowed: (e._allowed ?? '').split(' ').filter(Boolean) };
  };
}

export function parseCalendars(json: unknown): (cc: string) => string[] {
  const c = sup(json, 'calendarPreferenceData') as Terr<string[]>;
  if (!c['001']) throw new Error('CLDR calendarPreferenceData: layout changed');
  return (cc) => pick(c, cc)!;
}

type UnitEntry = { unit: string; geq?: number; skeleton?: string };
/** Preferred units per quantity and usage (e.g. mass/person), by territory with `001` fallback. */
export function parseUnits(json: unknown): (cc: string) => Record<string, Record<string, string[]>> {
  const u = sup(json, 'unitPreferenceData') as Record<string, Record<string, Terr<UnitEntry[]>>>;
  if (!u.mass?.default?.['001'] || !u.length) throw new Error('CLDR unitPreferenceData: layout changed');
  return (cc) => {
    const out: Record<string, Record<string, string[]>> = {};
    for (const [quantity, usages] of Object.entries(u)) {
      for (const [usage, byTerr] of Object.entries(usages)) {
        const list = pick(byTerr, cc);
        if (list) (out[quantity] ??= {})[usage] = list.map((e) => e.unit);
      }
    }
    return out;
  };
}

export interface CurrencyFraction { digits: number; rounding: number; cash_digits?: number }
export function parseFractions(json: unknown): Map<string, CurrencyFraction> {
  const f = (sup(json, 'currencyData') as { fractions?: Record<string, { _digits: string; _rounding: string; _cashDigits?: string }> }).fractions;
  if (!f?.DEFAULT) throw new Error('CLDR currencyData fractions: layout changed');
  const out = new Map<string, CurrencyFraction>();
  for (const [c, v] of Object.entries(f)) out.set(c, { digits: Number(v._digits), rounding: Number(v._rounding), ...(v._cashDigits !== undefined ? { cash_digits: Number(v._cashDigits) } : {}) });
  return out;
}

/** Primary locale of a territory from likelySubtags `und-XX` (e.g. `tr-Latn-TR`): language and script. */
export function parseLikely(json: unknown): (cc: string) => { language: string; script: string; locale: string } | undefined {
  const l = sup(json, 'likelySubtags') as Terr<string>;
  if (!l['und-TR']) throw new Error('CLDR likelySubtags: layout changed');
  return (cc) => {
    const v = l[`und-${cc}`];
    if (!v) return undefined;
    const [language, script] = v.split('-');
    return { language: language!, script: script!, locale: language! };
  };
}

export interface LocaleFormats {
  date: Record<string, string>;
  time: Record<string, string>;
  datetime: Record<string, string>;
  numbers: { numbering_system: string; decimal: string; group: string; percent_pattern: string; currency_pattern: string; accounting_pattern?: string };
}
/** Date/time patterns (gregorian) and number symbols/patterns of one locale. */
export function parseLocaleFormats(dates: unknown, numbers: unknown, loc: string): LocaleFormats {
  const g = (dates as { main?: Record<string, { dates?: { calendars?: { gregorian?: { dateFormats?: Record<string, string>; timeFormats?: Record<string, string>; dateTimeFormats?: Record<string, unknown> } } } }> }).main?.[loc]?.dates?.calendars?.gregorian;
  const n = (numbers as { main?: Record<string, { numbers?: Record<string, unknown> }> }).main?.[loc]?.numbers as Record<string, any> | undefined;
  if (!g?.dateFormats?.short || !g.timeFormats?.short || !n?.defaultNumberingSystem) throw new Error(`CLDR ${loc} dates/numbers: layout changed`);
  const ns = n.defaultNumberingSystem as string;
  const sym = n[`symbols-numberSystem-${ns}`];
  const pct = n[`percentFormats-numberSystem-${ns}`]?.standard;
  const cur = n[`currencyFormats-numberSystem-${ns}`];
  if (!sym?.decimal || !pct || !cur?.standard) throw new Error(`CLDR ${loc} numbers: layout changed`);
  const dtf: Record<string, string> = {};
  for (const k of ['full', 'long', 'medium', 'short']) {
    const v = g.dateTimeFormats?.[k];
    if (typeof v === 'string') dtf[k] = v;
  }
  const pick4 = (o: Record<string, string>): Record<string, string> => Object.fromEntries(['full', 'long', 'medium', 'short'].map((k) => [k, o[k]!]));
  return {
    date: pick4(g.dateFormats), time: pick4(g.timeFormats), datetime: dtf,
    numbers: { numbering_system: ns, decimal: sym.decimal, group: sym.group, percent_pattern: pct, currency_pattern: cur.standard, ...(cur.accounting ? { accounting_pattern: cur.accounting } : {}) },
  };
}

export const ATTR_FILES = {
  week: 'cldr-core/supplemental/weekData.json',
  measurement: 'cldr-core/supplemental/measurementData.json',
  time: 'cldr-core/supplemental/timeData.json',
  calendar: 'cldr-core/supplemental/calendarPreferenceData.json',
  units: 'cldr-core/supplemental/unitPreferenceData.json',
  currency: 'cldr-core/supplemental/currencyData.json',
  likely: 'cldr-core/supplemental/likelySubtags.json',
} as const;

/**
 * Write the country attribute groups and per-locale formats (tables entity_attributes / locale_formats, source `cldr`).
 * Everything is read from CLDR at every run; nothing is typed into the code. `currentCurrencies` is the already-parsed tender list per territory.
 */
export async function enrichCldrAttributes(pool: pg.Pool, cacheDir: string, currentCurrencies: Map<string, string[]>, extraLocales: string[] = []): Promise<{ attributes: number; locales: number; vintage: string }> {
  const get = async (path: string, name: string) => JSON.parse(await fetchText(`${CLDR_BASE}/${path}`, name, cacheDir)) as unknown;
  const raw = Object.fromEntries(await Promise.all(Object.entries(ATTR_FILES).map(async ([k, p]) => [k, await get(p, `cldr_${k}.json`)] as const)));
  const vintage = cldrVersion(raw.week);
  const week = parseWeek(raw.week);
  const meas = parseMeasurement(raw.measurement);
  const time = parseTime(raw.time);
  const cals = parseCalendars(raw.calendar);
  const units = parseUnits(raw.units);
  const fractions = parseFractions(raw.currency);
  const likely = parseLikely(raw.likely);

  const countries = (await pool.query(`SELECT id, code FROM entities WHERE kind = 'country'`)).rows as { id: string; code: string }[];
  const locales = new Set(extraLocales);
  const rows: { id: string; grp: string; data: unknown }[] = [];
  for (const { id, code } of countries) {
    const lk = likely(code);
    if (lk) locales.add(lk.locale);
    rows.push({ id, grp: 'week', data: week(code) }, { id, grp: 'measurement', data: meas(code) }, { id, grp: 'calendar', data: { preferred: cals(code) } }, { id, grp: 'units', data: units(code) });
    const t = time(code);
    if (t) rows.push({ id, grp: 'time', data: t });
    const cur = currentCurrencies.get(code);
    if (cur) rows.push({ id, grp: 'currency', data: { codes: cur, primary: cur[0], details: cur.map((c) => ({ code: c, ...(fractions.get(c) ?? fractions.get('DEFAULT')!) })) } });
    if (lk) rows.push({ id, grp: 'locale', data: { default: lk.locale, language: lk.language, script: lk.script } });
  }
  const formats = new Map<string, LocaleFormats>();
  for (const loc of [...locales].sort()) {
    try {
      formats.set(loc, parseLocaleFormats(await get(`cldr-dates-full/main/${loc}/ca-gregorian.json`, `cldr_dates_${loc}.json`), await get(`cldr-numbers-full/main/${loc}/numbers.json`, `cldr_numbers_${loc}.json`), loc));
    } catch (e) {
      if (/layout changed/.test(String(e))) throw e;
      console.warn(`CLDR locale ${loc} skipped: ${(e as Error).message}`); // locale not in cldr-json (404): its countries have no locale formats
    }
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`DELETE FROM entity_attributes WHERE source = 'cldr'`);
    await client.query(`DELETE FROM locale_formats WHERE source = 'cldr'`);
    for (const r of rows) await client.query(`INSERT INTO entity_attributes (entity_id, grp, data, source, vintage) VALUES ($1, $2, $3, 'cldr', $4)`, [r.id, r.grp, JSON.stringify(r.data), vintage]);
    for (const [loc, d] of formats) await client.query(`INSERT INTO locale_formats (locale, data, source, vintage) VALUES ($1, $2, 'cldr', $3)`, [loc, JSON.stringify(d), vintage]);
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
  return { attributes: rows.length, locales: formats.size, vintage };
}
