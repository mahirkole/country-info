-- Plan label and monthly request quota of an API key (NULL quota = unlimited; the per-minute rate limit applies in any case).
ALTER TABLE api_keys ADD COLUMN plan text;
ALTER TABLE api_keys ADD COLUMN monthly_quota bigint CHECK (monthly_quota IS NULL OR monthly_quota > 0);
