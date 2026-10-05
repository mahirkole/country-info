-- Release notes also describe changes that are not entity snapshots (country attributes from CLDR): no snapshot, a kind.
ALTER TABLE release_notes ALTER COLUMN snapshot_id DROP NOT NULL;
ALTER TABLE release_notes ADD COLUMN kind text NOT NULL DEFAULT 'data' CHECK (kind IN ('data', 'attributes'));
