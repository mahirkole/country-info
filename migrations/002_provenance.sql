-- Provenance: every entity belongs to exactly one source; sources describe where data came from.
CREATE TABLE sources (
  id           text PRIMARY KEY,            -- e.g. geonames, gisco-nuts, gisco-lau, official-holidays
  authority    text NOT NULL,
  url          text,
  license      text,
  version      text,                        -- e.g. NUTS 2024, LAU 2023
  retrieved_at timestamptz
);

ALTER TABLE entities ADD COLUMN source_id text REFERENCES sources(id);
INSERT INTO sources (id, authority, url, license) VALUES
  ('geonames', 'GeoNames', 'https://download.geonames.org/export/dump/', 'CC-BY 4.0');
UPDATE entities SET source_id = 'geonames';
ALTER TABLE entities ALTER COLUMN source_id SET NOT NULL;
CREATE INDEX entities_source_idx ON entities (source_id, kind, country_code);
CREATE INDEX entities_holiday_date_idx ON entities ((data->>'date')) WHERE kind = 'holiday';

-- Equivalence between records of different sources (e.g. GeoNames admin1 <-> NUTS2).
CREATE TABLE entity_links (
  a_id       text NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  b_id       text NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  relation   text NOT NULL DEFAULT 'same_as',
  confidence real NOT NULL DEFAULT 1,
  method     text NOT NULL,
  PRIMARY KEY (a_id, b_id)
);
CREATE INDEX entity_links_b_idx ON entity_links (b_id);

-- Conflicts between sources that a human should resolve instead of silently overwriting.
CREATE TABLE review_items (
  id         bigserial PRIMARY KEY,
  entity_id  text NOT NULL,
  field      text NOT NULL,
  a_source   text NOT NULL, a_value jsonb,
  b_source   text NOT NULL, b_value jsonb,
  status     text NOT NULL DEFAULT 'open' CHECK (status IN ('open','accepted_a','accepted_b','dismissed')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE webhook_subscriptions ADD COLUMN kinds text[];   -- null = all kinds
