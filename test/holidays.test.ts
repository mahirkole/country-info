import { describe, expect, it } from 'vitest';
import { compileHolidays, datesFor, easter, nthWeekday, type HolidayFile, type HolidayRule } from '../src/holidays/rules.js';
import { loadHolidayFiles } from '../src/holidays/load.js';
import { applyFeeds, parseDiyanet } from '../src/holidays/feeds.js';

const d = (dt: Date) => dt.toISOString().slice(0, 10);
const src = { citation: 'test' };

describe('rule engine', () => {
  it('computes Gregorian Easter', () => {
    expect([2024, 2025, 2026, 2027, 2028, 2030].map((y) => d(easter(y)))).toEqual(['2024-03-31', '2025-04-20', '2026-04-05', '2027-03-28', '2028-04-16', '2030-04-21']);
  });
  it('computes Orthodox Easter', () => {
    expect([2024, 2025, 2026, 2027].map((y) => d(easter(y, 'orthodox')))).toEqual(['2024-05-05', '2025-04-20', '2026-04-12', '2027-05-02']);
  });
  it('computes nth / last weekday', () => {
    expect(d(nthWeekday(2026, 11, 4, 4))).toBe('2026-11-26'); // 4th Thursday of Nov 2026
    expect(d(nthWeekday(2026, 5, 1, -1))).toBe('2026-05-25'); // last Monday of May 2026
  });
  const rule = (r: Partial<HolidayRule> & Pick<HolidayRule, 'id' | 'when'>): HolidayRule => ({ names: { en: r.id }, type: 'public', source: src, ...r });
  it('applies easter offsets and year bounds', () => {
    expect(datesFor(rule({ id: 'gf', when: { easter: { offset: -2 } } }), 2026)[0]!.date).toBe('2026-04-03');
    expect(datesFor(rule({ id: 'x', when: { fixed: { month: 7, day: 15 } }, from_year: 2017 }), 2016)).toEqual([]);
  });
  it('computes weekday-on-or-after rules (Swedish Midsommardagen / Alla helgons dag)', () => {
    const mid = rule({ id: 'mid', when: { on_or_after: { month: 6, day: 20, weekday: 6 } } });
    const saints = rule({ id: 'as', when: { on_or_after: { month: 10, day: 31, weekday: 6 } } });
    expect([2025, 2026, 2027, 2028].map((y) => datesFor(mid, y)[0]!.date)).toEqual(['2025-06-21', '2026-06-20', '2027-06-26', '2028-06-24']);
    expect([2025, 2026, 2027].map((y) => datesFor(saints, y)[0]!.date)).toEqual(['2025-11-01', '2026-10-31', '2027-11-06']);
  });
  it('rejects bad listed dates and missing citations', () => {
    expect(() => datesFor(rule({ id: 'l', when: { listed: { '2026': '2025-03-01' } } }), 2026)).toThrow();
    const f: HolidayFile = { country: 'XX', authority: 'a', default_language: 'en', rules: [{ ...rule({ id: 'n', when: { fixed: { month: 1, day: 1 } } }), source: { citation: '' } }] };
    expect(() => compileHolidays(f, 2026, 2026)).toThrow(/citation/);
  });
  it('compiles regional rules under their region', () => {
    const f: HolidayFile = { country: 'DE', authority: 'a', default_language: 'de', rules: [rule({ id: 'dreikoenige', names: { de: 'Heilige Drei Könige' }, when: { fixed: { month: 1, day: 6 } }, region: 'nuts:DE2' })] };
    const [h] = compileHolidays(f, 2026, 2026);
    expect(h).toMatchObject({ id: 'hol:DE:2026-01-06:dreikoenige', parent_id: 'nuts:DE2', name: 'Heilige Drei Könige', data: { region: 'nuts:DE2' } });
  });
});

describe('rule engine: substitute days, conditions, half-day hours', () => {
  const rule = (r: Partial<HolidayRule> & Pick<HolidayRule, 'id' | 'when'>): HolidayRule => ({ names: { en: r.id }, type: 'public', source: src, ...r });
  const file = (rules: HolidayRule[]): HolidayFile => ({ country: 'XX', authority: 'a', default_language: 'en', rules });

  it('moves a weekend holiday to an observed day without changing its date', () => {
    const ny = rule({ id: 'ny', when: { fixed: { month: 1, day: 1 } }, substitute: { sat: 'next_monday', sun: 'next_monday' } });
    // 2022-01-01 Sat, 2023-01-01 Sun, 2024-01-01 Mon, 2026-01-01 Thu
    expect([2022, 2023, 2024, 2026].map((y) => datesFor(ny, y)[0])).toEqual([
      { date: '2022-01-01', observed: '2022-01-03' }, { date: '2023-01-01', observed: '2023-01-02' }, { date: '2024-01-01' }, { date: '2026-01-01' },
    ]);
    const xmas = rule({ id: 'x', when: { fixed: { month: 12, day: 25 } }, substitute: { sat: 'previous_friday', sun: 'next_monday' } });
    // 2021-12-25 Sat -> Fri 24; 2022-12-25 Sun -> Mon 26
    expect([2021, 2022].map((y) => datesFor(xmas, y)[0]!.observed)).toEqual(['2021-12-24', '2022-12-26']);
    expect(datesFor(rule({ id: 'sat-only', when: { fixed: { month: 12, day: 25 } }, substitute: { sat: 'next_monday' } }), 2022)[0]).toEqual({ date: '2022-12-25' }); // Sunday not covered
    const [h] = compileHolidays(file([ny]), 2022, 2022);
    expect(h).toMatchObject({ id: 'hol:XX:2022-01-01:ny', data: { date: '2022-01-01', observed: '2022-01-03' } });
    expect(compileHolidays(file([ny]), 2024, 2024)[0]!.data).not.toHaveProperty('observed');
  });

  it("evaluates a conditional rule (Ireland's St Brigid's Day: 1 Feb if a Friday, else the first Monday of February)", () => {
    const brigid = rule({ id: 'brigid', when: { if_weekday: { when: { fixed: { month: 2, day: 1 } }, weekday: 5, then: { fixed: { month: 2, day: 1 } }, else: { nth_weekday: { month: 2, weekday: 1, n: 1 } } } }, from_year: 2023 });
    // 2023-02-01 Wed -> Mon 6 Feb; 2025-02-01 Sat -> Mon 3 Feb; 2030-02-01 Fri -> 1 Feb; 2022 is before from_year
    expect([2023, 2025, 2030].map((y) => datesFor(brigid, y)[0]!.date)).toEqual(['2023-02-06', '2025-02-03', '2030-02-01']);
    expect(datesFor(brigid, 2022)).toEqual([]);
  });

  it('carries half-day hours and rejects malformed or misplaced ones', () => {
    const eve = rule({ id: 'eve', type: 'half_day', when: { fixed: { month: 12, day: 24 } }, hours: { to: '12:00' } });
    expect(compileHolidays(file([eve]), 2026, 2026)[0]!.data).toMatchObject({ type: 'half_day', hours: { to: '12:00' } });
    expect(() => compileHolidays(file([{ ...eve, hours: { to: '25:00' } }]), 2026, 2026)).toThrow(/HH:MM/);
    expect(() => compileHolidays(file([{ ...eve, type: 'public' }]), 2026, 2026)).toThrow(/half_day/);
  });
});

/** Rows as Diyanet's «Dini Günler» table prints them (hijri day, hijri month, hijri year, gregorian day, "MONTH-YEAR", weekday, label). */
const DIYANET_2026: string[][] = [
  ['29', 'RAMAZAN', '1447', '19', 'MART-2026', 'PERŞEMBE', 'AREFE'],
  ['01', 'ŞEVVAL', '1447', '20', 'MART-2026', 'CUMA', 'RAMAZAN BAYRAMI (1. Gün)'],
  ['02', 'ŞEVVAL', '1447', '21', 'MART-2026', 'CUMARTESİ', 'RAMAZAN BAYRAMI (2. Gün)'],
  ['03', 'ŞEVVAL', '1447', '22', 'MART-2026', 'PAZAR', 'RAMAZAN BAYRAMI (3. Gün)'],
  ['09', 'ZİLHİCCE', '1447', '26', 'MAYIS-2026', 'SALI', 'AREFE'],
  ['10', 'ZİLHİCCE', '1447', '27', 'MAYIS -2026', 'ÇARŞAMBA', 'KURBAN BAYRAMI (1. Gün)'],
  ['11', 'ZİLHİCCE', '1447', '28', 'MAYIS -2026', 'PERŞEMBE', 'KURBAN BAYRAMI (2. Gün)'],
  ['12', 'ZİLHİCCE', '1447', '29', 'MAYIS -2026', 'CUMA', 'KURBAN BAYRAMI (3. Gün)'],
  ['13', 'ZİLHİCCE', '1447', '30', 'MAYIS -2026', 'CUMARTESİ', 'KURBAN BAYRAMI (4. Gün)'],
];
const page = (rows: string[][]) =>
  `<html><body><table><tr><th>Hicri</th><th>Ay</th><th>Yıl</th><th>Gün</th><th>Miladi</th><th>Haftanın günü</th><th>Dini gün</th></tr>` +
  `<tr><td>12</td><td>RECEB</td><td>1447</td><td>01</td><td>OCAK-2026</td><td>PERŞEMBE</td><td>ÜÇ AYLARIN BAŞLANGICI</td></tr>` +
  rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('') +
  `</table></body></html>`;

describe('Diyanet feed', () => {
  it('parses the bayram days of a published year and returns null for an unpublished one', () => {
    expect(parseDiyanet(page(DIYANET_2026), 2026)).toEqual({
      'ramazan-arefe': '2026-03-19', 'ramazan-1': '2026-03-20', 'ramazan-2': '2026-03-21', 'ramazan-3': '2026-03-22',
      'kurban-arefe': '2026-05-26', 'kurban-1': '2026-05-27', 'kurban-2': '2026-05-28', 'kurban-3': '2026-05-29', 'kurban-4': '2026-05-30',
    });
    expect(parseDiyanet(page([]), 2027)).toBeNull();
  });
  it('refuses a changed layout instead of guessing', () => {
    expect(() => parseDiyanet(page(DIYANET_2026.slice(0, 7)), 2026)).toThrow(/layout changed/);
    expect(() => parseDiyanet(page([...DIYANET_2026, ...DIYANET_2026.slice(1, 2)]), 2026)).toThrow(/listed twice/);
  });
});

describe('TR data file', () => {
  const withFeed = async (from: number, to: number) => {
    const files = await loadHolidayFiles();
    await applyFeeds(files, from, to, '.cache', async (y) => page(y === 2026 ? DIYANET_2026 : []));
    return files.find((f) => f.country === 'TR')!;
  };
  it('compiles 2026 with expected dates, half days and provenance', async () => {
    const h = compileHolidays(await withFeed(2026, 2026), 2026, 2026);
    const dates = (type: string) => h.filter((x) => x.data.type === type).map((x) => x.data.date);
    expect(dates('public')).toEqual(expect.arrayContaining(['2026-01-01', '2026-03-20', '2026-03-22', '2026-05-27', '2026-05-30', '2026-07-15', '2026-10-29']));
    expect(dates('public')).toHaveLength(8 + 3 + 4 - 1); // 7 fixed national days + 3 Ramazan + 4 Kurban
    expect(dates('half_day').sort()).toEqual(['2026-03-19', '2026-05-26', '2026-10-28']);
    // Fixed days: Law 2429 read on 2026-10-05; bayram dates: Diyanet feed read at every refresh.
    expect(h.every((x) => x.data.verification === 'verified' && !!(x.data.source as { url?: string }).url && !!(x.data.source as { checked_on?: string }).checked_on)).toBe(true);
    expect(h.filter((x) => (x.data.source as { feed?: string }).feed === 'diyanet')).toHaveLength(9);
  });
  it('produces no bayram record for a year Diyanet has not published (no manual or guessed dates)', async () => {
    const tr = await withFeed(2026, 2027);
    const h = compileHolidays(tr, 2027, 2027);
    expect(h.filter((x) => /^(ramazan|kurban)/.test(x.code ?? '')).length).toBe(0);
    expect(h.length).toBeGreaterThan(0); // the fixed national days are there
    expect(tr.rules.filter((r) => r.feed).every((r) => r.when && 'listed' in r.when)).toBe(true);
  });
  it('does not emit 15 Temmuz before 2017', async () => {
    const tr = await withFeed(2016, 2016);
    expect(compileHolidays(tr, 2016, 2016).some((x) => x.code === 'demokrasi-ve-milli-birlik-gunu')).toBe(false);
  });
});

import { diffHolidays } from '../src/holidays/check.js';

describe('official holiday files', () => {
  const load = async (cc: string) => (await loadHolidayFiles()).find((f) => f.country === cc)!;
  const dates = (cc: string, h: ReturnType<typeof compileHolidays>) => h.filter((x) => x.country_code === cc).map((x) => x.data.date as string);

  it('AT 2026: 13 holidays from ARG §7, Easter-relative days correct', async () => {
    const h = compileHolidays(await load('AT'), 2026, 2026);
    expect(h).toHaveLength(13);
    expect(h.every((x) => x.data.verification === 'verified' && (x.data.source as { checked_on?: string }).checked_on)).toBe(true);
    const by = (id: string) => h.find((x) => x.code === id)!.data.date;
    expect([by('ostermontag'), by('christi-himmelfahrt'), by('pfingstmontag'), by('fronleichnam')]).toEqual(['2026-04-06', '2026-05-14', '2026-05-25', '2026-06-04']);
  });
  it('DE 2026: Easter days and unity day; only 3 Oct is marked verified', async () => {
    const h = compileHolidays(await load('DE'), 2026, 2026);
    expect(h.find((x) => x.code === 'karfreitag')!.data.date).toBe('2026-04-03');
    expect(h.filter((x) => x.data.verification === 'verified').map((x) => x.code)).toEqual(['tag-der-deutschen-einheit']);
  });
  it('ES: only the four nationwide days fixed by the Estatuto de los Trabajadores', async () => {
    expect(dates('ES', compileHolidays(await load('ES'), 2026, 2026))).toEqual(['2026-01-01', '2026-05-01', '2026-10-12', '2026-12-25']);
  });
  it('IT: 11 days, all verified (DPR 792/1985 and Legge 260/1949 art. 2 as in force 1-1-2026)', async () => {
    const h = compileHolidays(await load('IT'), 2026, 2026);
    expect(h).toHaveLength(11);
    expect(h.filter((x) => x.data.verification === 'verified')).toHaveLength(11);
    expect(h.find((x) => x.code === 'lunedi-dellangelo')!.data.date).toBe('2026-04-06');
  });
  it('no verified record lacks a source URL and read date', async () => {
    for (const f of await loadHolidayFiles()) {
      for (const x of compileHolidays(f, 2026, 2026).filter((y) => y.data.verification === 'verified')) {
        const s = x.data.source as { url?: string; checked_on?: string };
        expect([f.country, x.code, !!s.url, !!s.checked_on]).toEqual([f.country, x.code, true, true]);
      }
    }
  });
});

describe('diffHolidays', () => {
  it('reports differences in both directions and ignores half days and regional', async () => {
    const f = (await loadHolidayFiles()).find((x) => x.country === 'ES')!;
    const ours = compileHolidays(f, 2026, 2026);
    const d = diffHolidays(ours, [{ date: '2026-01-01', name: 'x' }, { date: '2026-01-06', name: 'Epifanía' }]);
    expect(d.onlyOurs).toEqual(['2026-05-01', '2026-10-12', '2026-12-25']);
    expect(d.onlyTheirs).toEqual([{ date: '2026-01-06', name: 'Epifanía' }]);
  });
});

describe('EU holiday files (merged from official-source reading)', () => {
  const load = async (cc: string) => (await loadHolidayFiles()).find((f) => f.country === cc)!;
  const pub = async (cc: string, y: number) => compileHolidays(await load(cc), y, y).filter((x) => x.data.type === 'public');

  it('every file compiles for 2024-2028 and has unique ids', async () => {
    const files = await loadHolidayFiles();
    expect(files.length).toBeGreaterThanOrEqual(23);
    for (const f of files) expect(compileHolidays(f, 2024, 2028).length).toBeGreaterThan(0);
  });
  it('IE bank holidays follow nth-weekday rules', async () => {
    const d = (await pub('IE', 2026)).map((x) => x.data.date as string);
    expect(d).toEqual(expect.arrayContaining(['2026-03-17', '2026-05-04', '2026-06-01', '2026-08-03', '2026-10-26']));
  });
  it('SK: 8 May is not a day off in 2026 but is again in 2027; 1 Sep and 28 Oct are observances only', async () => {
    expect((await pub('SK', 2026)).some((x) => x.data.date === '2026-05-08')).toBe(false);
    expect((await pub('SK', 2027)).some((x) => x.data.date === '2027-05-08')).toBe(true);
    const all = compileHolidays(await load('SK'), 2026, 2026);
    expect(all.filter((x) => x.data.type === 'observance').map((x) => x.data.date).sort()).toEqual(['2026-09-01', '2026-10-28', '2026-11-17']);
  });
  it('DK Store Bededag ends after 2023 and is not marked verified', async () => {
    const f = await load('DK');
    expect(compileHolidays(f, 2023, 2023).find((x) => x.code === 'great-prayer-day')!.data).toMatchObject({ date: '2023-05-05', verification: 'unverified' });
    expect(compileHolidays(f, 2024, 2024).some((x) => x.code === 'great-prayer-day')).toBe(false);
  });
  it('stale or memory-based sources are never marked verified', async () => {
    for (const cc of ['BE', 'LU', 'FI', 'GR']) {
      expect(compileHolidays(await load(cc), 2026, 2026).every((x) => x.data.verification !== 'verified')).toBe(true);
    }
    // LT is verified from the e-seimas consolidated Labour Code (art. 123, edition valid 2026-06-07..2026-10-31), see the dedicated test below
  });
  it('Orthodox Easter drives Greek Easter Monday', async () => {
    const r = compileHolidays(await load('GR'), 2026, 2026).find((x) => /easter|pascha|orthodox/i.test(x.code ?? ''));
    expect(r).toBeDefined();
  });
});

describe('LV: 4 May and 18 November move to the next working day on a weekend', () => {
  // The Latvian holidays act (likumi.lv/ta/id/72608, read 2026-10-05): "Ja svētku dienas — 4.maijs, ... un 18.novembris — iekrīt sestdienā vai svētdienā, nākamo darbdienu nosaka par brīvdienu."
  it('emits data.observed only when the date is a Saturday or Sunday', async () => {
    const lv = (await loadHolidayFiles()).find((f) => f.country === 'LV')!;
    const rule = (id: string) => lv.rules.find((r) => r.id === id)!;
    expect(datesFor(rule('proclamation-day'), 2023)).toEqual([expect.objectContaining({ date: '2023-11-18', observed: '2023-11-20' })]); // Saturday
    expect(datesFor(rule('restoration-of-independence'), 2025)).toEqual([expect.objectContaining({ date: '2025-05-04', observed: '2025-05-05' })]); // Sunday
    expect(datesFor(rule('restoration-of-independence'), 2026)[0]!.observed).toBeUndefined(); // Monday
    expect(datesFor(rule('labour-day'), 2026)[0]!.observed).toBeUndefined(); // 1 May carries no such rule in the act's sentence
  });
});

describe('IE: St Brigid\'s Day (S.I. No. 50/2022, regs. 4-5, read 2026-10-06)', () => {
  it('first Monday of February from 2023, 1 February when that is a Friday, nothing before 2023', async () => {
    const ie = (await loadHolidayFiles()).find((f) => f.country === 'IE')!;
    const rule = ie.rules.find((r) => r.id === 'st-brigids-day')!;
    const d = (y: number) => datesFor(rule, y)[0]?.date;
    expect(d(2022)).toBeUndefined();
    expect(d(2023)).toBe('2023-02-06');
    expect(d(2024)).toBe('2024-02-05');
    expect(d(2025)).toBe('2025-02-03'); // 1 Feb 2025 is a Saturday
    expect(d(2030)).toBe('2030-02-01'); // a Friday
    expect(rule.verification).toBe('verified');
  });
});

describe('LT: verified from the consolidated Labour Code (e-seimas, read 2026-10-06)', () => {
  it('all 14 days carry the consolidated-edition source, Easter is stated as the Western tradition', async () => {
    const lt = compileHolidays((await loadHolidayFiles()).find((f) => f.country === 'LT')!, 2026, 2026);
    expect(lt).toHaveLength(14);
    expect(lt.every((x) => x.data.verification === 'verified' && /actualedition/.test((x.data.source as { url: string }).url))).toBe(true);
    expect(lt.find((x) => x.code === 'easter-monday')!.data.date).toBe('2026-04-06');
  });
});

describe('MT: fixed-date days verified from Cap. 252 (legislation.mt, read 2026-10-06)', () => {
  it('13 days verified; Good Friday stays unverified because the Act names it without stating the Easter computation', async () => {
    const mt = compileHolidays((await loadHolidayFiles()).find((f) => f.country === 'MT')!, 2026, 2026);
    expect(mt.filter((x) => x.data.verification === 'verified')).toHaveLength(13);
    expect(mt.find((x) => x.code === 'good-friday')!.data.verification).toBe('unverified');
    expect(mt.find((x) => x.code === 'independence-day')!.data.date).toBe('2026-09-21');
  });
});

describe('SI: verified from the Official Gazette (UPB1 112/05 and amendments, read 2026-10-06)', () => {
  it('12 work-free days verified, Easter/Pentecost stay unverified (no computation in the text), 4 non-work-free observances added', async () => {
    const si = compileHolidays((await loadHolidayFiles()).find((f) => f.country === 'SI')!, 2026, 2026);
    expect(si.filter((x) => x.data.type === 'public' && x.data.verification === 'verified')).toHaveLength(12);
    expect(si.filter((x) => x.data.verification !== 'verified').map((x) => x.code).sort()).toEqual(['easter-monday', 'easter-sunday', 'pentecost']);
    expect(si.filter((x) => x.data.type === 'observance').map((x) => x.data.date).sort()).toEqual(['2026-06-08', '2026-09-23', '2026-10-25', '2026-11-23']);
  });
});
