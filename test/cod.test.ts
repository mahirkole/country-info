import { describe, expect, it } from 'vitest';
import { checkCodCounts, codEntities, denyReason, parseCodMetadata, parseCodWorkbook, sourceSha } from '../src/sources/cod.js';
import { isAdminType } from '../src/taxonomy.js';

const META = `country_name,country_iso2,country_iso3,version,admin_level_full,admin_1_name,admin_2_name,admin_3_name,admin_1_count,admin_2_count,admin_3_count,date_updated,source,methodology_dataset,caveats
Kenya,KE,KEN,v01,2,County,Sub-county,,2,3,,2026-01-01,IEBC,"Fixed by OCHA",
Turkiye,TR,TUR,v01,2,Province,District,,1,1,,2026-01-01,General Command of Mapping,"shared for humanitarian use only",
Chadia,TD,TCD,v01,1,Region,,,1,,,2026-01-01,UNICEF country office,,
Polonia,PL,POL,v01,2,Voivodeship,Powiat,,1,1,,2026-01-01,State register,"Provided by UNHCR from OSM PRG",
Zeroland,ZZ,ZZZ,v01,0,,,,0,,,2026-01-01,Bureau,,
`;

const modern = [
  { name: 'ken_admin1', rows: [['adm1_name', 'adm1_name1', 'adm1_pcode', 'valid_to'], ['Baringo', '', 'KE030', ''], ['Old', '', 'KE999', '2020-01-01'], ['Kisumu', 'Kisumu-alt', 'KE042', '']] },
  { name: 'ken_admin2', rows: [['adm2_name', 'adm2_pcode', 'adm1_pcode', 'valid_to'], ['Ainabkoi', 'KE027144', 'KE030', ''], ['Seme', 'KE042001', 'KE042', ''], ['Muhoroni', 'KE042002', 'KE042', '']] },
  { name: 'ken_adminlines', rows: [['adm_level', 'name'], ['1', 'x']] },
];
const legacy = [
  { name: 'ADM1', rows: [['ADM1_ES', 'ADM1_PCODE', 'VALIDTO'], ['Amazonas', 'CO91', '']] },
];

describe('COD-AB metadata and eligibility', () => {
  const m = parseCodMetadata(META);
  it('parses the global metadata file (BOM-free CSV, quoted notes)', () => {
    expect(m.map((c) => c.iso2)).toEqual(['KE', 'TR', 'TD', 'PL', 'ZZ']);
    expect(m[0]).toMatchObject({ iso3: 'ken', levelFull: 2, counts: [2, 3, 0], levelNames: ['County', 'Sub-county', ''], source: 'IEBC' });
  });
  it('rejects a metadata file whose columns changed', () => {
    expect(() => parseCodMetadata('a,b\n1,2\n')).toThrow(/layout changed/);
  });
  it('denies restrictive or non-national upstreams automatically, and only on the right text', () => {
    const by = Object.fromEntries(m.map((c) => [c.iso2, denyReason(c)]));
    expect(by['KE']).toBeNull(); // "Fixed by OCHA" in the methodology is not an upstream
    expect(by['TR']).toMatch(/humanitarian/);
    expect(by['TD']).toMatch(/not a national publisher/);
    expect(by['PL']).toMatch(/OpenStreetMap/);
  });
  it('pins the reviewed upstream text by hash', () => {
    expect(sourceSha(m[0]!)).toMatch(/^[0-9a-f]{64}$/);
    expect(sourceSha(m[0]!)).not.toBe(sourceSha(m[1]!));
  });
});

describe('COD-AB workbook', () => {
  it('reads the modern layout: expired rows dropped, hierarchy kept, alternates collected', () => {
    const units = parseCodWorkbook(modern, 2);
    expect(units.filter((u) => u.level === 1).map((u) => u.pcode)).toEqual(['KE030', 'KE042']);
    expect(units.find((u) => u.pcode === 'KE042')!.names).toEqual([{ name: 'Kisumu-alt', lang: null }]);
    expect(units.find((u) => u.pcode === 'KE042002')).toMatchObject({ level: 2, parent: 'KE042', name: 'Muhoroni' });
  });
  it('reads the legacy ADM<N>_<LANG> layout', () => {
    expect(parseCodWorkbook(legacy, 1)).toMatchObject([{ pcode: 'CO91', name: 'Amazonas', level: 1 }]);
  });
  it('fails loudly on a changed layout, duplicates or a broken hierarchy', () => {
    expect(() => parseCodWorkbook([{ name: 'x_admin1', rows: [['foo', 'bar']] }], 1)).toThrow(/layout changed/);
    expect(() => parseCodWorkbook([{ name: 'ADM1', rows: [['ADM1_ES', 'ADM1_PCODE'], ['A', 'X1'], ['B', 'X1']] }], 1)).toThrow(/duplicate/);
    const broken = [modern[0]!, { name: 'ken_admin2', rows: [['adm2_name', 'adm2_pcode', 'adm1_pcode'], ['Orphan', 'KE1', 'KE404']] }];
    expect(() => parseCodWorkbook(broken, 2)).toThrow(/hierarchy broken/);
  });
  it('compares unit counts with the metadata within tolerance', () => {
    const m = parseCodMetadata(META);
    const units = parseCodWorkbook(modern, 2);
    expect(checkCodCounts(m[0]!, units)).toBeNull();
    expect(checkCodCounts({ ...m[0]!, counts: [2, 30, 0] }, units)).toMatch(/admin2/);
  });
});

describe('COD-AB entities', () => {
  it('maps to division entities with provenance and the common type vocabulary', () => {
    const m = parseCodMetadata(META)[0]!;
    const e = codEntities({ ...m, levelNames: ['Province', 'Sub-county', ''] }, parseCodWorkbook(modern, 2), 'https://data.humdata.org/dataset/cod-ab-ken', 'IEBC');
    expect(e).toHaveLength(5);
    expect(e[0]).toMatchObject({ id: 'div:KE:KE030', kind: 'division', parent_id: 'country:KE', country_code: 'KE', code: 'KE030', data: { level: 1, type: 'province', type_local: 'Province', upstream: 'IEBC', vintage: '2026-01-01' } });
    expect(e.find((x) => x.code === 'KE042001')).toMatchObject({ parent_id: 'div:KE:KE042', data: { level: 2, type: 'other', type_local: 'Sub-county' } });
    expect(e.every((x) => isAdminType(x.data.type as string))).toBe(true);
  });
});

import { parseEvidence, usable, verifyEvidence, pageText } from '../src/sources/cod-evidence.js';

const EV = (o: Record<string, unknown> = {}) => ({ country: 'KE', publisher: 'IEBC', licence_name: 'x', url: 'https://example.org/t', quote: 'may be used for any purpose, including commercial', verdict: 'green', checked_on: '2026-10-06', terms: 'credit IEBC', ...o });

describe('COD-AB upstream licence evidence', () => {
  it('validates the evidence file shape', () => {
    expect(parseEvidence(JSON.stringify([EV()]))).toHaveLength(1);
    expect(() => parseEvidence(JSON.stringify([EV(), EV()]))).toThrow(/duplicate/);
    expect(() => parseEvidence(JSON.stringify([EV({ verdict: 'yes' })]))).toThrow(/verdict/);
    expect(() => parseEvidence(JSON.stringify([EV({ quote: '' })]))).toThrow(/quote is required/);
    expect(() => parseEvidence(JSON.stringify([EV({ url: 'ftp://x' })]))).toThrow(/http/);
    expect(parseEvidence(JSON.stringify([{ country: 'XX', verdict: 'unread' }]))[0]!.verdict).toBe('unread');
  });
  it('only green/amber evidence makes a country loadable', () => {
    const [g, a, r, u] = ['green', 'amber', 'red', 'unread'].map((v) => parseEvidence(JSON.stringify([EV({ verdict: v })]))[0]);
    expect([usable(g), usable(a), usable(r), usable(u), usable(undefined)]).toEqual([true, true, false, false, false]);
  });
  it('second pass: finds the quote through markup/whitespace/quote differences and detects a changed page', async () => {
    const e = parseEvidence(JSON.stringify([EV()]))[0]!;
    const page = '<html><body><p>Data  may be used for any purpose,\n including <b>commercial</b> use.</p></body></html>';
    const first = await verifyEvidence(e, async () => page.replace('any purpose', 'research'));
    expect(first).toMatchObject({ quoteFound: false }); // a quote that is not on the page is never accepted
    const e2 = { ...e, quote: 'may be used for any purpose, including commercial' };
    const ok = await verifyEvidence(e2, async () => page);
    expect(ok.quoteFound).toBe(true);
    const stored = { ...e2, page_sha256: ok.fingerprint! };
    expect((await verifyEvidence(stored, async () => page)).changed).toBe(false);
    expect((await verifyEvidence(stored, async () => page.replace('any purpose', 'non-commercial licence only'))).changed).toBe(true);
    expect((await verifyEvidence(e2, async () => { throw new Error('403'); })).error).toBe('403');
    expect(pageText('a&nbsp;&nbsp;“b”')).toBe('a "b"');
  });
});
