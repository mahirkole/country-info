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

import { parseCsv, parseNuts, parseLau } from '../src/sources/gisco.js';
import { EU27, toIso } from '../src/sources/eu.js';

const NUTS = `CNTR_CODE,NUTS_ID,NAME_LATN,NUTS_NAME,MOUNT_TYPE,URBN_TYPE,COAST_TYPE
DE,DE,Deutschland,Deutschland,0,0,0
DE,DE1,Baden-Württemberg,Baden-Württemberg,0,0,0
DE,DE11,Stuttgart,Stuttgart,0,0,0
DE,DE111,"Stuttgart, Stadtkreis",Stuttgart Stadtkreis,4,1,3
EL,EL3,Attiki,Αττική ,0,0,0
TR,TR1,İstanbul,İstanbul,,,
FR,FRY,RUP FR,RUP FR,0,0,0
CH,CH0,Schweiz,Schweiz,0,0,0
`;

describe('gisco', () => {
  it('has 27 EU members', () => expect(new Set(EU27).size).toBe(27));
  it('parses quoted csv', () => expect(parseCsv(NUTS).find((r) => r['NUTS_ID'] === 'DE111')!['NAME_LATN']).toBe('Stuttgart, Stadtkreis'));
  it('builds the NUTS hierarchy, maps EL->GR, drops out-of-scope countries', () => {
    const e = parseNuts(NUTS, new Set([...EU27, 'TR']));
    expect(e.map((x) => x.id)).toEqual(['nuts:DE1', 'nuts:DE11', 'nuts:DE111', 'nuts:EL3', 'nuts:TR1', 'nuts:FRY']);
    expect(e.find((x) => x.id === 'nuts:DE1')).toMatchObject({ kind: 'nuts1', parent_id: 'country:DE' });
    expect(e.find((x) => x.id === 'nuts:DE11')).toMatchObject({ kind: 'nuts2', parent_id: 'nuts:DE1' });
    expect(e.find((x) => x.id === 'nuts:DE111')).toMatchObject({ kind: 'nuts3', parent_id: 'nuts:DE11', name: 'Stuttgart Stadtkreis' });
    expect(e.find((x) => x.id === 'nuts:EL3')).toMatchObject({ country_code: 'GR', name: 'Αττική', code: 'EL3', parent_id: 'country:GR' });
    expect(toIso('EL')).toBe('GR');
  });
  it('parses LAU', () => {
    const l = parseLau('GISCO_ID,CNTR_CODE,LAU_NAME,POP_2024,POP_DENS_2024,AREA_KM2,YEAR\nAT_90001,AT,Wien,1900000,4500,414.6,2024\nAL_AL141,AL,Kurbin,0,0,269,2024\n', new Set(EU27));
    expect(l).toHaveLength(1);
    expect(l[0]).toMatchObject({ id: 'lau:AT_90001', kind: 'lau', parent_id: 'country:AT', code: '90001', data: { population: 1900000 } });
  });
});
