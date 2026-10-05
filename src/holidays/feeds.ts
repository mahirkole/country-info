import { fetchText } from '../sources/fetch.js';
import type { HolidayFile } from './rules.js';

/**
 * Automated holiday feeds: dates that change every year and are published by an official body are read from that body at each
 * refresh instead of being typed into `data/holidays/*.json` by hand. A rule opts in with `"feed": "diyanet:<day>"`
 * (and an empty `"when": { "listed": {} }`); years the publisher has not released yet simply yield no record.
 */
export const DIYANET_DAYS = ['ramazan-arefe', 'ramazan-1', 'ramazan-2', 'ramazan-3', 'kurban-arefe', 'kurban-1', 'kurban-2', 'kurban-3', 'kurban-4'] as const;
export type DiyanetDay = (typeof DIYANET_DAYS)[number];

const MONTHS: Record<string, number> = { OCAK: 1, ŞUBAT: 2, MART: 3, NİSAN: 4, MAYIS: 5, HAZİRAN: 6, TEMMUZ: 7, AĞUSTOS: 8, EYLÜL: 9, EKİM: 10, KASIM: 11, ARALIK: 12 };
const URL = (year: number) => `https://vakithesaplama.diyanet.gov.tr/dinigunler.php?yil=${year}`;

/**
 * Parse the «Dini Günler» table of Diyanet's Vakit Hesaplama page. Rows look like
 * `[hijri day, hijri month, hijri year, gregorian day, "NİSAN-2024", weekday, "RAMAZAN BAYRAMI (1. Gün)"]` (month and year are one cell).
 * Returns null when the page lists no bayram (the year is not published yet); throws when it lists some but not all nine days.
 */
export function parseDiyanet(html: string, year: number): Record<DiyanetDay, string> | null {
  const out: Partial<Record<DiyanetDay, string>> = {};
  let arefe = 0; // the first AREFE row belongs to Ramazan, the second to Kurban
  for (const row of html.match(/<tr[^>]*>[\s\S]*?<\/tr>/g) ?? []) {
    const cells = [...row.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map((m) => m[1]!.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim());
    if (cells.length < 7) continue;
    const label = cells[6]!.toLocaleUpperCase('tr-TR');
    const m = /^([A-ZÇĞİÖŞÜ]+)\s*-\s*(\d{4})$/.exec(cells[4]!.toLocaleUpperCase('tr-TR'));
    if (!m || !MONTHS[m[1]!] || !/^\d{1,2}$/.test(cells[3]!)) continue;
    const date = `${m[2]}-${String(MONTHS[m[1]!]).padStart(2, '0')}-${cells[3]!.padStart(2, '0')}`;
    let day: DiyanetDay | null = null;
    if (label === 'AREFE') day = arefe++ === 0 ? 'ramazan-arefe' : 'kurban-arefe';
    else {
      const b = /^(RAMAZAN|KURBAN) BAYRAMI \((\d)\. GÜN\)$/.exec(label);
      if (b) day = `${b[1] === 'RAMAZAN' ? 'ramazan' : 'kurban'}-${b[2]}` as DiyanetDay;
    }
    if (!day) continue;
    if (out[day]) throw new Error(`Diyanet ${year}: ${day} listed twice (a year with two bayram periods is not modelled)`);
    out[day] = date;
  }
  const found = Object.keys(out).length;
  if (found === 0) return null;
  if (found !== DIYANET_DAYS.length) throw new Error(`Diyanet ${year}: ${found} of ${DIYANET_DAYS.length} bayram days found — page layout changed`);
  return out as Record<DiyanetDay, string>;
}

export type DiyanetFetch = (year: number) => Promise<string>;

/** Fill the `listed` dates of every rule that carries a `diyanet:` feed, for the given years. */
export async function applyFeeds(files: HolidayFile[], fromYear: number, toYear: number, cacheDir: string, get: DiyanetFetch = (y) => fetchText(URL(y), `diyanet_${y}.html`, cacheDir, undefined, { 'user-agent': 'Mozilla/5.0 (compatible; country-info)' })): Promise<void> {
  const feedRules = files.flatMap((f) => f.rules.filter((r) => r.feed?.startsWith('diyanet:')));
  if (feedRules.length === 0) return;
  const days = new Map<number, Record<DiyanetDay, string>>();
  for (let y = fromYear; y <= toYear; y++) {
    const d = parseDiyanet(await get(y), y);
    if (d) days.set(y, d);
  }
  for (const r of feedRules) {
    const day = r.feed!.slice('diyanet:'.length) as DiyanetDay;
    if (!DIYANET_DAYS.includes(day)) throw new Error(`rule ${r.id}: unknown Diyanet day ${day}`);
    r.when = { listed: Object.fromEntries([...days].map(([y, d]) => [String(y), d[day]])) };
  }
}
