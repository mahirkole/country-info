/**
 * Canonical vocabulary for administrative units coming from national sources.
 * Every country names its levels differently (state, county, canton, prefecture, department, ...).
 * `division` entities carry `data.level` (1 = first level below the country, within that source),
 * `data.type` (one of ADMIN_TYPES, for cross-country queries) and `data.type_local` (the native
 * term, e.g. "département", "Kanton", "Parish"). `other` is the escape hatch; add a type here
 * when two countries need the same concept rather than overloading `other`.
 */
export const ADMIN_TYPES = [
  'state', 'province', 'region', 'prefecture', 'canton', 'county', 'district', 'department',
  'territory', 'municipality', 'city', 'town', 'village', 'commune', 'borough', 'parish',
  'ward', 'neighbourhood', 'street', 'other',
] as const;
export type AdminType = (typeof ADMIN_TYPES)[number];

export const isAdminType = (t: string): t is AdminType => (ADMIN_TYPES as readonly string[]).includes(t);
