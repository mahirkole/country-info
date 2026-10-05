-- Cross references to other identifier systems (Wikidata QID, ...) and multilingual names, both derived data.
CREATE TABLE entity_xrefs (
  entity_id  text NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  scheme     text NOT NULL,              -- 'wikidata'
  value      text,                       -- e.g. Q406; NULL = looked up, no unique match (not asked again until stale)
  source     text NOT NULL,              -- who provided it, e.g. 'wikidata'
  checked_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (entity_id, scheme)
);
CREATE INDEX entity_xrefs_value_idx ON entity_xrefs (scheme, value);

CREATE TABLE entity_names (
  entity_id  text NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  lang       text NOT NULL,              -- BCP 47 / Wikidata language code
  name       text NOT NULL,
  source     text NOT NULL,
  PRIMARY KEY (entity_id, lang, source)
);

-- official = produced by the state/an intergovernmental body; community = crowd-sourced or aggregated.
ALTER TABLE sources ADD COLUMN source_class text CHECK (source_class IN ('official','community'));
UPDATE sources SET source_class = CASE
  WHEN id IN ('geonames','wikidata') THEN 'community'
  WHEN id LIKE 'nat-%' OR id LIKE 'gisco-%' OR id = 'official-holidays' THEN 'official'
END;
