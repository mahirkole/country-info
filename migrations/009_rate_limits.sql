-- Fixed-window request counters shared by all API instances (used when RATE_LIMIT_STORE=postgres).
CREATE UNLOGGED TABLE rate_limits (
  bucket       text   NOT NULL,
  window_start bigint NOT NULL,   -- unix seconds of the window start
  count        integer NOT NULL,
  PRIMARY KEY (bucket, window_start)
);
