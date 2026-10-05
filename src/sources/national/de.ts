import type { EntityInput } from '../../model.js';
import { fetchBytes } from '../fetch.js';
import { readXlsx } from '../xlsx.js';
import { division, type NationalSource } from './types.js';

// Quarterly "Auszug aus dem Gemeindeverzeichnis"; the *Aktuell file is Destatis' stable alias for the newest one.
const URL = 'https://www.destatis.de/DE/Themen/Laender-Regionen/Regionales/Gemeindeverzeichnis/Administrativ/Archiv/GVAuszugQ/AuszugGV3QAktuell.xlsx?__blob=publicationFile';

const num = (s: string | undefined) => {
  const n = Number((s ?? '').replace(',', '.'));
  return s && Number.isFinite(n) ? n : null;
};

/**
 * Destatis Gemeindeverzeichnis (GV-ISys) rows. Satzart 10 Land, 20 Regierungsbezirk, 40 Kreis, 50 Gemeindeverband
 * (not modelled), 60 Gemeinde. Key columns are found from the sub-header (Land / RB / Kreis / VB / Gem), so a shifted
 * layout keeps working. Hierarchy: Land > Regierungsbezirk (only in some Länder) > Kreis > Gemeinde.
 */
export function parseGv(rows: string[][]): { entities: EntityInput[]; asOf: string | null } {
  const keyRow = rows.findIndex((r) => r.includes('Land') && r.includes('RB') && r.includes('Kreis') && r.includes('Gem'));
  if (keyRow < 0) throw new Error('Gemeindeverzeichnis sheet has no Land/RB/Kreis/Gem sub-header (layout changed)');
  const sub = rows[keyRow]!;
  const iLand = sub.indexOf('Land');
  const iRb = sub.indexOf('RB');
  const iKreis = sub.indexOf('Kreis');
  const iGem = sub.indexOf('Gem');
  const iLon = sub.indexOf('Längengrad');
  const iLat = sub.indexOf('Breitengrad');
  const top = rows[keyRow - 1] ?? [];
  const iName = top.findIndex((c) => /^Gemeindename/.test(c ?? ''));
  const iArea = top.findIndex((c) => /^Fläche/.test(c ?? ''));
  const iPop = top.findIndex((c) => /^Bevölkerung/.test(c ?? ''));
  if (iName < 0) throw new Error('Gemeindeverzeichnis sheet has no "Gemeindename" column');
  const asOf = rows.slice(keyRow, keyRow + 3).flat().map((c) => /Gebietsstand am (\d{2}\.\d{2}\.\d{4})/.exec(c ?? '')?.[1]).find(Boolean) ?? null;

  const out: EntityInput[] = [];
  const t = (r: string[], i: number) => (i < 0 ? '' : (r[i] ?? '').trim());
  const rbIds = new Set<string>();
  const kreisIds = new Set<string>();
  for (const r of rows.slice(keyRow + 1)) {
    const satz = t(r, 0);
    const land = t(r, iLand);
    if (!/^\d+$/.test(satz) || !land) continue;
    const rb = t(r, iRb);
    const kreis = t(r, iKreis);
    const name = t(r, iName);
    if (satz === '10') {
      out.push(division('DE', `land-${land}`, { parent: 'country:DE', name, level: 1, type: 'state', typeLocal: 'Land', extra: { ags: land } }));
    } else if (satz === '20') {
      rbIds.add(`${land}${rb}`);
      out.push(division('DE', `rb-${land}${rb}`, { parent: `div:DE:land-${land}`, name, level: 2, type: 'region', typeLocal: 'Regierungsbezirk', extra: { ags: `${land}${rb}` } }));
    } else if (satz === '40') {
      const ags = `${land}${rb}${kreis}`;
      kreisIds.add(ags);
      out.push(division('DE', `kreis-${ags}`, { parent: rbIds.has(`${land}${rb}`) ? `div:DE:rb-${land}${rb}` : `div:DE:land-${land}`, name, level: 3, type: 'district', typeLocal: 'Kreis', extra: { ags } }));
    } else if (satz === '60') {
      const gem = t(r, iGem);
      const kreisAgs = `${land}${rb}${kreis}`;
      const ags = `${kreisAgs}${gem}`;
      if (!kreisIds.has(kreisAgs)) continue; // Gemeinde without its Kreis row: do not invent a hierarchy
      const e = division('DE', `gem-${ags}`, {
        parent: `div:DE:kreis-${kreisAgs}`, name, level: 4, type: 'municipality', typeLocal: 'Gemeinde',
        extra: { ags, ars: `${land}${rb}${kreis}${t(r, iGem - 1)}${gem}`, area_km2: num(t(r, iArea)), population: num(t(r, iPop)) },
      });
      e.lon = num(t(r, iLon));
      e.lat = num(t(r, iLat));
      out.push(e);
    }
  }
  return { entities: out, asOf };
}

export const DE: NationalSource = {
  country: 'DE',
  meta: {
    id: 'nat-de',
    authority: 'Statistisches Bundesamt (Destatis) – Gemeindeverzeichnis (GV-ISys)',
    url: URL,
    license: 'Destatis copyright page (read): "Die Weiterverwendung ist sowohl für nicht gewerbliche als auch gewerbliche Zwecke erlaubt… Es bedarf keiner ausdrücklichen Genehmigung"; reproduction and distribution "mit Quellennachweis gestattet" (docs/licenses/nat-de.md). The GV-ISys page does not name dl-de/by-2-0 itself.',
    version: 'GV-ISys (current)',
    attribution: 'Quelle: Statistisches Bundesamt (Destatis), Gemeindeverzeichnis (GV-ISys).',
  },
  licenseStatus: 'read',
  levels: ['Land', 'Regierungsbezirk', 'Kreis', 'Gemeinde'],
  async load(cacheDir) {
    const sheet = readXlsx(await fetchBytes(URL, 'de_gv.xlsx', cacheDir)).find((s) => /^Onlineprodukt/i.test(s.name)) ?? readXlsx(await fetchBytes(URL, 'de_gv.xlsx', cacheDir))[1];
    if (!sheet) throw new Error('Destatis workbook has no data sheet');
    const { entities, asOf } = parseGv(sheet.rows);
    this.meta.version = `GV-ISys Gebietsstand ${asOf ?? sheet.name}`;
    this.meta.attribution = `Quelle: Statistisches Bundesamt (Destatis), Gemeindeverzeichnis (GV-ISys), Gebietsstand ${asOf ?? '?'}.`;
    return entities;
  },
};
