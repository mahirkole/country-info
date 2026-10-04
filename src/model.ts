export type EntityKind = 'country' | 'admin1' | 'admin2';

/** Canonical record produced by a source; this is what gets hashed and diffed. */
export interface EntityInput {
  id: string;
  kind: EntityKind;
  parent_id: string | null;
  country_code: string;
  code: string | null;
  name: string;
  name_ascii: string | null;
  lat: number | null;
  lon: number | null;
  data: Record<string, unknown>;
}
