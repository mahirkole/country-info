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
