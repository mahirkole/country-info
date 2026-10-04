import type { EntityInput, SourceMeta } from '../model.js';
import { fetchText } from './fetch.js';
import { toIso } from './eu.js';

export const NUTS_VERSION = '2024';
export const LAU_VERSION = '2024';
const BASE = 'https://gisco-services.ec.europa.eu/distribution/v2';

export const GISCO_NUTS: SourceMeta = {
  id: 'gisco-nuts',
  authority: 'Eurostat GISCO',
  url: `${BASE}/nuts/csv/NUTS_AT_${NUTS_VERSION}.csv`,
  license: 'Eurostat reuse policy (CC BY 4.0); © EuroGeographics for administrative boundaries',
  version: `NUTS ${NUTS_VERSION}`,
};
export const GISCO_LAU: SourceMeta = {
  id: 'gisco-lau',
  authority: 'Eurostat GISCO',
  url: `${BASE}/lau/csv/LAU_RG_01M_${LAU_VERSION}_4326.csv`,
  license: 'Eurostat reuse policy (CC BY 4.0); © EuroGeographics for administrative boundaries',
  version: `LAU ${LAU_VERSION}`,
};

/** RFC 4180-ish CSV (quoted fields, embedded commas/newlines, BOM). */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  const src = text.replace(/^﻿/, '');
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]!;
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') (cell += '"', i++);
        else quoted = false;
      } else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') (row.push(cell), (cell = ''));
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(cell);
      cell = '';
      if (row.some((c) => c !== '')) rows.push(row);
      row = [];
    } else cell += ch;
  }
  if (cell !== '' || row.length) (row.push(cell), rows.push(row));
  const [header, ...body] = rows;
  if (!header) return [];
  return body.map((r) => Object.fromEntries(header.map((h, i) => [h.trim(), (r[i] ?? '').trim()])));
}

const clean = (s: string | undefined) => (s ?? '').replace(/ /g, ' ').trim();
const num = (s: string | undefined) => (s === undefined || s === '' || Number.isNaN(Number(s)) ? null : Number(s));
const KIND_BY_LENGTH: Record<number, EntityInput['kind']> = { 3: 'nuts1', 4: 'nuts2', 5: 'nuts3' };

/**
 * NUTS attribute table -> nuts1/2/3 entities for the listed ISO countries.
 * NUTS_ID prefixes give the hierarchy (`DE11` -> `DE1` -> `DE`); the 2-letter row is the country and is skipped.
 */
export function parseNuts(text: string, countries: ReadonlySet<string>): EntityInput[] {
  const out: EntityInput[] = [];
  for (const r of parseCsv(text)) {
    const nutsId = r['NUTS_ID'];
    const kind = nutsId ? KIND_BY_LENGTH[nutsId.length] : undefined;
    if (!nutsId || !kind) continue;
    const cc = toIso(r['CNTR_CODE'] ?? nutsId.slice(0, 2));
    if (!countries.has(cc)) continue;
    const latin = clean(r['NAME_LATN']);
    out.push({
      id: `nuts:${nutsId}`,
      kind,
      parent_id: nutsId.length === 3 ? `country:${cc}` : `nuts:${nutsId.slice(0, -1)}`,
      country_code: cc,
      code: nutsId,
      name: clean(r['NUTS_NAME']) || latin,
      name_ascii: null,
      lat: null,
      lon: null,
      data: {
        level: nutsId.length - 2,
        nuts_version: NUTS_VERSION,
        name_latin: latin || null,
        mount_type: num(r['MOUNT_TYPE']),
        urban_type: num(r['URBN_TYPE']),
        coast_type: num(r['COAST_TYPE']),
      },
    });
  }
  return out;
}

/** LAU (municipalities) -> `lau` entities attached directly to the country (the CSV carries no NUTS3 link). */
export function parseLau(text: string, countries: ReadonlySet<string>): EntityInput[] {
  const out: EntityInput[] = [];
  for (const r of parseCsv(text)) {
    const gid = r['GISCO_ID'];
    const name = clean(r['LAU_NAME']);
    if (!gid || !name) continue;
    const cc = toIso(r['CNTR_CODE'] ?? gid.slice(0, 2));
    if (!countries.has(cc)) continue;
    out.push({
      id: `lau:${gid}`,
      kind: 'lau',
      parent_id: `country:${cc}`,
      country_code: cc,
      code: gid.includes('_') ? gid.slice(gid.indexOf('_') + 1) : gid,
      name,
      name_ascii: null,
      lat: null,
      lon: null,
      data: { lau_version: LAU_VERSION, population: num(r['POP_' + LAU_VERSION]), area_km2: num(r['AREA_KM2']) },
    });
  }
  return out;
}

export async function loadNuts(cacheDir: string, countries: ReadonlySet<string>): Promise<EntityInput[]> {
  return parseNuts(await fetchText(GISCO_NUTS.url!, `nuts_${NUTS_VERSION}.csv`, cacheDir), countries);
}
export async function loadLau(cacheDir: string, countries: ReadonlySet<string>): Promise<EntityInput[]> {
  return parseLau(await fetchText(GISCO_LAU.url!, `lau_${LAU_VERSION}.csv`, cacheDir), countries);
}
