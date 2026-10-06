-- Consecutive fetch failures of a watched legal text (3 in a row show up in /v1/status).
ALTER TABLE holiday_law_watch ADD COLUMN error_count integer NOT NULL DEFAULT 0;
