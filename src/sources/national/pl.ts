import type { EntityInput } from '../../model.js';
import { logBody } from '../fetch.js';
import { division, type NationalSource } from './types.js';

const API = 'https://bdl.stat.gov.pl/api/v1/units';

export interface BdlUnit { id: string; name: string; parentId: string; level: number; kind?: string }

const TYPES: Record<string, { type: string; local: string }> = { '1': { type: 'municipality', local: 'gmina miejska' }, '2': { type: 'municipality', local: 'gmina wiejska' }, '3': { type: 'municipality', local: 'gmina miejsko-wiejska' } };

/**
 * GUS Bank Danych Lokalnych units: województwo (level 2) > powiat (5) > gmina (6, kinds 1-3; the urban/rural parts of
 * urban-rural gminas (4, 5) and Warsaw's dzielnice (8) are not separate gminas and are left out). Ids are GUS's 12-digit
 * statistical-unit ids; a województwo shares its first four digits with its powiats.
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
    out.push(division('PL', `pow-${p.id}`, { parent: `div:PL:woj-${v}`, name: p.name, level: 2, type: 'county', typeLocal: p.kind === '2' ? 'miasto na prawach powiatu' : 'powiat', extra: { gus_id: p.id } }));
  }
  const orphans: string[] = [];
  for (const g of gminas) {
    const t = TYPES[g.kind ?? ''];
    if (!t) continue;
    if (!pids.has(g.parentId)) {
      orphans.push(`${g.id} ${g.name}`);
      continue;
    }
    out.push(division('PL', `gm-${g.id}`, { parent: `div:PL:pow-${g.parentId}`, name: g.name, level: 3, type: t.type, typeLocal: t.local, extra: { gus_id: g.id } }));
  }
  if (voivodeships.length !== 16 || powiats.length < 370 || out.length - voivodeships.length - powiats.length < 2400) throw new Error(`BDL: ${voivodeships.length} województw / ${powiats.length} powiats — layout changed`);
  if (orphans.length > 20) throw new Error(`BDL: ${orphans.length} gminas without a powiat (${orphans.slice(0, 3).join('; ')})`);
  return out;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** GUS allows 100 anonymous calls per 15 minutes; on 429 wait the announced "Retry-After: <n> sek" (at most 16 min) and retry. */
async function page(level: number, n: number, fetchFn: typeof fetch = fetch): Promise<{ results: BdlUnit[]; links: { next?: string } }> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetchFn(`${API}?level=${level}&format=json&page-size=100&page=${n}`, { headers: { accept: 'application/json', 'user-agent': 'country-info/0.1 (+https://github.com/mahirkole/country-info)' } });
    if (res.ok) {
      const body = await res.text();
      logBody(body);
      return JSON.parse(body);
    }
    if (res.status !== 429) throw new Error(`BDL GET level ${level} page ${n}: ${res.status}`);
    await sleep(Math.min(16 * 60, parseInt(res.headers.get('retry-after') ?? '', 10) || 900) * 1000 + 1000);
  }
  throw new Error('BDL: still rate limited after waiting');
}

async function units(level: number): Promise<BdlUnit[]> {
  const out: BdlUnit[] = [];
  for (let n = 0; ; n++) {
    const p = await page(level, n);
    out.push(...p.results);
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
    // level 2 = województwa, 5 = powiaty, 6 = gminy (≈47 calls in total, inside the anonymous quota)
    const v = await units(2);
    const p = await units(5);
    const g = await units(6);
    return mapBdl(v, p, g);
  },
};
