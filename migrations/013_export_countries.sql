-- Countries an API key is licensed for in the file bundles (NULL = all countries, global files included).
ALTER TABLE api_keys ADD COLUMN export_countries text[];
