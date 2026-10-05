-- Customer-owned webhook subscriptions, event filters, non-snapshot events, and the export profile of an API key.
ALTER TABLE webhook_subscriptions ADD COLUMN api_key_id bigint REFERENCES api_keys(id) ON DELETE CASCADE; -- NULL = created by an admin
ALTER TABLE webhook_subscriptions ADD COLUMN events text[];                                                -- NULL = all events
CREATE INDEX webhook_subscriptions_key_idx ON webhook_subscriptions (api_key_id);
ALTER TABLE webhook_deliveries ALTER COLUMN snapshot_id DROP NOT NULL;                                      -- test events have no snapshot
ALTER TABLE webhook_deliveries ADD COLUMN event text NOT NULL DEFAULT 'snapshot.completed';
CREATE INDEX webhook_deliveries_sub_idx ON webhook_deliveries (subscription_id, id DESC);
-- Which published file set a key may download: 'commercial' (cleared sources only) or 'full' (internal).
ALTER TABLE api_keys ADD COLUMN export_profile text NOT NULL DEFAULT 'commercial' CHECK (export_profile IN ('commercial', 'full'));
