import { describe, expect, it } from 'vitest';
import { parseStates, parseCounties } from '../src/sources/national/us.js';
import { mapInsee, findCogFiles, findLatestDownloadPage } from '../src/sources/national/fr.js';
import { parseIstat } from '../src/sources/national/it.js';
import { parseCbs } from '../src/sources/national/nl.js';
import { mapNorway } from '../src/sources/national/no.js';
import { mapSweden, pickLatestTable } from '../src/sources/national/se.js';
import { parseCzso } from '../src/sources/national/cz.js';
import { parseGv } from '../src/sources/national/de.js';
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
