import type { EntityInput } from '../model.js';

export type Verification = 'verified' | 'unverified' | 'tentative';

export type When =
  | { fixed: { month: number; day: number } }
  | { easter: { offset: number; calendar?: 'gregorian' | 'orthodox' } }
  | { nth_weekday: { month: number; weekday: number; n: number } } // weekday 0=Sun..6=Sat; n=-1 means last
  | { listed: Record<string, string | { date: string; verification: Verification }> }; // year -> date

export interface HolidayRule {
  id: string;
  names: Record<string, string>;
  type: 'public' | 'half_day' | 'observance';
  when: When;
  /** `checked_on` (ISO date) is set only when the cited text was actually read from the official source. */
  source: { citation: string; url?: string; checked_on?: string };
  verification?: Verification;
  /** Entity id of the region (e.g. `nuts:DE2`) this holiday is limited to; omit for nationwide. */
  region?: string;
  from_year?: number;
  to_year?: number;
}

export interface HolidayFile {
  country: string;
  authority: string;
  default_language: string;
  rules: HolidayRule[];
}

const iso = (y: number, m: number, d: number) => `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d));
const fmt = (dt: Date) => iso(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
const addDays = (dt: Date, n: number) => new Date(dt.getTime() + n * 86_400_000);

/** Easter Sunday (Gregorian: anonymous algorithm; Orthodox: Meeus Julian algorithm + 13 days, valid 1900–2099). */
export function easter(year: number, calendar: 'gregorian' | 'orthodox' = 'gregorian'): Date {
  if (calendar === 'orthodox') {
    const a = year % 4, b = year % 7, c = year % 19;
    const d = (19 * c + 15) % 30;
    const e = (2 * a + 4 * b - d + 34) % 7;
    const month = Math.floor((d + e + 114) / 31);
    const day = ((d + e + 114) % 31) + 1;
    return addDays(utc(year, month, day), 13);
  }
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return utc(year, month, day);
}

export function nthWeekday(year: number, month: number, weekday: number, n: number): Date {
  if (n > 0) {
    const first = utc(year, month, 1);
    const delta = (weekday - first.getUTCDay() + 7) % 7;
    return addDays(first, delta + (n - 1) * 7);
  }
  const last = utc(year, month + 1, 0); // day 0 of next month = last day
  const delta = (last.getUTCDay() - weekday + 7) % 7;
  return addDays(last, -delta);
}

/** Dates (and per-date verification overrides) a rule yields for `year`. */
export function datesFor(rule: HolidayRule, year: number): { date: string; verification?: Verification }[] {
  if ((rule.from_year && year < rule.from_year) || (rule.to_year && year > rule.to_year)) return [];
  const w = rule.when;
  if ('fixed' in w) {
    const dt = utc(year, w.fixed.month, w.fixed.day);
    if (dt.getUTCMonth() + 1 !== w.fixed.month) throw new Error(`rule ${rule.id}: invalid fixed date`);
    return [{ date: fmt(dt) }];
  }
  if ('easter' in w) return [{ date: fmt(addDays(easter(year, w.easter.calendar), w.easter.offset)) }];
  if ('nth_weekday' in w) return [{ date: fmt(nthWeekday(year, w.nth_weekday.month, w.nth_weekday.weekday, w.nth_weekday.n)) }];
  const v = w.listed[String(year)];
  if (v === undefined) return [];
  const { date, verification } = typeof v === 'string' ? { date: v, verification: undefined } : v;
  if (!date.startsWith(`${year}-`) || Number.isNaN(Date.parse(date))) throw new Error(`rule ${rule.id}: listed date ${date} is not in ${year}`);
  return [{ date, verification }];
}

/** Expand a country's rule file into holiday entities for [fromYear, toYear]. */
export function compileHolidays(file: HolidayFile, fromYear: number, toYear: number): EntityInput[] {
  const cc = file.country.toUpperCase();
  const out: EntityInput[] = [];
  const seenRules = new Set<string>();
  for (const rule of file.rules) {
    if (seenRules.has(rule.id)) throw new Error(`${cc}: duplicate rule id ${rule.id}`);
    seenRules.add(rule.id);
    if (!rule.source?.citation) throw new Error(`${cc}/${rule.id}: source.citation is required`);
    const name = rule.names[file.default_language] ?? rule.names['en'] ?? Object.values(rule.names)[0];
    if (!name) throw new Error(`${cc}/${rule.id}: no name`);
    for (let y = fromYear; y <= toYear; y++) {
      for (const { date, verification } of datesFor(rule, y)) {
        out.push({
          id: `hol:${cc}:${date}:${rule.id}`,
          kind: 'holiday',
          parent_id: rule.region ?? `country:${cc}`,
          country_code: cc,
          code: rule.id,
          name,
          name_ascii: null,
          lat: null,
          lon: null,
          data: {
            date,
            rule_id: rule.id,
            type: rule.type,
            names: rule.names,
            source: { authority: file.authority, ...rule.source },
            verification: verification ?? rule.verification ?? 'unverified',
            ...(rule.region ? { region: rule.region } : {}),
          },
        });
      }
    }
  }
  return out;
}
