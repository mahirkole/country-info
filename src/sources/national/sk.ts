import type { EntityInput } from '../../model.js';
import { fetchText } from '../fetch.js';
import { parseCsv } from '../csv.js';
import { division, type NationalSource } from './types.js';

const SPARQL = 'https://data.slovensko.sk/api/sparql';
const CC0 = 'http://publications.europa.eu/resource/authority/licence/CC0';

/** The three code-list series of the Register adries (Ministry of the Interior) in the national open-data catalogue: kraj, okres, obec. */
const SERIES = { region: 'Register adries - Register krajov', county: 'Register Adries - Register okresov', municipality: 'Register Adries - Register obcí' } as const;
type Level = keyof typeof SERIES;

export const sparqlQuery = (title: string) => `PREFIX dct: <http://purl.org/dc/terms/>
PREFIX dcat: <http://www.w3.org/ns/dcat#>
PREFIX leg: <https://data.gov.sk/def/ontology/legislation/>
SELECT ?t ?mod ?url ?lic WHERE {
  ?s dct:title ?st ; dct:hasPart ?part .
  FILTER(STR(?st) = "${title}")
  ?part dct:title ?t ; dcat:distribution ?d .
  OPTIONAL { ?part dct:modified ?mod }
  ?d dcat:downloadURL ?url ; dct:format <http://publications.europa.eu/resource/authority/file-type/CSV> .
  OPTIONAL { ?d leg:termsOfUse ?tou . ?tou leg:authorsWorkType ?lic }
}`;

interface Binding { t?: { value: string }; mod?: { value: string }; url?: { value: string }; lic?: { value: string } }

/** Newest "…inicializačné a zmenové dáta" CSV of a series; refuses anything whose declared terms are not CC0. */
export function pickDistribution(json: unknown, label: string): { url: string; modified: string } {
  const rows = ((json as { results?: { bindings?: Binding[] } }).results?.bindings ?? []).filter((b) => /inicializačné a zmenové/i.test(b.t?.value ?? '') && b.url?.value);
  if (!rows.length) throw new Error(`Slovak open-data catalogue: no "inicializačné a zmenové dáta" CSV for ${label} — layout changed`);
  const best = rows.sort((a, b) => (b.mod?.value ?? '').localeCompare(a.mod?.value ?? ''))[0]!;
  if (best.lic?.value !== CC0) throw new Error(`Slovak open-data catalogue: ${label} distribution is not declared CC0 (${best.lic?.value ?? 'no terms'}) — licence changed, not loading`);
  return { url: best.url!.value, modified: (best.mod?.value ?? '').slice(0, 10) };
}

const STATUS_TYPE: Record<string, { type: string; local: string }> = {
  MUNICIPALITY: { type: 'municipality', local: 'obec' },
  CITY: { type: 'city', local: 'mesto' },
  CITY_DISTRICT: { type: 'borough', local: 'mestská časť' },
  MILITARY_DISTRICT: { type: 'other', local: 'vojenský obvod' },
};

interface Row { [k: string]: string }
const current = (r: Row, today: string) => r['validFrom']!.slice(0, 10) <= today && today <= r['validTo']!.slice(0, 10);
/** Valid on `today`, highest versionId per code; placeholder rows (code that is not `SK` + digits/letters, e.g. NEDODANE, 100000) are dropped. */
function currentRows(text: string, codeCol: string, today: string, pattern: RegExp): Row[] {
  const rows = parseCsv(text);
  if (!rows.length || !(codeCol in rows[0]!) || !('objectId' in rows[0]!) || !('validTo' in rows[0]!)) throw new Error(`Register adries CSV: column ${codeCol}/objectId/validTo missing — layout changed`);
  const byCode = new Map<string, Row>();
  for (const r of rows) {
    const code = r[codeCol] ?? '';
    if (!pattern.test(code) || !current(r, today)) continue;
    const prev = byCode.get(code);
    if (!prev || Number(r['versionId']) > Number(prev['versionId'])) byCode.set(code, r);
  }
  return [...byCode.values()];
}

/** Kraj (8), okres (79), obec/mesto/mestská časť (≈2.9k) from the Register adries, linked by the registry's own object ids. */
export function parseSlovakia(regions: string, counties: string, municipalities: string, today = new Date().toISOString().slice(0, 10), sanity = true): EntityInput[] {
  const kr = currentRows(regions, 'regionCode', today, /^SK0\d\d$/);
  const ok = currentRows(counties, 'countyCode', today, /^SK0[0-9A-Z]{3}$/);
  const ob = currentRows(municipalities, 'municipalityCode', today, /^SK[0-9A-Z]{10}$/);
  const krById = new Map(kr.map((r) => [r['objectId']!, r['regionCode']!]));
  const okById = new Map(ok.map((r) => [r['objectId']!, r['countyCode']!]));
  const out: EntityInput[] = [];
  for (const r of kr) out.push(division('SK', r['regionCode']!, { parent: 'country:SK', name: r['regionName']!, level: 1, type: 'region', typeLocal: 'kraj', extra: { registry_object_id: r['objectId'] } }));
  for (const r of ok) {
    const p = krById.get(r['regionIdentifier'] ?? '');
    if (!p) throw new Error(`Register adries: okres ${r['countyCode']} has no current kraj — hierarchy broken`);
    out.push(division('SK', r['countyCode']!, { parent: `div:SK:${p}`, name: r['countyName']!, level: 2, type: 'district', typeLocal: 'okres', extra: { registry_object_id: r['objectId'] } }));
  }
  for (const r of ob) {
    const p = okById.get(r['countyIdentifier'] ?? '');
    if (!p) throw new Error(`Register adries: obec ${r['municipalityCode']} has no current okres — hierarchy broken`);
    const t = STATUS_TYPE[r['status'] ?? ''] ?? { type: 'municipality', local: 'obec' };
    out.push(division('SK', r['municipalityCode']!, { parent: `div:SK:${p}`, name: r['municipalityName']!, level: 3, type: t.type, typeLocal: t.local, extra: { status: r['status'], registry_object_id: r['objectId'] } }));
  }
  if (sanity && (kr.length < 6 || kr.length > 10 || ok.length < 70 || ok.length > 90 || ob.length < 2500)) throw new Error(`Register adries: ${kr.length} kraje / ${ok.length} okresy / ${ob.length} obce look wrong — layout changed`);
  return out;
}

export const SK: NationalSource = {
  country: 'SK',
  meta: {
    id: 'nat-sk',
    authority: 'Ministerstvo vnútra SR – Register adries (Národný katalóg otvorených dát, data.slovensko.sk)',
    url: 'https://data.gov.sk/dataset/register-adries-register-obci',
    license: 'CC0 (EU authority licence CC0): the catalogue declares it in the TermsOfUse node of every distribution (authorsWorkType, originalDatabaseType, databaseProtectedBySpecialRightsType); read via the catalogue SPARQL endpoint on 2026-10-06; docs/licenses/nat-sk.md',
    attribution: 'Source: Ministerstvo vnútra Slovenskej republiky, Register adries (open data, CC0)',
  },
  licenseStatus: 'read',
  levels: ['kraj', 'okres', 'obec'],
  async load(cacheDir) {
    const get = async (level: Level) => {
      const q = `${SPARQL}?query=${encodeURIComponent(sparqlQuery(SERIES[level]))}`;
      const d = pickDistribution(JSON.parse(await fetchText(q, `sk_sparql_${level}.json`, cacheDir, undefined, { Accept: 'application/sparql-results+json' })), level);
      return fetchText(d.url, `sk_register_${level}.csv`, cacheDir);
    };
    return parseSlovakia(await get('region'), await get('county'), await get('municipality'));
  },
};
