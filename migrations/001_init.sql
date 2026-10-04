-- Generic hierarchical place model. Countries, subdivisions and (later) cities,
-- neighbourhoods and streets all live in `entities`; kind-specific and future
-- attributes (holidays, currencies, languages, postal codes) live in `data`.
CREATE TABLE entities (
  id           text PRIMARY KEY,            -- stable key: country:TR, gn:<geonameid>
  kind         text NOT NULL,               -- country | admin1 | admin2 | ...
  parent_id    text REFERENCES entities(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  country_code char(2) NOT NULL,
  code         text,                        -- ISO alpha-2 for countries, GeoNames admin code otherwise
  name         text NOT NULL,
  name_ascii   text,
  lat          double precision,
  lon          double precision,
  data         jsonb NOT NULL DEFAULT '{}',
  content_hash text NOT NULL,
  updated_seq  bigint NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX entities_parent_idx  ON entities (parent_id);
CREATE INDEX entities_country_idx ON entities (country_code, kind);
CREATE INDEX entities_name_idx    ON entities (lower(name) text_pattern_ops);

-- One row per ingest run.
CREATE TABLE snapshots (
  id         bigserial PRIMARY KEY,
  source     text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  from_seq   bigint NOT NULL,               -- changes with seq in (from_seq, to_seq] belong to this snapshot
  to_seq     bigint NOT NULL,
  inserted   int NOT NULL DEFAULT 0,
  updated    int NOT NULL DEFAULT 0,
  deleted    int NOT NULL DEFAULT 0,
  unchanged  int NOT NULL DEFAULT 0
);

-- Append-only change log. seq is the global cursor consumers page with.
CREATE SEQUENCE change_seq;
CREATE TABLE changes (
  seq         bigint PRIMARY KEY,
  snapshot_id bigint NOT NULL REFERENCES snapshots(id),
  entity_id   text NOT NULL,
  kind        text NOT NULL,
  country_code char(2) NOT NULL,
  op          text NOT NULL CHECK (op IN ('insert','update','delete')),
  changed_fields text[] NOT NULL DEFAULT '{}',
  before      jsonb,
  after       jsonb
);
CREATE INDEX changes_entity_idx  ON changes (entity_id);
CREATE INDEX changes_snapshot_idx ON changes (snapshot_id);
CREATE INDEX changes_country_idx ON changes (country_code, seq);

CREATE TABLE webhook_subscriptions (
  id         bigserial PRIMARY KEY,
  url        text NOT NULL,
  secret     text NOT NULL,                 -- HMAC-SHA256 signing key
  countries  text[],                        -- null = all countries
  active     boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE webhook_deliveries (
  id              bigserial PRIMARY KEY,
  subscription_id bigint NOT NULL REFERENCES webhook_subscriptions(id) ON DELETE CASCADE,
  snapshot_id     bigint NOT NULL REFERENCES snapshots(id),
  payload         jsonb NOT NULL,
  status          text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','delivered','failed')),
  attempts        int NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_error      text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  delivered_at    timestamptz
);
CREATE INDEX webhook_deliveries_due_idx ON webhook_deliveries (next_attempt_at) WHERE status = 'pending';
