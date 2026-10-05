-- Which record is "canonical" when several sources describe the same place (linked in entity_links):
-- the one from the source with the highest priority (official > Wikidata layer > GeoNames > other). Nothing is deleted.
ALTER TABLE sources ADD COLUMN priority smallint NOT NULL DEFAULT 0;
UPDATE sources SET priority = CASE
  WHEN id LIKE 'nat-%' OR id LIKE 'gisco-%' OR id = 'official-holidays' THEN 30
  WHEN id LIKE 'wd-%' THEN 20
  WHEN id = 'geonames' THEN 10
  ELSE 0
END;
