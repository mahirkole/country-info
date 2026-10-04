import type { EntityInput, SourceMeta } from '../../model.js';

/**
 * How well the source's license was established from the publisher itself:
 * - read: the license/terms text was read on the publisher's site and is quoted in `meta.license`
 * - partial: the publisher states open data/reuse but the exact licence text was not located
 * - unread: not established; the source must not be ingested
 */
export type LicenseStatus = 'read' | 'partial' | 'unread';

export interface NationalSource {
  /** ISO 3166-1 alpha-2. */
  country: string;
  meta: SourceMeta;
  licenseStatus: LicenseStatus;
  /** Levels this source provides, in order, e.g. ['state', 'county']. */
  levels: string[];
  /** Download and map the source into `division` entities (ids `div:<CC>:<code>`). */
  load(cacheDir: string): Promise<EntityInput[]>;
}

/** Skeleton for a `division` entity so adapters only fill what differs. */
export function division(
  cc: string,
  code: string,
  o: { parent: string | null; name: string; level: number; type: string; typeLocal?: string | null; extra?: Record<string, unknown> },
): EntityInput {
  return {
    id: `div:${cc}:${code}`,
    kind: 'division',
    parent_id: o.parent,
    country_code: cc,
    code,
    name: o.name,
    name_ascii: null,
    lat: null,
    lon: null,
    data: { level: o.level, type: o.type, type_local: o.typeLocal ?? null, ...(o.extra ?? {}) },
  };
}
