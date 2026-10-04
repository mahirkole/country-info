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

describe('TR data file', () => {
  it('compiles 2026 with expected dates, half days and provenance', async () => {
    const tr = (await loadHolidayFiles()).find((f) => f.country === 'TR')!;
    const h = compileHolidays(tr, 2026, 2026);
    const dates = (type: string) => h.filter((x) => x.data.type === type).map((x) => x.data.date);
    expect(dates('public')).toEqual(expect.arrayContaining(['2026-01-01', '2026-03-20', '2026-03-22', '2026-05-27', '2026-05-30', '2026-07-15', '2026-10-29']));
    expect(dates('public')).toHaveLength(8 + 3 + 4 - 1); // 7 fixed national days + 3 Ramazan + 4 Kurban
    expect(dates('half_day').sort()).toEqual(['2026-03-19', '2026-05-26', '2026-10-28']);
    for (const x of h) expect((x.data.source as { citation: string }).citation).toBeTruthy();
    expect(h.every((x) => x.data.verification === 'unverified')).toBe(true);
  });
  it('does not emit 15 Temmuz before 2017', async () => {
    const tr = (await loadHolidayFiles()).find((f) => f.country === 'TR')!;
    expect(compileHolidays(tr, 2016, 2016).some((x) => x.code === 'demokrasi-ve-milli-birlik-gunu')).toBe(false);
  });
});
