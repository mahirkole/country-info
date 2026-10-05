import type pg from 'pg';
import type { EntityInput, SourceMeta } from './model.js';
import type { IngestScope } from './ingest.js';
import { config } from './config.js';
import { EU27 } from './sources/eu.js';
import { GEONAMES, loadGeoNames } from './sources/geonames.js';
import { GISCO_LAU, GISCO_NUTS, loadLau, loadNuts } from './sources/gisco.js';
import { NATIONAL } from './sources/national/index.js';
import { WD_COUNTRIES, wikidataLoader, wikidataMeta } from './sources/wikidata-countries.js';
import { HOLIDAYS_SOURCE, loadHolidayFiles } from './holidays/load.js';
import { compileHolidays } from './holidays/rules.js';
import { logBody } from './sources/fetch.js';

export type Cadence = 'daily' | 'weekly' | 'monthly' | 'annual' | 'event';
export type Verdict = 'green' | 'amber' | 'red' | 'unread';

/** Everything the refresh runner needs to keep one source up to date. */
export interface RefreshTarget {
  meta: SourceMeta;
  cadence: Cadence;
  /** Sanity band for the number of records one run must produce; outside it the run is not applied. */
  expectedRows: [number, number];
  scope: IngestScope;
  load(cacheDir: string): Promise<EntityInput[]>;
  /** Pages whose text defines the license; watched for changes (license drift). */
  licenseUrls: string[];
  licenseVerdict: Verdict;
  commercialUse: string;
}

const NUTS_COUNTRIES = [...EU27, 'TR'];

const nationalTargets = (): RefreshTarget[] => {
  const info: Record<string, { cadence: Cadence; rows: [number, number]; licenseUrls: string[]; verdict: Verdict; commercial: string }> = {
    US: { cadence: 'annual', rows: [3000, 3600], licenseUrls: ['https://www.census.gov/about/policies/open-gov/open-data.html'], verdict: 'amber', commercial: 'federal government work (17 U.S.C. § 105); page statement not located' },
    FR: { cadence: 'monthly', rows: [35000, 41000], licenseUrls: ['https://www.insee.fr/fr/information/2008466'], verdict: 'green', commercial: 'Licence Ouverte 2.0 (INSEE): commercial reuse allowed with "Source : Insee" + last-update date, no alteration of meaning; docs/licenses/nat-fr.md' },
    IT: { cadence: 'monthly', rows: [7500, 8600], licenseUrls: ['https://www.istat.it/note-legali/'], verdict: 'green', commercial: 'CC BY 4.0 (ISTAT Note legali)' },
    NL: { cadence: 'annual', rows: [300, 420], licenseUrls: ['https://www.cbs.nl/en-gb/about-us/website/copyright'], verdict: 'amber', commercial: 'CC BY 4.0 for website content; table-specific text not located' },
    SE: { cadence: 'annual', rows: [300, 330], licenseUrls: ['https://www.scb.se/en/services/open-data-api/', 'https://statistikdatabasen.scb.se/api/v2/config'], verdict: 'green', commercial: 'CC0 (SCB open data): use, disseminate and sell without attribution; see docs/licenses/nat-se.md' },
    CZ: { cadence: 'annual', rows: [6000, 6800], licenseUrls: ['https://csu.gov.cz/podminky_pro_vyuzivani_a_dalsi_zverejnovani_statistickych_udaju_csu'], verdict: 'green', commercial: 'CC BY 4.0 (ČSÚ); attribution and metadata must travel with the data; see docs/licenses/nat-cz.md' },
    DE: { cadence: 'monthly', rows: [10000, 12500], licenseUrls: ['https://www.destatis.de/DE/Service/Impressum/copyright-allgemein.html'], verdict: 'green', commercial: 'Destatis copyright page: commercial reuse allowed with source citation; docs/licenses/nat-de.md' },
    AT: { cadence: 'annual', rows: [2000, 2400], licenseUrls: ['https://www.statistik.at/ueber-uns/aufgaben-und-grundsaetze/rechtsgrundlagen/allgemeine-geschaeftsbedingungen', 'https://www.statistik.at/services/tools/datenzugang/opendata'], verdict: 'green', commercial: 'CC BY 4.0 (open.data) and AGB § 10: commercial reproduction/distribution with source; mark changes as edited; docs/licenses/nat-at.md' },
    CA: { cadence: 'annual', rows: [5000, 5800], licenseUrls: ['https://www.statcan.gc.ca/en/reference/licence'], verdict: 'green', commercial: 'Statistics Canada Open Licence: use, sale, value-added products, sublicensing; attribution and no-endorsement wording required; docs/licenses/nat-ca.md' },
    CH: { cadence: 'annual', rows: [2000, 2600], licenseUrls: ['https://opendata.swiss/en/terms-of-use'], verdict: 'amber', commercial: 'opendata.swiss OPEN term: commercial use allowed, source recommended; redistribution/resale not stated (docs/licenses/nat-ch.md)' },
    AU: { cadence: 'annual', rows: [2800, 3600], licenseUrls: ['https://www.abs.gov.au/website-privacy-copyright-and-disclaimer'], verdict: 'green', commercial: 'CC BY 4.0 for ABS website material (exceptions: logo, Coat of Arms, microdata, third-party content); docs/licenses/nat-au.md' },
    GB: { cadence: 'annual', rows: [340, 420], licenseUrls: ['https://www.ons.gov.uk/methodology/geography/licences'], verdict: 'amber', commercial: 'Open Government Licence v3.0 (ONS Licences page): commercial use, distribution, adaptation with ONS attribution; names-and-codes tables not named explicitly; no postcode/UPRN; docs/licenses/nat-gb.md' },
    ES: { cadence: 'annual', rows: [8100, 8300], licenseUrls: ['https://www.ine.es/ss/Satellite?L=es_ES&c=Page&cid=1254735849170&p=1254735849170&pagename=MetodologiaYEstandares%2FINELayout'], verdict: 'amber', commercial: 'INE reuse notice: commercial or non-commercial reuse of INE-sourced information, cite INE, do not distort or imply endorsement; docs/licenses/nat-es.md' },
    PT: { cadence: 'annual', rows: [3200, 3500], licenseUrls: ['https://www.dgterritorio.gov.pt/dados-abertos'], verdict: 'green', commercial: 'CC BY 4.0 (DGT open-data page, dados.gov.pt cc-by): free use, credit DGT; continental Portugal only; docs/licenses/nat-pt.md' },
    JP: { cadence: 'annual', rows: [1800, 2100], licenseUrls: ['https://www.soumu.go.jp/menu_kyotsuu/policy/tyosaku.html'], verdict: 'green', commercial: 'MIC site: content under Public Data Terms v1.0 (CC BY-compatible), commercial use stated in dossier; credit required, no implying state authorship; docs/licenses/nat-jp.md' },
    PL: { cadence: 'annual', rows: [2850, 2900], licenseUrls: ['https://api.stat.gov.pl/Home/BdlApi', 'https://bdl.stat.gov.pl/bdl/start'], verdict: 'green', commercial: 'CC BY 4.0 stated by GUS on the BDL API page and BDL site footer; attribution required; anonymous API quota 100 calls/15 min; docs/licenses/nat-pl.md' },
    NO: { cadence: 'monthly', rows: [350, 400], licenseUrls: ['https://kartkatalog.geonorge.no/api/getdata/041f1e6e-bdbc-4091-b48f-8a5990f3cc5b'], verdict: 'green', commercial: 'CC BY 4.0 (dataset records), commercial use allowed per Kartverket terms; API record status Arkivert, see docs/licenses/nat-no.md' },
  };
  return Object.entries(NATIONAL).map(([cc, s]) => {
    const i = info[cc];
    if (!i) throw new Error(`national source ${cc} has no refresh metadata in src/targets.ts`);
    return { meta: s.meta, cadence: i.cadence, expectedRows: i.rows, scope: { kinds: ['division'], countries: [cc] }, load: s.load.bind(s), licenseUrls: i.licenseUrls, licenseVerdict: i.verdict, commercialUse: i.commercial };
  });
};

export function allTargets(): RefreshTarget[] {
  return everyTarget().filter((t) => !config.disabledSources.includes(t.meta.id));
}

const wikidataTargets = (): RefreshTarget[] =>
  WD_COUNTRIES.map((c) => ({
    meta: wikidataMeta(c), cadence: 'monthly' as Cadence, expectedRows: [c.levels.reduce((n, l) => n + l.expected[0], 0) - 5, c.levels.reduce((n, l) => n + l.expected[1], 0) + 5] as [number, number],
    scope: { kinds: ['division'], countries: [c.cc] }, load: wikidataLoader(c), licenseUrls: ['https://www.wikidata.org/wiki/Wikidata:Licensing'],
    licenseVerdict: 'green' as Verdict, commercialUse: 'CC0 1.0: no restrictions; community data, loaded only when counts match official statistics; docs/licenses/wikidata.md',
  }));

function everyTarget(): RefreshTarget[] {
  const geoKinds = ['country', 'admin1', ...(config.ingestAdmin2 ? ['admin2'] : []), ...(config.ingestCities ? ['city'] : [])];
  return [
    {
      meta: GEONAMES, cadence: 'weekly', expectedRows: [60_000, 200_000], scope: { kinds: geoKinds },
      load: (dir) => loadGeoNames(dir, { admin2: config.ingestAdmin2, cities: config.ingestCities }),
      licenseUrls: ['https://www.geonames.org/export/'], licenseVerdict: 'amber', commercialUse: 'CC BY 4.0 per dump readme, commercial use allowed; GeoNames aggregates 100+ upstream sources, many without a stated licence (see docs/licenses/geonames.md)',
    },
    {
      meta: GISCO_NUTS, cadence: 'annual', expectedRows: [1500, 1800], scope: { kinds: ['nuts1', 'nuts2', 'nuts3'], countries: NUTS_COUNTRIES },
      load: (dir) => loadNuts(dir, new Set(NUTS_COUNTRIES)),
      licenseUrls: ['https://ec.europa.eu/eurostat/web/main/help/copyright-notice'], licenseVerdict: 'amber', commercialUse: 'Eurostat general policy authorises commercial reuse with attribution; NUTS page has no licence sentence of its own and geometry derives from EuroBoundaryMap (docs/licenses/gisco-nuts.md); confirm in writing',
    },
    {
      meta: GISCO_LAU, cadence: 'annual', expectedRows: [85_000, 110_000], scope: { kinds: ['lau'], countries: [...EU27] },
      load: (dir) => loadLau(dir, new Set(EU27)),
      licenseUrls: ['https://ec.europa.eu/eurostat/web/main/help/copyright-notice'], licenseVerdict: 'red', commercialUse: 'NOT cleared: LAU download page requires accepting "specific download rules" whose text could not be read; geometry derives from EuroBoundaryMap and the sibling communes dataset is non-commercial (docs/licenses/gisco-lau.md). Do not sell until Eurostat/EuroGeographics confirm in writing.',
    },
    ...nationalTargets(),
    ...wikidataTargets(),
    {
      meta: HOLIDAYS_SOURCE, cadence: 'monthly', expectedRows: [500, 50_000], scope: { kinds: ['holiday'] },
      async load() {
        const files = await loadHolidayFiles();
        logBody(JSON.stringify(files));
        const to = new Date().getUTCFullYear() + 2;
        return files.flatMap((f) => compileHolidays(f, 2024, to));
      },
      licenseUrls: [], licenseVerdict: 'amber', commercialUse: 'facts with per-record citation; reuse terms of each statute site to be confirmed',
    },
  ];
}

/** official = state/intergovernmental publisher (nat-*, gisco-*, official-holidays); community = GeoNames, Wikidata and other crowd-sourced layers (wd-*). */
export function sourceClassOf(id: string): 'official' | 'community' {
  return id.startsWith('nat-') || id.startsWith('gisco-') || id === 'official-holidays' ? 'official' : 'community';
}

/** Store the static per-source metadata (cadence, bands, verdict) so the API can show it before the first run. */
export async function syncTargetMetadata(pool: pg.Pool, targets: RefreshTarget[]): Promise<void> {
  for (const t of targets) {
    await pool.query(
      `INSERT INTO sources (id, authority, url, license, version, attribution, cadence, expected_min, expected_max, license_verdict, commercial_use, source_class)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       ON CONFLICT (id) DO UPDATE SET cadence = $7, expected_min = $8, expected_max = $9, license_verdict = $10, commercial_use = $11, source_class = $12`,
      [t.meta.id, t.meta.authority, t.meta.url ?? null, t.meta.license ?? null, null, t.meta.attribution ?? null, t.cadence, t.expectedRows[0], t.expectedRows[1], t.licenseVerdict, t.commercialUse, sourceClassOf(t.meta.id)],
    );
  }
}
