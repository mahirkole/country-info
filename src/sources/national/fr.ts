import type { EntityInput } from '../../model.js';
import { fetchText } from '../fetch.js';
import { parseCsv } from '../csv.js';
import { division, type NationalSource } from './types.js';

const INSEE = 'https://www.insee.fr';
/** Presentation page of the COG; its first "Téléchargement des fichiers" link is the newest vintage. */
const COG_INDEX = `${INSEE}/fr/information/2560452`;
const LICENSE_PAGE = `${INSEE}/fr/information/2008466`;

type Row = Record<string, string>;

/** Newest "Téléchargement des fichiers" page linked from the COG index. */
export function findLatestDownloadPage(indexHtml: string): string {
  const m = /<a [^>]*href="(\/fr\/information\/\d+)"[^>]*>\s*Téléchargement des fichiers\s*<\/a>/i.exec(indexHtml);
  if (!m) throw new Error('INSEE COG index has no "Téléchargement des fichiers" link (page layout changed)');
  return m[1]!;
}

/** The three CSVs of the newest vintage on a download page. */
export function findCogFiles(pageHtml: string, indexHtml = ''): { year: string; region: string; departement: string; commune: string; updated: string | null } {
  const files = new Map<string, Map<string, string>>(); // year -> kind -> path
  for (const m of pageHtml.matchAll(/href="(\/fr\/statistiques\/fichier\/\d+\/v_(region|departement|commune)_(\d{4})\.csv)"/g)) {
    const [, path, kind, year] = m;
    files.set(year!, (files.get(year!) ?? new Map()).set(kind!, path!));
  }
  const year = [...files.keys()].sort().pop();
  const f = year ? files.get(year) : undefined;
  if (!year || !f?.get('region') || !f.get('departement') || !f.get('commune')) throw new Error('INSEE download page does not list region, departement and commune CSVs');
  // The licence asks for the last-update date; INSEE prints it on the COG index page (and sometimes on the download page).
  const updated = [pageHtml, indexHtml].map((h) => /Dernière mise à jour le\s*:\s*(\d{2}\/\d{2}\/\d{4})/.exec(h.replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;/g, ' ').replace(/\s+/g, ' '))?.[1]).find(Boolean) ?? null;
  return { year, region: f.get('region')!, departement: f.get('departement')!, commune: f.get('commune')!, updated };
}

/**
 * INSEE Code officiel géographique: région > département > commune; arrondissements municipaux (ARM) and
 * communes associées/déléguées (COMA/COMD) hang below their parent commune. No population (separate INSEE series).
 */
export function mapInsee(regions: Row[], departements: Row[], communes: Row[]): EntityInput[] {
  const out: EntityInput[] = [];
  const regionIds = new Set(regions.map((r) => r['REG']));
  for (const r of regions) {
    if (!r['REG']) continue;
    out.push(division('FR', `reg-${r['REG']}`, { parent: 'country:FR', name: r['LIBELLE'] ?? r['NCCENR'] ?? r['REG'], level: 1, type: 'region', typeLocal: 'région', extra: { insee: r['REG'], chef_lieu: r['CHEFLIEU'] || null } }));
  }
  const deptIds = new Set<string>();
  for (const d of departements) {
    if (!d['DEP']) continue;
    deptIds.add(d['DEP']);
    out.push(division('FR', `dep-${d['DEP']}`, {
      parent: d['REG'] && regionIds.has(d['REG']) ? `div:FR:reg-${d['REG']}` : 'country:FR',
      name: d['LIBELLE'] ?? d['NCCENR'] ?? d['DEP'], level: 2, type: 'department', typeLocal: 'département', extra: { insee: d['DEP'], chef_lieu: d['CHEFLIEU'] || null },
    }));
  }
  const communeIds = new Set(communes.filter((c) => c['TYPECOM'] === 'COM').map((c) => c['COM']));
  const seen = new Set<string>();
  for (const c of communes) {
    const code = c['COM'];
    const type = c['TYPECOM'];
    if (!code || !type) continue;
    const id = `com-${code}`;
    if (seen.has(id)) continue; // a code can repeat for associated/delegated parts of the same commune: first one wins
    seen.add(id);
    const name = c['LIBELLE'] ?? c['NCCENR'] ?? code;
    if (type === 'COM') {
      out.push(division('FR', id, { parent: c['DEP'] && deptIds.has(c['DEP']) ? `div:FR:dep-${c['DEP']}` : 'country:FR', name, level: 3, type: 'municipality', typeLocal: 'commune', extra: { insee: code, cog_type: type, canton: c['CAN'] || null, arrondissement: c['ARR'] || null } }));
    } else {
      const parent = c['COMPARENT'] && communeIds.has(c['COMPARENT']) ? `div:FR:com-${c['COMPARENT']}` : null;
      if (!parent) continue; // part without a known parent commune: skip rather than invent a hierarchy
      const local = type === 'ARM' ? 'arrondissement municipal' : type === 'COMA' ? 'commune associée' : 'commune déléguée';
      out.push(division('FR', id, { parent, name, level: 4, type: type === 'ARM' ? 'borough' : 'municipality', typeLocal: local, extra: { insee: code, cog_type: type } }));
    }
  }
  return out;
}

/** insee.fr is reachable but occasionally resets connections through proxies; retry a few times. */
async function get(url: string, name: string, cacheDir: string): Promise<string> {
  let last: unknown;
  for (let i = 0; i < 4; i++) {
    try {
      return await fetchText(url, name, cacheDir);
    } catch (e) {
      last = e;
      await new Promise((r) => setTimeout(r, 2000 * (i + 1)));
    }
  }
  throw last;
}

export const FR: NationalSource = {
  country: 'FR',
  meta: {
    id: 'nat-fr',
    authority: 'INSEE (Institut national de la statistique et des études économiques) – Code officiel géographique',
    url: COG_INDEX,
    license: 'Licence Ouverte / Open Licence 2.0 (Etalab). INSEE (insee.fr/fr/information/2008466, read): "mises à disposition sous la Licence Ouverte… Cette licence autorise la réutilisation libre, y compris à des fins commerciales, sous réserve de mentionner la source sous la forme « Source : Insee », de mentionner la date de dernière mise à jour… et de ne pas altérer le sens des informations"; licence text read on Etalab\'s official repository (docs/licenses/nat-fr.md).',
    version: 'INSEE COG (current)',
    attribution: 'Source : Insee, Code officiel géographique. Licence Ouverte 2.0.',
  },
  licenseStatus: 'read',
  levels: ['région', 'département', 'commune (+ arrondissement municipal, commune associée/déléguée)'],
  async load(cacheDir) {
    const index = await get(COG_INDEX, 'fr_cog_index.html', cacheDir);
    const page = findLatestDownloadPage(index);
    const files = findCogFiles(await get(`${INSEE}${page}`, 'fr_cog_page.html', cacheDir), index);
    this.meta.version = `INSEE COG ${files.year}`;
    this.meta.attribution = `Source : Insee, Code officiel géographique ${files.year}${files.updated ? ` (mise à jour du ${files.updated})` : ''}. Licence Ouverte 2.0.`;
    const csv = async (path: string, name: string) => parseCsv(await get(`${INSEE}${path}`, name, cacheDir));
    return mapInsee(await csv(files.region, `fr_region_${files.year}.csv`), await csv(files.departement, `fr_departement_${files.year}.csv`), await csv(files.commune, `fr_commune_${files.year}.csv`));
  },
};
