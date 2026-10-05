import { describe, expect, it } from 'vitest';
import { parseCalendars, parseFractions, parseLikely, parseLocaleFormats, parseMeasurement, parseTime, parseUnits, parseWeek } from '../src/sources/cldr-attrs.js';

const S = (k: string, v: unknown) => ({ supplemental: { version: { _cldrVersion: '48' }, [k]: v } });

describe('cldr attributes', () => {
  it('week falls back to the world default', () => {
    const w = parseWeek(S('weekData', { minDays: { '001': '1', DE: '4' }, firstDay: { '001': 'mon', US: 'sun' }, weekendStart: { '001': 'sat', AF: 'thu' }, weekendEnd: { '001': 'sun', AF: 'fri' } }));
    expect(w('DE')).toEqual({ first_day: 'mon', weekend_start: 'sat', weekend_end: 'sun', min_days: 4 });
    expect(w('US').first_day).toBe('sun');
    expect(w('AF').weekend_start).toBe('thu');
    expect(() => parseWeek(S('weekData', {}))).toThrow(/layout changed/);
  });
  it('measurement: system, paper, temperature override', () => {
    const m = parseMeasurement(S('measurementData', { measurementSystem: { '001': 'metric', US: 'US', GB: 'UK' }, paperSize: { '001': 'A4', US: 'US-Letter' }, 'measurementSystem-category-temperature': { BS: 'US' } }));
    expect(m('GB')).toEqual({ system: 'UK', paper_size: 'A4', temperature: 'UK' });
    expect(m('BS').temperature).toBe('US');
    expect(m('US').paper_size).toBe('US-Letter');
  });
  it('time: hour cycle from the preferred pattern, absent when unlisted', () => {
    const t: Record<string, unknown> = {};
    for (let i = 0; i < 100; i++) t[`X${i}`] = { _allowed: 'H', _preferred: 'H' };
    t.US = { _allowed: 'h hb H hB', _preferred: 'h' };
    const f = parseTime(S('timeData', t));
    expect(f('US')).toMatchObject({ hour_cycle: 'h12', allowed: ['h', 'hb', 'H', 'hB'] });
    expect(f('ZZ')).toBeUndefined();
  });
  it('calendars, units, fractions, likely subtags', () => {
    expect(parseCalendars(S('calendarPreferenceData', { '001': ['gregorian'], AF: ['persian', 'gregorian'] }))('AF')).toEqual(['persian', 'gregorian']);
    const u = parseUnits(S('unitPreferenceData', { mass: { default: { '001': [{ unit: 'kilogram' }], US: [{ unit: 'pound' }] }, person: { '001': [{ unit: 'kilogram' }], GB: [{ unit: 'stone-and-pound' }] } }, length: {} }));
    expect(u('US').mass).toEqual({ default: ['pound'], person: ['kilogram'] });
    expect(u('GB').mass!.person).toEqual(['stone-and-pound']);
    const fr = parseFractions(S('currencyData', { fractions: { DEFAULT: { _rounding: '0', _digits: '2' }, JPY: { _rounding: '0', _digits: '0' }, AMD: { _rounding: '0', _digits: '2', _cashDigits: '0' } } }));
    expect(fr.get('JPY')).toEqual({ digits: 0, rounding: 0 });
    expect(fr.get('AMD')!.cash_digits).toBe(0);
    const l = parseLikely(S('likelySubtags', { 'und-TR': 'tr-Latn-TR', 'und-CH': 'de-Latn-CH' }));
    expect(l('CH')).toEqual({ language: 'de', script: 'Latn', locale: 'de' });
    expect(l('XX')).toBeUndefined();
  });
  it('locale formats', () => {
    const dates = { main: { tr: { dates: { calendars: { gregorian: { dateFormats: { full: 'd MMMM y EEEE', long: 'd MMMM y', medium: 'd MMM y', short: 'd.MM.y' }, timeFormats: { full: 'HH:mm:ss zzzz', long: 'HH:mm:ss z', medium: 'HH:mm:ss', short: 'HH:mm' }, dateTimeFormats: { full: '{1} {0}', short: '{1} {0}' } } } } } } };
    const numbers = { main: { tr: { numbers: { defaultNumberingSystem: 'latn', 'symbols-numberSystem-latn': { decimal: ',', group: '.' }, 'percentFormats-numberSystem-latn': { standard: '%#,##0' }, 'currencyFormats-numberSystem-latn': { standard: '¤#,##0.00' } } } } };
    const f = parseLocaleFormats(dates, numbers, 'tr');
    expect(f.date.short).toBe('d.MM.y');
    expect(f.numbers).toMatchObject({ decimal: ',', group: '.', currency_pattern: '¤#,##0.00' });
    expect(() => parseLocaleFormats({}, numbers, 'tr')).toThrow(/layout changed/);
  });
});
