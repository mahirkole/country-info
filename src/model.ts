export type EntityKind = 'country' | 'admin1' | 'admin2' | 'nuts1' | 'nuts2' | 'nuts3' | 'lau' | 'holiday';

/** Where a batch of records came from; stored in `sources` and referenced by every entity. */
export interface SourceMeta {
  id: string;
  authority: string;
  url?: string;
  license?: string;
  version?: string;
  /** Credit line to display when redistributing this source's data. */
  attribution?: string;
}

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
