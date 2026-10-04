import { describe, expect, it } from 'vitest';
import { parseCountryInfo, parseAdmin1, parseAdmin2 } from '../src/sources/geonames.js';
import { UN_MEMBERS, unStatus } from '../src/sources/un.js';
import { changedFields, hashOf } from '../src/ingest.js';
import { csvRow } from '../src/export.js';

const COUNTRY = '# comment\nTR\tTUR\t792\tTU\tTurkey\tAnkara\t780580\t82319724\tAS\t.tr\tTRY\tLira\t90\t#####\t^(\\d{5})$\ttr-TR,ku,ar-SY\t298795\tGE,IQ,IR\t\n';

describe('sources', () => {
  it('has 193 UN members', () => expect(UN_MEMBERS.size).toBe(193));
  it('classifies un status', () => {
    expect([unStatus('TR'), unStatus('VA'), unStatus('TW')]).toEqual(['member', 'observer', 'other']);
  });
  it('parses countryInfo', () => {
    const [c] = parseCountryInfo(COUNTRY);
    expect(c).toMatchObject({ id: 'country:TR', name: 'Turkey', code: 'TR' });
    expect(c!.data).toMatchObject({ iso3: 'TUR', currency: { code: 'TRY', name: 'Lira' }, phone_code: '90', languages: ['tr-TR', 'ku', 'ar-SY'], neighbours: ['GE', 'IQ', 'IR'], un_status: 'member' });
  });
  it('parses admin1 and admin2 hierarchy, dropping orphans', () => {
    const a1 = parseAdmin1('TR.34\tIstanbul\tIstanbul\t745044\n');
    expect(a1[0]).toMatchObject({ id: 'gn:745044', parent_id: 'country:TR', kind: 'admin1' });
    const a2 = parseAdmin2('TR.34.1\tFatih\tFatih\t1\nTR.99.1\tX\tX\t2\n', new Map([['TR.34', 'gn:745044']]));
    expect(a2).toHaveLength(1);
    expect(a2[0]).toMatchObject({ parent_id: 'gn:745044', kind: 'admin2' });
  });
});

describe('diff helpers', () => {
  const base = parseCountryInfo(COUNTRY)[0]!;
  it('hash ignores key order, detects change', () => {
    const reordered = { ...base, data: Object.fromEntries(Object.entries(base.data).reverse()) };
    expect(hashOf(reordered)).toBe(hashOf(base));
    expect(hashOf({ ...base, name: 'Türkiye' })).not.toBe(hashOf(base));
  });
  it('reports nested data fields', () => {
    const after = { ...base, name: 'Türkiye', data: { ...base.data, population: 1 } };
    expect(changedFields(base, after).sort()).toEqual(['data.population', 'name']);
  });
  it('escapes csv', () => expect(csvRow(['a,b', 'c"d', null, 1])).toBe('"a,b","c""d",,1\n'));
});
