import type { EntityInput } from '../../model.js';
import { logBody } from '../fetch.js';
import { division, type NationalSource } from './types.js';

const API = 'https://bdl.stat.gov.pl/api/v1';
/** BDL variable "Ludność – ogółem": a unit that has a value for a year existed in that year, which is how current units are told from historical ones. */
const POPULATION = 72305;

export interface BdlUnit { id: string; name: string }

const KINDS: Record<string, { type: string; local: string }> = { '1': { type: 'municipality', local: 'gmina miejska' }, '2': { type: 'municipality', local: 'gmina wiejska' }, '3': { type: 'municipality', local: 'gmina miejsko-wiejska' } };

/**
 * GUS Bank Danych Lokalnych: województwo (level 2) > powiat (5) > gmina (6). The unit list (`/units`) also holds every
 * historical unit since 1995 (2,692 gminas instead of 2,477), so powiats and gminas are taken from the units that carry a
 * population value for the latest year. Gmina ids encode their kind in the last digit (1 urban, 2 rural, 3 urban-rural;
 * 4/5 are the urban/rural parts of a 3 and 8 are Warsaw's dzielnice — not gminas) and their powiat in the first nine digits.
 */
export function mapBdl(voivodeships: BdlUnit[], powiats: BdlUnit[], gminas: BdlUnit[]): EntityInput[] {
  const out: EntityInput[] = [];
  const vkey = new Map<string, string>();
  for (const v of voivodeships) {
    vkey.set(v.id.slice(0, 4), v.id);
    out.push(division('PL', `woj-${v.id}`, { parent: 'country:PL', name: v.name.charAt(0) + v.name.slice(1).toLowerCase(), level: 1, type: 'province', typeLocal: 'województwo', extra: { gus_id: v.id } }));
  }
  const pids = new Set<string>();
  for (const p of powiats) {
    const v = vkey.get(p.id.slice(0, 4));
    if (!v) throw new Error(`BDL: powiat ${p.id} ${p.name} has no województwo`);
    pids.add(p.id);
    out.push(division('PL', `pow-${p.id}`, { parent: `div:PL:woj-${v}`, name: p.name.replace(/^Powiat /, ''), level: 2, type: 'county', typeLocal: /^Powiat m\. /.test(p.name) ? 'miasto na prawach powiatu' : 'powiat', extra: { gus_id: p.id } }));
  }
  const orphans: string[] = [];
  let n = 0;
  for (const g of gminas) {
    const t = KINDS[g.id.slice(-1)];
    if (!t) continue;
    const parent = `${g.id.slice(0, 9)}000`;
    if (!pids.has(parent)) {
      orphans.push(`${g.id} ${g.name}`);
      continue;
    }
    n++;
    out.push(division('PL', `gm-${g.id}`, { parent: `div:PL:pow-${parent}`, name: g.name, level: 3, type: t.type, typeLocal: t.local, extra: { gus_id: g.id } }));
  }
  if (voivodeships.length !== 16 || powiats.length < 370 || powiats.length > 390 || n < 2400 || n > 2550) throw new Error(`BDL: ${voivodeships.length} województw / ${powiats.length} powiats / ${n} gminas — layout changed`);
  if (orphans.length > 5) throw new Error(`BDL: ${orphans.length} gminas without a powiat (${orphans.slice(0, 3).join('; ')})`);
  return out;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** GUS allows 100 anonymous calls per 15 minutes; on 429 wait the announced "Retry-After: <n> sek" (at most 16 min) and retry. */
async function get<T>(path: string, fetchFn: typeof fetch = fetch): Promise<T> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetchFn(`${API}/${path}`, { headers: { accept: 'application/json', 'user-agent': 'country-info/0.1 (+https://github.com/mahirkole/country-info)' } });
    if (res.ok) {
      const body = await res.text();
      logBody(body);
      return JSON.parse(body) as T;
    }
    if (res.status !== 429) throw new Error(`BDL GET ${path}: ${res.status}`);
    await sleep(Math.min(16 * 60, parseInt(res.headers.get('retry-after') ?? '', 10) || 900) * 1000 + 1000);
  }
  throw new Error('BDL: still rate limited after waiting');
}

interface Page { totalRecords: number; results: BdlUnit[]; links: { next?: string } }

async function pages(path: string): Promise<BdlUnit[]> {
  const out: BdlUnit[] = [];
  for (let n = 0; ; n++) {
    const p = await get<Page>(`${path}&page-size=100&page=${n}`);
    out.push(...p.results.map((r) => ({ id: r.id, name: r.name })));
    if (!p.links.next) break;
    await sleep(700);
  }
  return out;
}

export const PL: NationalSource = {
  country: 'PL',
  meta: {
    id: 'nat-pl',
    authority: 'Główny Urząd Statystyczny (GUS) – Bank Danych Lokalnych API',
    url: 'https://api.stat.gov.pl/Home/BdlApi',
    license: 'CC BY 4.0, stated by GUS on the BDL API page and the BDL site footer (read 2026-10-05, docs/licenses/nat-pl.md): "Dane są możliwe do wykorzystywania w oparciu o licencję międzynarodową Creative Commons by 4.0 – Uznanie autorstwa". Anonymous API quota 100 calls / 15 min.',
    version: 'GUS BDL (current)',
    attribution: 'Źródło: Główny Urząd Statystyczny (GUS), Bank Danych Lokalnych (CC BY 4.0)',
  },
  licenseStatus: 'read',
  levels: ['województwo', 'powiat', 'gmina'],
  async load() {
    // ≈45 calls (1 + 4 + 40), inside the anonymous quota of 100 per 15 minutes
    const voivodeships = await pages('units?level=2&format=json');
    let year = new Date().getUTCFullYear() - 1;
    for (; year > 2020; year--) if ((await get<Page>(`data/by-variable/${POPULATION}?format=json&unit-level=5&year=${year}&page-size=1`)).totalRecords > 0) break;
    const by = (level: number) => pages(`data/by-variable/${POPULATION}?format=json&unit-level=${level}&year=${year}`);
    const powiats = await by(5);
    const gminas = await by(6);
    this.meta.version = `GUS BDL ${year}`;
    return mapBdl(voivodeships, powiats, gminas);
  },
};
