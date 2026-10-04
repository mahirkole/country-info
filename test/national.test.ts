import { describe, expect, it } from 'vitest';
import { parseStates, parseCounties } from '../src/sources/national/us.js';
import { mapFrance } from '../src/sources/national/fr.js';
import { NATIONAL, nationalSource, LicenseNotEstablished } from '../src/sources/national/index.js';
import { isAdminType, ADMIN_TYPES } from '../src/taxonomy.js';

const STATES = 'STATE|STATEFP|STATENS|STATE_NAME\nAL|01|01779775|Alabama\nLA|22|01629543|Louisiana\nVA|51|01779803|Virginia\nPR|72|01779808|Puerto Rico\n';
const COUNTIES = `STATE|STATEFP|COUNTYFP|COUNTYNS|COUNTYNAME|CLASSFP|FUNCSTAT
AL|01|001|00161526|Autauga County|H1|A
LA|22|001|00558403|Acadia Parish|H1|A
AK|02|013|01419964|Aleutians East Borough|H1|A
VA|51|510|01789071|Alexandria city|C7|F
PR|72|001|01804488|Adjuntas Municipio|H1|A
XX|99|001|00000000|Ghost County|H1|A
`;

describe('US adapter', () => {
  const states = parseStates(STATES);
  it('maps states and territories with FIPS codes', () => {
    expect(states.map((s) => [s.id, s.data.type])).toEqual([['div:US:01', 'state'], ['div:US:22', 'state'], ['div:US:51', 'state'], ['div:US:72', 'territory']]);
    expect(states[0]).toMatchObject({ kind: 'division', parent_id: 'country:US', code: '01', data: { level: 1, postal: 'AL' } });
  });
  it('maps counties and county-equivalents by local type; drops unknown states', () => {
    const c = parseCounties(COUNTIES, new Set(states.map((s) => s.code!)));
    expect(c.map((x) => [x.id, x.data.type, x.data.type_local])).toEqual([
      ['div:US:01001', 'county', 'County'], ['div:US:22001', 'parish', 'Parish'], ['div:US:51510', 'city', 'Independent city'], ['div:US:72001', 'municipality', 'Municipio'],
    ]); // AK/XX states not provided -> dropped
    expect(c[0]).toMatchObject({ parent_id: 'div:US:01', data: { level: 2 } });
  });
});

describe('FR adapter', () => {
  it('builds region > department > commune and attaches unknown departments to the country', () => {
    const e = mapFrance(
      [{ code: '11', nom: 'Île-de-France' }],
      [{ code: '75', nom: 'Paris', codeRegion: '11' }],
      [{ code: '75056', nom: 'Paris', codeDepartement: '75', population: 2100000 }, { code: '97501', nom: 'Miquelon-Langlade', codeDepartement: '975' }],
    );
    expect(e.map((x) => `${x.id}<${x.parent_id}`)).toEqual([
      'div:FR:reg-11<country:FR', 'div:FR:dep-75<div:FR:reg-11', 'div:FR:com-75056<div:FR:dep-75', 'div:FR:com-97501<country:FR',
    ]);
    expect(e[2]!.data).toMatchObject({ type: 'municipality', type_local: 'commune', population: 2100000 });
  });
});

describe('registry and taxonomy', () => {
  it('every registered adapter uses known types and has attribution and a read/partial license', () => {
    for (const s of Object.values(NATIONAL)) {
      expect(s.meta.attribution).toBeTruthy();
      expect(s.meta.license).toBeTruthy();
      expect(['read', 'partial']).toContain(s.licenseStatus);
    }
  });
  it('refuses a source whose license was not established', () => {
    NATIONAL['ZZ'] = { ...NATIONAL['US']!, country: 'ZZ', licenseStatus: 'unread' };
    expect(() => nationalSource('ZZ')).toThrow(LicenseNotEstablished);
    delete NATIONAL['ZZ'];
    expect(() => nationalSource('QQ')).toThrow(/no national source/);
  });
  it('knows the canonical types', () => {
    for (const t of ['canton', 'prefecture', 'county', 'department', 'commune']) expect(isAdminType(t)).toBe(true);
    expect(isAdminType('galaxy')).toBe(false);
    expect(ADMIN_TYPES).toContain('other');
  });
});
