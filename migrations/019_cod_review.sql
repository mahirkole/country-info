-- OCHA COD-AB: per-country eligibility record. A country is loaded only when its upstream (the metadata "source" text) was read and
-- judged a national/official publisher; the sha256 pins the judged text, so a changed source text sends the country back to review.
CREATE TABLE IF NOT EXISTS cod_review (
  country text PRIMARY KEY,
  status text NOT NULL CHECK (status IN ('acked', 'pending', 'excluded')),
  source_sha256 text,
  source_text text,
  note text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
