/**
 * Scope catalog: what each named slice of country information contains. A scope is a unit the customer can pick
 * (`default`, `divisions`, `currency`, `datetime`, ...); the catalog doubles as the machine-readable metadata
 * (`/v1/scopes`, `/v1/schema*`). Every scope needs a resolver in resolve.ts (a test enforces the pairing).
 */
export const SCHEMA_VERSION = 1;

export type AppliesTo = 'country' | 'admin1' | 'admin2' | 'locality';
export type FieldType = 'string' | 'number' | 'boolean' | 'array' | 'object';

export interface FieldDef { path: string; type: FieldType; description: string; source_id: string; format?: string }
export interface ScopeDef {
  id: string;
  title: string;
  description: string;
  applies_to: AppliesTo[];
  default: boolean;
  /** `none`: the scope exists but no data is loaded for this granularity yet (reported honestly, never invented). */
  availability: Partial<Record<AppliesTo, 'full' | 'partial' | 'none'>>;
  fields: FieldDef[];
}

const f = (path: string, type: FieldType, description: string, source_id: string, format?: string): FieldDef => ({ path, type, description, source_id, ...(format ? { format } : {}) });

export const CATALOG: ScopeDef[] = [
  {
    id: 'default', title: 'Country', description: 'Identity and basic facts of the country.', applies_to: ['country'], default: true, availability: { country: 'full' },
    fields: [
      f('code', 'string', 'ISO 3166-1 alpha-2', 'geonames'), f('name', 'string', 'English name', 'geonames'),
      f('iso3', 'string', 'ISO 3166-1 alpha-3', 'geonames'), f('numeric', 'string', 'ISO 3166-1 numeric', 'geonames'),
      f('capital', 'string', 'Capital', 'geonames'), f('continent', 'string', 'Continent code', 'geonames'),
      f('population', 'number', 'Population', 'geonames'), f('area_km2', 'number', 'Area in km²', 'geonames'),
      f('un_status', 'string', '`member` or `other`', 'cldr'), f('names', 'object', 'Localized names by language', 'cldr'),
    ],
  },
  {
    id: 'contact', title: 'Telephony and web', description: 'Calling code, top-level domain, postal-code format, neighbours and languages (community data).', applies_to: ['country'], default: false, availability: { country: 'full' },
    fields: [
      f('phone_code', 'string', 'International calling code', 'geonames'), f('tld', 'string', 'Country-code top-level domain', 'geonames'),
      f('postal_code.format', 'string', 'Postal-code format', 'geonames'), f('postal_code.regex', 'string', 'Postal-code regex', 'geonames'),
      f('languages', 'array', 'Languages (BCP 47)', 'geonames'), f('neighbours', 'array', 'Neighbouring countries', 'geonames'),
    ],
  },
  {
    id: 'divisions', title: 'Administrative divisions', description: 'Levels present and the list of first/second-level units (`level` option).', applies_to: ['country', 'admin1', 'admin2'], default: false, availability: { country: 'full', admin1: 'full', admin2: 'partial' },
    fields: [f('levels', 'object', 'Number of units per level (admin1, admin2)', 'entities'), f('units', 'array', 'Units of the requested level (id, code, name, type)', 'entities')],
  },
  {
    id: 'cities', title: 'Cities', description: 'Cities with at least 15,000 inhabitants (GeoNames, community data), largest first, and the time zones they lie in.', applies_to: ['locality'], default: false, availability: { locality: 'partial' },
    fields: [
      f('count', 'number', 'Number of cities in the data set for the country', 'geonames'), f('timezones', 'array', 'IANA time zones of those cities (a country may have more zones than cities ≥15,000 reveal)', 'geonames'),
      f('items', 'array', 'Cities: id, name, population, lat, lon, timezone, admin1_code, feature_code (`limit`, default 100)', 'geonames'),
    ],
  },
  {
    id: 'holidays', title: 'Public holidays', description: 'Holidays of a year (`year`, optional `region`).', applies_to: ['country', 'admin1'], default: false, availability: { country: 'partial', admin1: 'partial', locality: 'none' },
    fields: [f('year', 'number', 'Requested year', 'official-holidays'), f('items', 'array', 'Holidays (date, name, type, verification, source)', 'official-holidays')],
  },
  {
    id: 'currency', title: 'Currency', description: 'Legal-tender currencies and minor-unit digits.', applies_to: ['country'], default: false, availability: { country: 'full' },
    fields: [f('primary', 'string', 'Current primary currency (ISO 4217)', 'cldr'), f('codes', 'array', 'All current legal tenders', 'cldr'), f('details', 'array', 'Per currency: code, digits, rounding, cash_digits', 'cldr')],
  },
  {
    id: 'datetime', title: 'Date, time and calendar', description: 'Date and time patterns (CLDR syntax) of the default or requested locale, hour cycle, week and calendar conventions.', applies_to: ['country'], default: false, availability: { country: 'full' },
    fields: [
      f('locale', 'string', 'Locale the patterns come from', 'cldr'),
      f('date.short', 'string', 'Short date pattern', 'cldr', 'CLDR/LDML'), f('date.medium', 'string', 'Medium date pattern', 'cldr', 'CLDR/LDML'),
      f('date.long', 'string', 'Long date pattern', 'cldr', 'CLDR/LDML'), f('date.full', 'string', 'Full date pattern', 'cldr', 'CLDR/LDML'),
      f('time.short', 'string', 'Short time pattern', 'cldr', 'CLDR/LDML'), f('time.medium', 'string', 'Medium time pattern', 'cldr', 'CLDR/LDML'),
      f('time.long', 'string', 'Long time pattern', 'cldr', 'CLDR/LDML'), f('time.full', 'string', 'Full time pattern', 'cldr', 'CLDR/LDML'),
      f('datetime.short', 'string', 'Date-time glue pattern', 'cldr', 'CLDR/LDML'),
      f('hour_cycle', 'string', 'h12 | h23 | h11 | h24 (territory preference)', 'cldr'), f('first_day', 'string', 'First day of the week', 'cldr'),
      f('weekend_start', 'string', 'First weekend day', 'cldr'), f('weekend_end', 'string', 'Last weekend day', 'cldr'), f('min_days', 'number', 'Minimal days in the first week', 'cldr'),
      f('calendars', 'array', 'Preferred calendars, most used first', 'cldr'),
    ],
  },
  {
    id: 'numbers', title: 'Number formatting', description: 'Decimal and grouping separators, percent and currency patterns.', applies_to: ['country'], default: false, availability: { country: 'full' },
    fields: [f('locale', 'string', 'Locale the symbols come from', 'cldr'), f('numbering_system', 'string', 'Digit system', 'cldr'), f('decimal', 'string', 'Decimal separator', 'cldr'), f('group', 'string', 'Grouping separator', 'cldr'), f('percent_pattern', 'string', 'Percent pattern', 'cldr', 'CLDR/LDML'), f('currency_pattern', 'string', 'Currency pattern', 'cldr', 'CLDR/LDML')],
  },
  {
    id: 'measurement', title: 'Weights and measures', description: 'Measurement system, paper size, temperature scale and preferred units per quantity and usage (mass, length, speed...).', applies_to: ['country'], default: false, availability: { country: 'full' },
    fields: [f('system', 'string', 'metric | US | UK', 'cldr'), f('paper_size', 'string', 'A4 | US-Letter', 'cldr'), f('temperature', 'string', 'Temperature system', 'cldr'), f('units', 'object', 'Preferred units: quantity → usage → ordered unit list', 'cldr')],
  },
  {
    id: 'locale', title: 'Locale', description: 'Primary locale (language and script) from CLDR likely subtags.', applies_to: ['country'], default: false, availability: { country: 'full' },
    fields: [f('default', 'string', 'Default locale', 'cldr'), f('language', 'string', 'Language', 'cldr'), f('script', 'string', 'Script', 'cldr'), f('available', 'array', 'CLDR locales of this territory (e.g. de-CH, fr-CH, it-CH); any of them can be passed as `locale`', 'cldr')],
  },
];

export const SCOPE_IDS = CATALOG.map((s) => s.id);
export const scopeById = (id: string): ScopeDef | undefined => CATALOG.find((s) => s.id === id);
export const DEFAULT_SCOPES = CATALOG.filter((s) => s.default).map((s) => s.id);
