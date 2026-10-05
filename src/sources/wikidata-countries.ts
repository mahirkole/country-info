import type { SourceMeta } from '../model.js';
import { loadWikidataDivisions, type WdCountry } from './wikidata-divisions.js';

/**
 * Countries whose divisions come from Wikidata. Bands are the official counts (checked 2026-10-05 against the
 * class instance counts); a level outside its band is not loaded. Classes were taken from the items GeoNames
 * links to (entity_xrefs) or from named municipalities, never from memory alone.
 */
export const WD_COUNTRIES: WdCountry[] = [
  {
    cc: 'DK', country: 'Q35', langs: ['da'],
    levels: [
      { key: 'region', classes: ['Q62326'], level: 1, type: 'region', typeLocal: 'region', expected: [5, 5], exclude: { Q131281582: 'Region Østdanmark: a merged area, not one of the five regions' } },
      { key: 'kommune', classes: ['Q2177636'], level: 2, type: 'municipality', typeLocal: 'kommune', expected: [98, 98] },
    ],
  },
  {
    cc: 'FI', country: 'Q33', langs: ['fi', 'sv'],
    levels: [
      { key: 'maakunta', classes: ['Q193512'], level: 1, type: 'region', typeLocal: 'maakunta', expected: [19, 19] },
      { key: 'kunta', classes: ['Q856076'], level: 2, type: 'municipality', typeLocal: 'kunta', expected: [308, 308] },
    ],
  },
  {
    cc: 'BE', country: 'Q31', langs: ['nl', 'fr', 'de'],
    levels: [
      { key: 'gewest', classes: ['Q83057'], level: 1, type: 'region', typeLocal: 'gewest / région', expected: [3, 3] },
      { key: 'provincie', classes: ['Q83116'], level: 2, type: 'province', typeLocal: 'provincie / province', expected: [10, 10] },
      { key: 'gemeente', classes: ['Q493522'], level: 3, type: 'municipality', typeLocal: 'gemeente / commune', expected: [560, 566] },
    ],
  },
];

export const wikidataMeta = (c: WdCountry): SourceMeta => ({
  id: `wd-${c.cc.toLowerCase()}`,
  authority: `Wikidata (CC0) – administrative divisions of ${c.cc}`,
  url: 'https://www.wikidata.org/wiki/Wikidata:Licensing',
  license: 'CC0 1.0 (Wikidata structured data, read 2026-10-05; docs/licenses/wikidata.md). Community-maintained: a level is loaded only when its count matches the official statistics.',
  version: 'Wikidata (live)',
  attribution: 'Wikidata (CC0 1.0)',
});

export const wikidataLoader = (c: WdCountry) => () => loadWikidataDivisions(c);
