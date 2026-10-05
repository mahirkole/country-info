-- Human-readable release notes (one per applied snapshot) and the e-mail digest subscribers.
CREATE TABLE release_notes (
  id          bigserial PRIMARY KEY,
  snapshot_id bigint NOT NULL UNIQUE REFERENCES snapshots(id),
  source_id   text NOT NULL,
  vintage     text,
  reason      text,
  title       text NOT NULL,
  body_md     text NOT NULL,
  totals      jsonb NOT NULL,
  countries   jsonb NOT NULL,            -- { "DE": 12, ... } changes per country
  public      boolean NOT NULL,          -- source cleared for commercial use: shown to customers
  highlight   boolean NOT NULL DEFAULT false, -- vintage change or large change: sent immediately
  retracted   boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE release_subscribers (
  id                bigserial PRIMARY KEY,
  email             text NOT NULL UNIQUE,
  frequency         text NOT NULL DEFAULT 'weekly' CHECK (frequency IN ('instant', 'weekly')),
  active            boolean NOT NULL DEFAULT true,
  last_sent_note_id bigint NOT NULL DEFAULT 0,
  last_sent_at      timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now()
);
