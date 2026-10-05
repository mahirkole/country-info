-- API keys managed through the admin API. Only the SHA-256 of a key is stored; the key itself is shown once at creation.
CREATE TABLE api_keys (
  id           bigserial PRIMARY KEY,
  name         text NOT NULL,
  key_hash     text NOT NULL UNIQUE,
  rate_per_min integer,                 -- NULL = the server default
  active       boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz
);
