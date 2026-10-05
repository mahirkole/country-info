-- Requests per API key and day (metering for plans/billing). `key_id` is api_keys.id, or 0 for env keys / the admin token.
CREATE TABLE api_usage (
  day      date    NOT NULL,
  key_id   bigint  NOT NULL,
  requests bigint  NOT NULL DEFAULT 0,
  PRIMARY KEY (day, key_id)
);
