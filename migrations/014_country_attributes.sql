-- Country attributes derived from Unicode CLDR (week, measurement, units, calendar, time, currency, locale) and per-locale formats (dates, times, numbers).
CREATE TABLE entity_attributes (
  entity_id  text NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  grp        text NOT NULL,              -- 'currency' | 'week' | 'time' | 'measurement' | 'units' | 'calendar' | 'locale'
  data       jsonb NOT NULL,
  source     text NOT NULL,
  vintage    text,                       -- source release, e.g. 'CLDR 48'
  PRIMARY KEY (entity_id, grp)
);
CREATE TABLE locale_formats (
  locale     text PRIMARY KEY,           -- CLDR locale, e.g. 'tr', 'pt-PT'
  data       jsonb NOT NULL,             -- { date, time, datetime, numbers }
  source     text NOT NULL,
  vintage    text
);
-- Named scope selections owned by an API key (NULL key = created by an admin).
CREATE TABLE scope_profiles (
  id         bigserial PRIMARY KEY,
  api_key_id bigint REFERENCES api_keys(id) ON DELETE CASCADE,
  name       text NOT NULL,
  scopes     text[] NOT NULL,
  countries  text[],
  mode       text NOT NULL DEFAULT 'union' CHECK (mode IN ('union', 'intersect')),
  locale     text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX scope_profiles_name_idx ON scope_profiles (coalesce(api_key_id, 0), name);
ALTER TABLE api_keys ADD COLUMN default_profile text;
