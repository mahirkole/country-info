/**
 * Source priority for choosing the canonical record among linked duplicates: official publishers first, then the
 * count-gated Wikidata layers, then GeoNames; anything else (enrichment-only sources) never wins.
 * Keep in sync with the backfill in migrations/006_source_priority.sql.
 */
export function sourcePriority(id: string): number {
  if (id.startsWith('nat-') || id.startsWith('gisco-') || id === 'official-holidays') return 30;
  if (id === 'cod-ab') return 25; // intergovernmental compilation of national upstreams: below the countries' own publishers, above Wikidata
  if (id.startsWith('wd-')) return 20;
  if (id === 'geonames') return 10;
  return 0;
}
