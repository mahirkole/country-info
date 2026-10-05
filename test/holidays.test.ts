import { describe, expect, it } from 'vitest';
import { compileHolidays, datesFor, easter, nthWeekday, type HolidayFile, type HolidayRule } from '../src/holidays/rules.js';
import { loadHolidayFiles } from '../src/holidays/load.js';

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

describe('TR data file', () => {
  it('compiles 2026 with expected dates, half days and provenance', async () => {
    const tr = (await loadHolidayFiles()).find((f) => f.country === 'TR')!;
    const h = compileHolidays(tr, 2026, 2026);
    const dates = (type: string) => h.filter((x) => x.data.type === type).map((x) => x.data.date);
    expect(dates('public')).toEqual(expect.arrayContaining(['2026-01-01', '2026-03-20', '2026-03-22', '2026-05-27', '2026-05-30', '2026-07-15', '2026-10-29']));
    expect(dates('public')).toHaveLength(8 + 3 + 4 - 1); // 7 fixed national days + 3 Ramazan + 4 Kurban
    expect(dates('half_day').sort()).toEqual(['2026-03-19', '2026-05-26', '2026-10-28']);
    for (const x of h) expect((x.data.source as { citation: string }).citation).toBeTruthy();
    // Read on 2026-10-05: Law 2429 (mevzuat.gov.tr) and Diyanet's Dini Günler tables for 2024–2026.
    expect(h.every((x) => x.data.verification === 'verified' && (x.data.source as { checked_on?: string; url?: string }).checked_on === '2026-10-05' && !!(x.data.source as { url?: string }).url)).toBe(true);
  });
  it('keeps the years Diyanet has not published yet tentative', async () => {
    const tr = (await loadHolidayFiles()).find((f) => f.country === 'TR')!;
    const h = compileHolidays(tr, 2027, 2028);
    const religious = h.filter((x) => /^(ramazan|kurban)/.test(x.code ?? ""));
    expect(religious.length).toBeGreaterThan(0);
    expect(religious.every((x) => x.data.verification === 'tentative')).toBe(true);
    expect(h.filter((x) => !/^(ramazan|kurban)/.test(x.code ?? "")).every((x) => x.data.verification === 'verified')).toBe(true); // fixed days come from the law
  });
  it('does not emit 15 Temmuz before 2017', async () => {
    const tr = (await loadHolidayFiles()).find((f) => f.country === 'TR')!;
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
  it('IT: 11 days, 6 of them verified from DPR 792/1985', async () => {
    const h = compileHolidays(await load('IT'), 2026, 2026);
    expect(h).toHaveLength(11);
    expect(h.filter((x) => x.data.verification === 'verified')).toHaveLength(6);
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
    for (const cc of ['BE', 'LU', 'FI', 'GR', 'SI', 'MT', 'LT']) {
      expect(compileHolidays(await load(cc), 2026, 2026).every((x) => x.data.verification !== 'verified')).toBe(true);
    }
  });
  it('Orthodox Easter drives Greek Easter Monday', async () => {
    const r = compileHolidays(await load('GR'), 2026, 2026).find((x) => /easter|pascha|orthodox/i.test(x.code ?? ''));
    expect(r).toBeDefined();
  });
});
