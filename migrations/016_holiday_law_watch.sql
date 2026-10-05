-- Watch of the legal texts the holiday rules cite: a changed text means the rule files must be re-read by a person.
CREATE TABLE holiday_law_watch (
  url         text PRIMARY KEY,
  sha256      text NOT NULL,             -- fingerprint of the text the rules were last checked against
  pending_sha256 text,                   -- a different fingerprint seen once; confirmed by a second identical fetch
  flaps       integer NOT NULL DEFAULT 0, -- consecutive differing-but-unconfirmed fetches (noisy page)
  status      text NOT NULL DEFAULT 'ok' CHECK (status IN ('ok', 'changed', 'volatile')),
  citations   text[] NOT NULL DEFAULT '{}',
  countries   text[] NOT NULL DEFAULT '{}',
  last_error  text,
  checked_at  timestamptz NOT NULL DEFAULT now(),
  changed_at  timestamptz
);
