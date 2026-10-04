-- Refresh/operations metadata per source, and a run history.
ALTER TABLE sources
  ADD COLUMN cadence             text,           -- daily | weekly | monthly | annual | event
  ADD COLUMN expected_min        int,
  ADD COLUMN expected_max        int,
  ADD COLUMN content_sha256      text,           -- hash of the raw inputs of the last successful run
  ADD COLUMN last_checked_at     timestamptz,
  ADD COLUMN last_changed_at     timestamptz,
  ADD COLUMN next_due_at         timestamptz,
  ADD COLUMN status              text NOT NULL DEFAULT 'ok'
             CHECK (status IN ('ok','needs_review','license_changed','failed')),
  ADD COLUMN license_verdict     text CHECK (license_verdict IN ('green','amber','red','unread')),
  ADD COLUMN commercial_use      text,
  ADD COLUMN license_page_sha256 text,
  ADD COLUMN license_checked_at  timestamptz;

ALTER TABLE snapshots ADD COLUMN reason text;     -- e.g. "vintage_change: NUTS 2021 -> NUTS 2024"

CREATE TABLE source_runs (
  id          bigserial PRIMARY KEY,
  source_id   text NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  started_at  timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status      text NOT NULL DEFAULT 'running'
              CHECK (status IN ('running','unchanged','success','needs_review','failed','skipped')),
  rows        int,
  inserted    int, updated int, deleted int,
  raw_sha256  text,
  snapshot_id bigint REFERENCES snapshots(id),
  detail      text
);
CREATE INDEX source_runs_source_idx ON source_runs (source_id, id DESC);
