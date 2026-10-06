import type { EntityInput } from '../../model.js';
import { fetchText } from '../fetch.js';
import { division, type NationalSource } from './types.js';

const WFS = 'https://gsavalik.envir.ee/geoserver/ehak/ows?service=WFS&version=2.0.0&request=GetFeature&outputFormat=application/json&typeNames=ehak:omavalitsuste_piirid&propertyName=ehak_kood,omavalitsus,tyyp,maakond_kood,maakond,vers_algus,vers_lopp,seaduslik_alus';

interface Feature { properties?: { ehak_kood?: string; omavalitsus?: string; maakond_kood?: string; maakond?: string; vers_lopp?: string | null } }

/**
 * Maa- ja Ruumiamet EHAK layer of municipalities (WFS, attributes only): 15 counties (maakond) and their municipalities, rural (vald) and urban (linn).
 * The layer's own `tyyp` is unreliable (it says "vald" for "Haapsalu linn"), so the type comes from the name suffix. Features with an end
 * of validity (`vers_lopp`) are skipped. Settlements (asustusüksused) are not loaded.
 */
export function parseEstonia(json: unknown): EntityInput[] {
  const features = (json as { features?: Feature[] }).features;
  if (!Array.isArray(features) || features.length === 0) throw new Error('EHAK WFS: no features — layout changed');
  const out: EntityInput[] = [];
  const counties = new Set<string>();
  const seen = new Set<string>();
  for (const f of features) {
    const p = f.properties;
    if (!p || p.vers_lopp) continue;
    const { ehak_kood: code, omavalitsus: name, maakond_kood: ccode, maakond: cname } = p;
    if (!code || !/^\d{4}$/.test(code) || !name || !ccode || !/^\d{4}$/.test(ccode) || !cname) throw new Error(`EHAK WFS: unexpected feature ${JSON.stringify(p).slice(0, 120)} — layout changed`);
    if (seen.has(code)) throw new Error(`EHAK WFS: duplicate code ${code}`);
    seen.add(code);
    if (!counties.has(ccode)) {
      counties.add(ccode);
      out.push(division('EE', `cou-${ccode}`, { parent: 'country:EE', name: cname, level: 1, type: 'county', typeLocal: 'maakond', extra: { ehak: ccode } }));
    }
    const city = /\slinn$/.test(name);
    out.push(division('EE', `mun-${code}`, { parent: `div:EE:cou-${ccode}`, name, level: 2, type: city ? 'city' : 'municipality', typeLocal: city ? 'linn' : 'vald', extra: { ehak: code } }));
  }
  if (counties.size !== 15 || seen.size < 70 || seen.size > 90) throw new Error(`EHAK WFS: ${counties.size} counties and ${seen.size} municipalities (expected 15 and about 78) — layout changed`);
  return out;
}

export const EE: NationalSource = {
  country: 'EE',
  meta: {
    id: 'nat-ee',
    authority: 'Maa- ja Ruumiamet (Estonian Land and Spatial Development Board) – EHAK administrative units (WFS)',
    url: 'https://geoportaal.maaamet.ee/eng/Spatial-Data/Administrative-and-Settlement-Division-p312.html',
    license: 'Maa-amet page for this data set (read 2026-10-06, docs/licenses/nat-ee.md): "The use of administrative and settlement units data is not restricted, but the reference to the data source (i.e. Estonian Land and Spatial Development Board) and validity date must be made!"; the WFS capabilities add: "If not specified otherwise for a specific layer all data is published under the CC-BY 4.0 ... license and attributed to the Estonian Ministry of the Climate."',
    attribution: 'Administrative and settlement units, Estonian Land and Spatial Development Board (Maa- ja Ruumiamet), CC BY 4.0; data as of the refresh date',
  },
  licenseStatus: 'read',
  levels: ['maakond', 'vald/linn'],
  async load(cacheDir) {
    return parseEstonia(JSON.parse(await fetchText(WFS, 'ee_ehak_municipalities.json', cacheDir)));
  },
};
