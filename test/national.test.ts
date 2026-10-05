import { describe, expect, it } from 'vitest';
import { parseStates, parseCounties } from '../src/sources/national/us.js';
import { mapInsee, findCogFiles, findLatestDownloadPage } from '../src/sources/national/fr.js';
import { parseIstat } from '../src/sources/national/it.js';
import { parseCbs } from '../src/sources/national/nl.js';
import { mapNorway } from '../src/sources/national/no.js';
import { mapSweden, pickLatestTable } from '../src/sources/national/se.js';
import { parseCzso } from '../src/sources/national/cz.js';
import { parseGv } from '../src/sources/national/de.js';
import { parseAustria } from '../src/sources/national/at.js';
import { parseSgc } from '../src/sources/national/ca.js';
import { parseAsgs } from '../src/sources/national/au.js';
import { parseBfs } from '../src/sources/national/ch.js';
import { parseCsvRows } from '../src/sources/csv.js';
import { readXlsx, columnIndex } from '../src/sources/xlsx.js';
import { zipSync, strToU8 } from 'fflate';
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

describe('FR adapter (INSEE COG)', () => {
  it('discovers the newest download page and CSVs', () => {
    const index = '<a href="/fr/information/8740222" class="x">Téléchargement des fichiers</a><a href="/fr/information/8377162">Téléchargement des fichiers</a>';
    expect(findLatestDownloadPage(index)).toBe('/fr/information/8740222');
    expect(() => findLatestDownloadPage('<p>nothing</p>')).toThrow(/layout changed/);
    const page = `<a href="/fr/statistiques/fichier/8740222/v_region_2026.csv">r</a><a href="/fr/statistiques/fichier/8740222/v_departement_2026.csv">d</a><a href="/fr/statistiques/fichier/8740222/v_commune_2026.csv">c</a><a href="/fr/statistiques/fichier/8377162/v_commune_2025.csv">old</a>`;
    expect(findCogFiles(page, '<p>Dernière mise à jour le : 24/02/2026</p>')).toMatchObject({ year: '2026', commune: '/fr/statistiques/fichier/8740222/v_commune_2026.csv', updated: '24/02/2026' });
    expect(findCogFiles(page).updated).toBeNull();
    expect(() => findCogFiles('<a href="/fr/statistiques/fichier/1/v_commune_2026.csv">c</a>')).toThrow(/does not list/);
  });
  it('builds region > department > commune, with ARM/COMA/COMD below their parent commune', () => {
    const e = mapInsee(
      [{ REG: '11', LIBELLE: 'Île-de-France' }],
      [{ DEP: '75', REG: '11', LIBELLE: 'Paris' }],
      [
        { TYPECOM: 'COM', COM: '75056', DEP: '75', REG: '11', LIBELLE: 'Paris', CAN: '', ARR: '751' },
        { TYPECOM: 'ARM', COM: '75101', DEP: '75', LIBELLE: 'Paris 1er Arrondissement', COMPARENT: '75056' },
        { TYPECOM: 'COMD', COM: '01015', LIBELLE: 'Arbigny', COMPARENT: '01999' }, // parent absent: skipped
        { TYPECOM: 'COM', COM: '97501', DEP: '975', LIBELLE: 'Miquelon-Langlade' },
      ],
    );
    expect(e.map((x) => `${x.id}<${x.parent_id}`)).toEqual([
      'div:FR:reg-11<country:FR', 'div:FR:dep-75<div:FR:reg-11', 'div:FR:com-75056<div:FR:dep-75', 'div:FR:com-75101<div:FR:com-75056', 'div:FR:com-97501<country:FR',
    ]);
    expect(e[3]).toMatchObject({ data: { level: 4, type: 'borough', type_local: 'arrondissement municipal' } });
    expect(e[2]!.data).toMatchObject({ type: 'municipality', type_local: 'commune', arrondissement: '751' });
  });
});

describe('IT adapter', () => {
  const H = ['Codice Regione', "Codice dell'Unità territoriale sovracomunale \n(valida a fini statistici)", 'Codice Provincia (Storico)(1)', 'Progressivo del Comune (2)', 'Codice Comune formato alfanumerico', 'Denominazione (Italiana e straniera)', 'Denominazione in italiano', 'Denominazione altra lingua', 'Codice Ripartizione Geografica', 'Ripartizione geografica', 'Denominazione Regione', "Denominazione dell'Unità territoriale sovracomunale \n(valida a fini statistici)", 'Tipologia di Unità territoriale sovracomunale ', 'Flag Comune capoluogo di Provincia/Città metropolitana/libero consorzio', 'Sigla automobilistica', 'Codice Catastale del Comune', 'Codice NUTS1 2021', 'Codice NUTS3 2021', 'Codice NUTS2 2024 (3) ', 'Codice NUTS3 2024'];
  const R = (reg: string, uts: string, com: string, name: string, it: string, other: string, regName: string, utsName: string, type: string, cap: string, sigla: string, cat: string, n2: string, n3: string) =>
    [reg, uts, '', '', com, name, it, other, '1', 'x', regName, utsName, type, cap, sigla, cat, 'ITC', 'OLD', n2, n3];
  const rows = [
    H,
    R('01', '201', '001001', 'Agliè', 'Agliè', '', 'Piemonte', 'Torino', '3', '0', 'TO', 'A074', 'ITC1', 'ITC11'),
    R('01', '201', '001272', 'Torino', 'Torino', '', 'Piemonte', 'Torino', '3', '1', 'TO', 'L219', 'ITC1', 'ITC11'),
    R('04', '021', '021008', 'Bolzano/Bozen', 'Bolzano', 'Bozen', 'Trentino-Alto Adige/Südtirol', 'Bolzano/Bozen', '2', '1', 'BZ', 'A952', 'ITH1', 'ITH10'),
  ];
  it('finds columns by header text and builds region > UTS > comune once each, using the latest NUTS year', () => {
    const e = parseIstat(rows);
    expect(e.map((x) => x.id)).toEqual(['div:IT:reg-01', 'div:IT:uts-201', 'div:IT:com-001001', 'div:IT:com-001272', 'div:IT:reg-04', 'div:IT:uts-021', 'div:IT:com-021008']);
    expect(e.find((x) => x.id === 'div:IT:com-021008')).toMatchObject({ name: 'Bolzano/Bozen', parent_id: 'div:IT:uts-021', data: { name_other: 'Bozen', capoluogo: true, type: 'municipality', cadastral_code: 'A952' } });
    expect(e.find((x) => x.id === 'div:IT:uts-201')!.data).toMatchObject({ type: 'province', nuts3: 'ITC11', sigla: 'TO', uts_type_code: '3' }); // NUTS 2024, not the 2021 column
  });
  it('fails loudly when a required column disappears', () => {
    expect(() => parseIstat([H.filter((h) => !h.startsWith('Codice Regione')), ['x']])).toThrow(/Codice Regione/);
    expect(parseIstat([])).toEqual([]);
  });
});

describe('NL adapter', () => {
  it('trims CBS padding and builds landsdeel > provincie > gemeente', () => {
    const e = parseCbs([
      { Code_1: 'GM1680    ', Naam_2: 'Aa en Hunze      ', Code_26: 'LD01  ', Naam_27: 'Noord-Nederland  ', Code_28: 'PV22  ', Naam_29: 'Drenthe  ' },
      { Code_1: 'GM0014    ', Naam_2: 'Groningen        ', Code_26: 'LD01  ', Naam_27: 'Noord-Nederland  ', Code_28: 'PV20  ', Naam_29: 'Groningen' },
      { Code_1: 'NL01      ', Naam_2: 'Nederland        ', Code_26: '.     ', Naam_27: '.', Code_28: '.', Naam_29: '.' },
    ]);
    expect(e.map((x) => `${x.id}<${x.parent_id}`)).toEqual([
      'div:NL:LD01<country:NL', 'div:NL:PV22<div:NL:LD01', 'div:NL:GM1680<div:NL:PV22', 'div:NL:PV20<div:NL:LD01', 'div:NL:GM0014<div:NL:PV20',
    ]);
    expect(e[2]).toMatchObject({ name: 'Aa en Hunze', data: { type: 'municipality', type_local: 'gemeente' } });
  });
});

describe('NO adapter', () => {
  it('builds fylke > kommune', () => {
    const e = mapNorway([{ fylkesnummer: '03', fylkesnavn: 'Oslo', kommuner: [{ kommunenummer: '0301', kommunenavn: 'Oslo' }] }]);
    expect(e.map((x) => `${x.id}<${x.parent_id}`)).toEqual(['div:NO:fylke-03<country:NO', 'div:NO:kommune-0301<div:NO:fylke-03']);
    expect(e[0]!.data).toMatchObject({ type: 'county', type_local: 'fylke', level: 1 });
  });
});

describe('SE adapter', () => {
  const meta = (labels: Record<string, string>) => ({ dimension: { Region: { label: 'region', category: { index: Object.keys(labels), label: labels } } } });
  it('builds county > municipality from the SCB Region dimension, Swedish names with English alongside', () => {
    const e = mapSweden(
      meta({ '00': 'Riket', '01': 'Stockholms län', '0114': 'Upplands Väsby', '03': 'Uppsala län', '0305': 'Håbo' }),
      meta({ '00': 'Sweden', '01': 'Stockholm county', '0114': 'Upplands Väsby', '03': 'Uppsala county', '0305': 'Håbo' }),
    );
    expect(e.map((x) => `${x.id}<${x.parent_id}`)).toEqual(['div:SE:lan-01<country:SE', 'div:SE:kommun-0114<div:SE:lan-01', 'div:SE:lan-03<country:SE', 'div:SE:kommun-0305<div:SE:lan-03']);
    expect(e[0]).toMatchObject({ name: 'Stockholms län', data: { name_en: 'Stockholm county', type: 'county', type_local: 'län', level: 1 } });
  });
  it('picks the newest yearly table of the series', () => {
    const t = pickLatestTable([
      { id: 'TAB6030', label: 'Population by region, country of birth and sex. Year 2000-2024', lastPeriod: '2024' },
      { id: 'TAB6646', label: 'Population by region, country of birth and sex.  Year 2025', lastPeriod: '2025' },
      { id: 'TAB1', label: 'Population by region, country of birth and sex.  Year 2023', lastPeriod: '2023' },
    ]);
    expect(t.id).toBe('TAB6646');
    expect(() => pickLatestTable([])).toThrow(/no SCB table/);
  });
});

describe('xlsx reader', () => {
  it('reads shared strings, inline strings and numbers, with sparse columns', () => {
    const sheet = '<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="C1" t="inlineStr"><is><t>inl &amp; ine</t></is></c></row><row r="2"><c r="B2"><v>42</v></c><c r="AA2" t="s"><v>1</v></c></row></sheetData></worksheet>';
    const bytes = zipSync({
      'xl/workbook.xml': strToU8('<workbook><sheets><sheet name="CODICI al 21_02_2026" sheetId="1" r:id="rId1"/></sheets></workbook>'),
      'xl/_rels/workbook.xml.rels': strToU8('<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>'),
      'xl/sharedStrings.xml': strToU8('<sst><si><t>Codice</t></si><si><r><t>Rich </t></r><r><t>text</t></r></si></sst>'),
      'xl/worksheets/sheet1.xml': strToU8(sheet),
    });
    const [s] = readXlsx(bytes);
    expect(s!.name).toBe('CODICI al 21_02_2026');
    expect(s!.rows[0]).toEqual(['Codice', '', 'inl & ine']);
    expect(s!.rows[1]![1]).toBe('42');
    expect(s!.rows[1]![26]).toBe('Rich text');
    expect(columnIndex('AA9')).toBe(26);
  });
});

describe('CZ adapter', () => {
  const row = (o: Record<string, string>) => ({ platnost_datum: '2026-01-01', obec_typ: 'Obec', kraj_zkratka: 'KVK', ...o });
  it('builds region > kraj > okres > obec once each', () => {
    const e = parseCzso([
      row({ obec_text: 'Abertamy', obec_kod: '554979', obec_typ: 'Město', okres_text: 'Karlovy Vary', okres_csu_cis101_lau_kod: 'CZ0412', okres_csu_cis109_nuts_kod: 'CZ0412', kraj_text: 'Karlovarský kraj', kraj_csu_cis108_nuts_kod: 'CZ041', region_text: 'Severozápad', region_csu_cis107_nuts_kod: 'CZ04' }),
      row({ obec_text: 'Aš', obec_kod: '554499', okres_text: 'Cheb', okres_csu_cis101_lau_kod: 'CZ0413', kraj_text: 'Karlovarský kraj', kraj_csu_cis108_nuts_kod: 'CZ041', region_text: 'Severozápad', region_csu_cis107_nuts_kod: 'CZ04' }),
      row({ obec_text: 'incomplete', obec_kod: '1' }),
    ]);
    expect(e.map((x) => `${x.id}<${x.parent_id}`)).toEqual([
      'div:CZ:reg-CZ04<country:CZ', 'div:CZ:kraj-CZ041<div:CZ:reg-CZ04', 'div:CZ:okres-CZ0412<div:CZ:kraj-CZ041', 'div:CZ:obec-554979<div:CZ:okres-CZ0412',
      'div:CZ:okres-CZ0413<div:CZ:kraj-CZ041', 'div:CZ:obec-554499<div:CZ:okres-CZ0413',
    ]);
    expect(e[3]).toMatchObject({ name: 'Abertamy', data: { level: 4, type: 'municipality', type_local: 'město' } });
    expect(e[1]!.data).toMatchObject({ type: 'region', type_local: 'kraj', abbreviation: 'KVK', nuts: 'CZ041' });
  });
});

describe('DE adapter', () => {
  const rows = [
    ['Gemeinden in Deutschland nach Fläche'],
    [],
    ['Satzart', 'Textkennzeichen', 'Amtlicher Regionalschlüssel (ARS)', '', '', '', '', 'Gemeindename', 'Fläche km2 1)', 'Bevölkerung auf Grundlage des Zensus', '', '', '', 'Postleitzahl3)', 'Geografische Mittelpunktkoordinaten'],
    ['', '', 'Land', 'RB', 'Kreis', 'VB', 'Gem', '', '', 'insgesamt', 'männlich', 'weiblich', 'je km2', '', 'Längengrad', 'Breitengrad'],
    ['', '', 'Gebietsstand am 31.12.2025 (Jahr)'],
    [],
    ['10', '', '01', '', '', '', '', 'Schleswig-Holstein'],
    ['40', '41', '01', '0', '01', '', '', 'Flensburg, Stadt'],
    ['50', '50', '01', '0', '01', '0000', '', 'Flensburg, Stadt'],
    ['60', '61', '01', '0', '01', '0000', '000', 'Flensburg, Stadt', '56.73', '95568', '47298', '48270', '1685', '24937', '9,43751', '54,78252'],
    ['10', '', '09', '', '', '', '', 'Bayern'],
    ['20', '', '09', '1', '', '', '', 'Oberbayern'],
    ['40', '', '09', '1', '62', '', '', 'München, Landeshauptstadt'],
    ['60', '', '09', '1', '62', '0000', '000', 'München, Landeshauptstadt', '310.7', '1512491'],
    ['60', '', '09', '9', '99', '0000', '001', 'Gemeinde ohne Kreiszeile'],
  ];
  it('builds Land > (Regierungsbezirk) > Kreis > Gemeinde; Gemeindeverband and orphan rows are not modelled', () => {
    const { entities: e, asOf } = parseGv(rows);
    expect(asOf).toBe('31.12.2025');
    expect(e.map((x) => `${x.id}<${x.parent_id}`)).toEqual([
      'div:DE:land-01<country:DE', 'div:DE:kreis-01001<div:DE:land-01', 'div:DE:gem-01001000<div:DE:kreis-01001',
      'div:DE:land-09<country:DE', 'div:DE:rb-091<div:DE:land-09', 'div:DE:kreis-09162<div:DE:rb-091', 'div:DE:gem-09162000<div:DE:kreis-09162',
    ]);
    const fl = e.find((x) => x.id === 'div:DE:gem-01001000')!;
    expect(fl).toMatchObject({ name: 'Flensburg, Stadt', lon: 9.43751, lat: 54.78252, data: { population: 95568, area_km2: 56.73, type: 'municipality', level: 4 } });
  });
  it('fails loudly if the layout changes', () => {
    expect(() => parseGv([['x']])).toThrow(/layout changed/);
  });
});

describe('AT adapter', () => {
  const pol = 'Politische Bezirke, Gebietsstand 2026;;;;\nErstellt am:;01.10.2026 08:15:30;;;\nBundeslandkennziffer;Bundesland;Kennziffer pol. Bezirk;Politischer Bezirk;Politischer Bez. Code\n1;Burgenland;101;Eisenstadt(Stadt);101\n1;Burgenland;103;Eisenstadt-Umgebung;103\n9;Wien;900;Wien(Stadt);900\n9;Wien;900;Wien  1.,Innere Stadt;901\nQuelle: STATISTIK AUSTRIA. erstellt am 01.10.2026\n';
  const gem = 'Gemeindeliste sortiert nach Gemeindekennziffer, Gebietsstand 2026;;;;;\nErstellt am:;01.10.2026;;;;\nGemeindekennziffer;Gemeindename;Gemeindecode;Status;PLZ des Gem.Amtes;weitere Postleitzahlen\n10101;Eisenstadt;10101;SR;7000;\n10301;Breitenbrunn am Neusiedler See;10301;M;7091;\n90001;Wien;90001;SR;1010;\n';
  it('builds Bundesland > Bezirk > Gemeinde; the Gemeindebezirke of Vienna hang below Gemeinde Wien; no postal codes kept', () => {
    const { entities: e, asOf } = parseAustria(pol, gem);
    expect(asOf).toBe('2026');
    expect(e.map((x) => `${x.id}<${x.parent_id}`)).toEqual([
      'div:AT:land-1<country:AT', 'div:AT:bez-101<div:AT:land-1', 'div:AT:bez-103<div:AT:land-1', 'div:AT:land-9<country:AT', 'div:AT:bez-900<div:AT:land-9', 'div:AT:bez-901<div:AT:gem-90001',
      'div:AT:gem-10101<div:AT:bez-101', 'div:AT:gem-10301<div:AT:bez-103', 'div:AT:gem-90001<div:AT:bez-900',
    ]);
    expect(e.find((x) => x.id === 'div:AT:gem-10101')).toMatchObject({ name: 'Eisenstadt', data: { type_local: 'Statutarstadt', status: 'SR' } });
    expect(JSON.stringify(e)).not.toContain('7000');
    expect(() => parseAustria('x', gem)).toThrow(/layout changed/);
  });
});

describe('CA adapter', () => {
  it('builds region > province > census division > census subdivision from code prefixes', () => {
    const r = (Level: string, Code: string, name: string) => ({ Level, 'Hierarchical structure': 'x', Code, 'Class title': name });
    const e = parseSgc([r('1', '1', 'Atlantic'), r('2', '10', 'Newfoundland and Labrador'), r('3', '1001', 'Division No. 1'), r('4', '1001105', 'Portugal Cove South'), { Level: '9', Code: '77', 'Class title': 'x', 'Hierarchical structure': '' }]);
    expect(e.map((x) => `${x.id}<${x.parent_id}`)).toEqual(['div:CA:1<country:CA', 'div:CA:10<div:CA:1', 'div:CA:1001<div:CA:10', 'div:CA:1001105<div:CA:1001']);
    expect(e[3]).toMatchObject({ name: 'Portugal Cove South', data: { type: 'municipality', type_local: 'census subdivision', level: 4 } });
  });
});

describe('CH adapter', () => {
  const r = (HistoricalCode: string, BfsCode: string, Level: string, Parent: string, Name: string) => ({ HistoricalCode, BfsCode, Level, Parent, Name, ShortName: Name, ValidFrom: '12.09.1848' });
  it('builds canton > Bezirk > Gemeinde via HistoricalCode parents; skips rows with unknown parents', () => {
    const e = parseBfs([r('1', '1', '1', '', 'Zürich'), r('10053', '101', '2', '1', 'Bezirk Affoltern'), r('11742', '2', '3', '10053', 'Affoltern am Albis'), r('99', '9', '3', '555', 'Orphan'), r('2', '2', '1', '', 'Bern'), r('20001', '351', '3', '2', 'Bern direct')]);
    expect(e.map((x) => `${x.id}<${x.parent_id}`)).toEqual([
      'div:CH:kt-1<country:CH', 'div:CH:bez-10053<div:CH:kt-1', 'div:CH:gem-2<div:CH:bez-10053', 'div:CH:kt-2<country:CH', 'div:CH:gem-351<div:CH:kt-2',
    ]);
    expect(e[0]).toMatchObject({ name: 'Zürich', data: { type: 'canton', type_local: 'Kanton', level: 1 } });
  });
});

describe('AU adapter', () => {
  const H = ['SA2_CODE_2026', 'SA2_NAME_2026', 'CHANGE_FLAG_2026', 'CHANGE_LABEL_2026', 'SA3_CODE_2026', 'SA3_NAME_2026', 'SA4_CODE_2026', 'SA4_NAME_2026', 'GCCSA_CODE_2026', 'GCCSA_NAME_2026', 'STATE_CODE_2026', 'STATE_NAME_2026', 'AUS_CODE_2026', 'AUS_NAME_2026', 'AREA_ALBERS_SQKM'];
  it('builds State > SA4 > SA3 > SA2 once each, with GCCSA kept as an attribute', () => {
    const row = (sa2: string, n2: string, sa3: string, n3: string) => [sa2, n2, '0', 'No change', sa3, n3, '101', 'Capital Region', '1RNSW', 'Rest of NSW', '1', 'New South Wales', 'AUS', 'Australia', '3418.3524000000002'];
    const e = parseAsgs([H, row('101021007', 'Braidwood', '10102', 'Queanbeyan'), row('101021008', 'Karabar', '10102', 'Queanbeyan')]);
    expect(e.map((x) => `${x.id}<${x.parent_id}`)).toEqual([
      'div:AU:ste-1<country:AU', 'div:AU:sa4-101<div:AU:ste-1', 'div:AU:sa3-10102<div:AU:sa4-101', 'div:AU:sa2-101021007<div:AU:sa3-10102', 'div:AU:sa2-101021008<div:AU:sa3-10102',
    ]);
    expect(e[1]!.data).toMatchObject({ gccsa: '1RNSW', gccsa_name: 'Rest of NSW', type_local: 'Statistical Area Level 4' });
    expect(e[3]!.data).toMatchObject({ area_km2: 3418.35, level: 4 });
    expect(() => parseAsgs([['x'], ['y']])).toThrow(/layout changed/);
  });
});

import { mapOns, pickLatestItem, itemKey } from '../src/sources/national/gb.js';
describe('GB adapter', () => {
  it('orders ONS vintages and picks the newest, preferring V2 of the same month', () => {
    expect(itemKey('Countries (December 2025) Names and Codes in the UK')).toBeGreaterThan(itemKey('Countries (December 2024) Names and Codes in the UK'));
    const items = [
      { id: '1', title: 'Local Authority Districts (April 2025) Names and Codes in the UK (V2)', url: 'u2' },
      { id: '2', title: 'Local Authority Districts (April 2025) Names and Codes in the UK', url: 'u1' },
      { id: '3', title: 'Local Authority Districts (December 2024) Names and Codes in the UK', url: 'u0' },
    ];
    expect(pickLatestItem(items, /^Local Authority Districts/).url).toBe('u2');
    expect(() => pickLatestItem(items, /^Nope/)).toThrow(/no item/);
  });
  it('builds nation > region > district and falls back to the nation for Wales/Scotland/NI', () => {
    const lads = Array.from({ length: 300 }, (_, i) => ({ LAD25CD: `E07${String(i).padStart(6, '0')}`, LAD25NM: `D${i}` }));
    lads.push({ LAD25CD: 'W06000001', LAD25NM: 'Isle of Anglesey', LAD25NMW: 'Ynys Môn' } as never, { LAD25CD: 'S12000033', LAD25NM: 'Aberdeen City' });
    const e = mapOns({
      countries: [{ CTRY25CD: 'E92000001', CTRY25NM: 'England' }, { CTRY25CD: 'K02000001', CTRY25NM: 'United Kingdom' }, { CTRY25CD: 'W92000004', CTRY25NM: 'Wales' }, { CTRY25CD: 'S92000003', CTRY25NM: 'Scotland' }],
      regions: [{ RGN25CD: 'E12000001', RGN25NM: 'North East' }],
      ladRegion: [{ LAD25CD: 'E07000000', RGN25CD: 'E12000001' }],
      ladCtyua: [{ LAD25CD: 'E07000000', CTYUA25CD: 'E10000001', CTYUA25NM: 'Countyshire' }],
      lads,
    });
    const by = (id: string) => e.find((x) => x.id === `div:GB:${id}`)!;
    expect(by('K02000001')).toBeUndefined();
    expect(by('E12000001').parent_id).toBe('div:GB:E92000001');
    expect(by('E07000000')).toMatchObject({ parent_id: 'div:GB:E12000001', data: { level: 3, county_ua_code: 'E10000001' } });
    expect(by('E07000001').parent_id).toBe('div:GB:E92000001');
    expect(by('W06000001')).toMatchObject({ parent_id: 'div:GB:W92000004', data: { name_cy: 'Ynys Môn' } });
    expect(by('S12000033').parent_id).toBe('div:GB:S92000003');
    expect(() => mapOns({ countries: [], regions: [], ladRegion: [], ladCtyua: [], lads: [] })).toThrow();
  });
});

import { mapIne } from '../src/sources/national/es.js';
describe('ES adapter', () => {
  it('builds community > province > municipality with parents from the Tempus hierarchy', () => {
    const ccaa = [{ Id: 16473, Nombre: 'Total Nacional', Codigo: '00' }, { Id: 9012, Nombre: 'País Vasco', Codigo: '16' }, { Id: 1, Nombre: 'Extranjero', Codigo: '' }];
    const prov = [{ Id: 2, Nombre: 'Araba/Álava', Codigo: '01', FK_JerarquiaPadres: [9012] }, ...Array.from({ length: 8 }, (_, i) => ({ Id: 100 + i, Nombre: `P${i + 2}`, Codigo: `0${i + 2}`, FK_JerarquiaPadres: [9012] })), { Id: 16473, Nombre: 'Total Nacional', Codigo: '00' }];
    const dict = [['Relación…'], ['CODAUTO', 'CPRO', 'CMUN', 'DC', 'NOMBRE'], ...Array.from({ length: 8001 }, (_, i) => ['16', '0' + (Math.floor(i / 999) + 1), String((i % 999) + 1).padStart(3, '0'), '3', `M${i}`])];
    const e = mapIne(ccaa, prov, dict);
    const par = (id: string) => e.find((x) => x.id === `div:ES:${id}`)?.parent_id;
    expect([par('ca-16'), par('prov-01'), par('mun-01001')]).toEqual(['country:ES', 'div:ES:ca-16', 'div:ES:prov-01']);
    expect(e).toHaveLength(8011);
    expect(() => mapIne(ccaa, [{ Id: 9, Nombre: 'X', Codigo: '02' }], dict)).toThrow(/no community parent/);
    expect(() => mapIne(ccaa, prov, [['a']])).toThrow(/layout changed/);
  });
});

import { mapCaop } from '../src/sources/national/pt.js';
describe('PT adapter', () => {
  it('builds distrito > município > freguesia from DICO codes and rejects orphans', () => {
    const d = Array.from({ length: 15 }, (_, i) => ({ dt: String(i + 1).padStart(2, '0'), distrito: `D${i}` }));
    const m = Array.from({ length: 250 }, (_, i) => ({ dtmn: `${String((i % 15) + 1).padStart(2, '0')}${String(Math.floor(i / 15) + 1).padStart(2, '0')}`, municipio: `M${i}`, nuts3_cod: '191', area_ha: '1234' }));
    const f = Array.from({ length: 2600 }, (_, i) => ({ dtmnfr: `${m[i % 250]!.dtmn}${String(Math.floor(i / 250) + 1).padStart(2, '0')}`, freguesia: `F${i}` }));
    f.push({ dtmnfr: '990101', freguesia: 'orphan' }, { dtmnfr: '0101FA', freguesia: 'União das freguesias X' });
    const e = mapCaop(d, m, f);
    expect(e.find((x) => x.id === 'div:PT:mn-0101')).toMatchObject({ parent_id: 'div:PT:dt-01', data: { level: 2, area_km2: 12.34 } });
    expect(e.find((x) => x.id === 'div:PT:fr-010101')!.parent_id).toBe('div:PT:mn-0101');
    expect(e.some((x) => x.name === 'orphan')).toBe(false);
    expect(e.find((x) => x.id === 'div:PT:fr-0101FA')!.parent_id).toBe('div:PT:mn-0101');
    expect(() => mapCaop([], [], [])).toThrow(/layout changed/);
  });
});

import { parseMic, findCodeFile } from '../src/sources/national/jp.js';
describe('JP adapter', () => {
  it('finds the first xlsx on the MIC page', () => {
    expect(findCodeFile('<a href="/main_content/000925834.pdf">x</a><a href="/main_content/000925835.xlsx">y</a><a href="/main_content/000875488.xlsx">z</a>')).toBe('https://www.soumu.go.jp/main_content/000925835.xlsx');
    expect(() => findCodeFile('<html>')).toThrow(/layout changed/);
  });
  it('builds prefecture > municipality > ward, cleans appended kana and validates counts', () => {
    const H = ['団体コード', '都道府県名\r\n（漢字）', '市区町村名\r\n（漢字）', 'k', 'k'];
    const rows: string[][] = [H];
    for (let p = 1; p <= 47; p++) {
      const pc = String(p).padStart(2, '0');
      rows.push([`${pc}0006`, `P${p}`, '', 'k', '']);
      for (let m = 1; m <= 37; m++) rows.push([`${pc}${String(100 + m * 2)}${0}`, `P${p}`, `M${p}-${m}市`, 'k', 'k']);
    }
    rows.push(['431001', '熊本県', '熊本市', 'k', 'k']);
    const sheet2 = [H, ['431001', '熊本県', '熊本市', 'k', 'k'], ['431044', '熊本県', '熊本市南区クマモトシミナミク', 'k', 'k']];
    const e = parseMic([{ name: 'R6.1.1現在の団体', rows }, { name: 'ward', rows: sheet2 }]);
    expect(e.find((x) => x.id === 'div:JP:mun-431044')).toMatchObject({ name: '熊本市南区', parent_id: 'div:JP:mun-431001', data: { level: 3, type: 'ward' } });
    expect(e.find((x) => x.id === 'div:JP:pref-43')!.parent_id).toBe('country:JP');
    expect(() => parseMic([{ name: 'x', rows: [['bad']] }, { name: 'y', rows: [] }])).toThrow(/header changed/);
  });
});

import { mapBdl, type BdlUnit } from '../src/sources/national/pl.js';
describe('PL adapter', () => {
  const u = (id: string, name: string): BdlUnit => ({ id, name });
  it('builds województwo > powiat > gmina from current units, reading kind and powiat from the id', () => {
    const v = Array.from({ length: 16 }, (_, i) => u(`${String(i + 1).padStart(2, '0')}${String(i + 1).padStart(2, '0')}00000000`, `WOJ${i}`));
    const p = Array.from({ length: 380 }, (_, i) => u(`${v[i % 16]!.id.slice(0, 4)}${String(i).padStart(3, '0')}${String(i % 90).padStart(2, '0')}000`.slice(0, 9) + '000', i === 0 ? 'Powiat m. Kraków' : `Powiat p${i}`));
    const g = Array.from({ length: 2480 }, (_, i) => u(`${p[i % 380]!.id.slice(0, 9)}${String(i % 90).padStart(2, '0')}${(i % 3) + 1}`, `G${i}`));
    g.push(u(`${p[0]!.id.slice(0, 9)}994`, 'Łazy - miasto'), u(`${p[0]!.id.slice(0, 9)}998`, 'Bielany - dzielnica'));
    const e = mapBdl(v, p, g);
    expect(e.find((x) => x.id === `div:PL:woj-${v[0]!.id}`)).toMatchObject({ name: 'Woj0', parent_id: 'country:PL' });
    expect(e.find((x) => x.id === `div:PL:pow-${p[0]!.id}`)).toMatchObject({ name: 'm. Kraków', data: { type_local: 'miasto na prawach powiatu' } });
    expect(e.find((x) => x.id === `div:PL:gm-${g[1]!.id}`)).toMatchObject({ parent_id: `div:PL:pow-${p[1]!.id}`, data: { type_local: 'gmina wiejska' } });
    expect(e.some((x) => x.name.includes('miasto') || x.name.includes('dzielnica'))).toBe(false);
    expect(e.filter((x) => x.data.level === 3)).toHaveLength(2480);
    expect(() => mapBdl(v, p.slice(0, 20), g)).toThrow(/layout changed/);
  });
});
