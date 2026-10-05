-- Confirmed successor relations between units of different releases. The old unit is usually no longer in `entities`
-- (it was deleted by the release), so there is no foreign key: ids are kept as written in the change log.
CREATE TABLE entity_successors (
  old_id      text NOT NULL,
  new_id      text NOT NULL,
  relation    text NOT NULL CHECK (relation IN ('replaced_by','merged_into','split_into')),
  confidence  real NOT NULL DEFAULT 1,
  method      text NOT NULL,            -- 'suggested+confirmed' | 'manual'
  snapshot_id bigint,
  confirmed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (old_id, new_id)
);
CREATE INDEX entity_successors_new_idx ON entity_successors (new_id);
