import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { migrate } from '../src/db.js';
import { ingest } from '../src/ingest.js';
import { buildApp } from '../src/api.js';
import { prune } from '../src/prune.js';
import type { EntityInput } from '../src/model.js';

const url = process.env.TEST_DATABASE_URL;
const d = url ? describe : describe.skip;
const E = (id: string, kind: EntityInput['kind'], cc: string, name: string): EntityInput =>
  ({ id, kind, parent_id: null, country_code: cc, code: id.split(':')[1]!, name, name_ascii: null, lat: null, lon: null, data: {} });

d('maintenance', () => {
  let pool: pg.Pool;
  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: url });
    await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public');
    await migrate(pool);
  });
  afterAll(() => pool.end());

  it('prune removes old finished deliveries, old usage, stale windows and old runs, and keeps the rest', async () => {
    await pool.query("INSERT INTO sources (id, authority) VALUES ('s','s')");
    await pool.query("INSERT INTO webhook_subscriptions (url, secret) VALUES ('https://x.test','s')");
    const del = (status: string, age: string) => pool.query(`INSERT INTO webhook_deliveries (subscription_id, payload, event, status, created_at) VALUES (1, '{}', 'webhook.test', $1, now() - interval '${age}')`, [status]);
    await del('delivered', '100 days'); await del('failed', '100 days'); await del('pending', '100 days'); await del('delivered', '1 day');
    await pool.query("INSERT INTO api_usage (day, key_id, requests) VALUES (current_date - 800, 0, 1), (current_date - 10, 0, 1)");
    await pool.query("INSERT INTO rate_limits (bucket, window_start, count) VALUES ('a', extract(epoch FROM now())::bigint - 7200, 1), ('b', extract(epoch FROM now())::bigint, 1)");
    for (let i = 0; i < 25; i++) await pool.query("INSERT INTO source_runs (source_id, finished_at, status) VALUES ('s', now() - interval '400 days', 'unchanged')");
    await pool.query("INSERT INTO source_runs (source_id, finished_at, status) VALUES ('s', now(), 'success')");
    expect(await prune(pool)).toEqual({ webhook_deliveries: 2, api_usage: 1, rate_limits: 1, source_runs: 6 }); // 26 runs: newest 20 kept
    expect((await pool.query('SELECT status FROM webhook_deliveries ORDER BY id')).rows.map((r) => r.status)).toEqual(['pending', 'delivered']);
    expect(await prune(pool)).toEqual({ webhook_deliveries: 0, api_usage: 0, rate_limits: 0, source_runs: 0 });
  });

  it('/v1/status counts open review items', async () => {
    await pool.query("INSERT INTO review_items (entity_id, field, a_source, b_source, status) VALUES ('a','successor:replaced_by','s','s','open'), ('a','name','s','s','open'), ('a','name','s','s','dismissed')");
    const app = await buildApp(pool, { exportDir: await mkdtemp(join(tmpdir(), 'ci-')) });
    expect((await app.inject('/v1/status')).json()).toMatchObject({ open_review_items: 2, open_successor_suggestions: 1 });
    await app.close();
  });

  it('serves un_status from the CLDR xref (null before enrichment) and filters on it', async () => {
    await pool.query("INSERT INTO sources (id, authority) VALUES ('gx','g') ON CONFLICT DO NOTHING");
    await pool.query("INSERT INTO entities (id, kind, country_code, code, name, content_hash, updated_seq, source_id, data) VALUES ('country:TR','country','TR','TR','Turkey','h',0,'gx','{}'), ('country:TW','country','TW','TW','Taiwan','h',0,'gx','{}'), ('country:XX','country','XX','XX','Nowhere','h',0,'gx','{}')");
    await pool.query("INSERT INTO entity_xrefs (entity_id, scheme, value, source) VALUES ('country:TR','un_status','member','cldr'), ('country:TW','un_status','other','cldr')");
    const app = await buildApp(pool, { exportDir: await mkdtemp(join(tmpdir(), 'ci-')) });
    const all = (await app.inject('/v1/countries')).json().data as { code: string; data: { un_status: string | null } }[];
    expect(Object.fromEntries(all.map((c) => [c.code, c.data.un_status]))).toEqual({ TR: 'member', TW: 'other', XX: null });
    expect(((await app.inject('/v1/countries?un_status=member')).json().data as { code: string }[]).map((c) => c.code)).toEqual(['TR']);
    expect((await app.inject('/v1/countries/tw')).json().data.un_status).toBe('other');
    await app.close();
    await pool.query("DELETE FROM entity_xrefs WHERE entity_id LIKE 'country:%'; DELETE FROM entities WHERE id LIKE 'country:%'");
  });

  it('rolls the whole ingest back when queuing a webhook fails: no snapshot, no records, no deliveries', async () => {
    await pool.query("INSERT INTO webhook_subscriptions (url, secret) VALUES ('https://boom.test','s')");
    await pool.query("CREATE FUNCTION boom() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'queue down'; END $$");
    await pool.query("CREATE TRIGGER boom BEFORE INSERT ON webhook_deliveries FOR EACH ROW WHEN (NEW.event = 'snapshot.completed') EXECUTE FUNCTION boom()");
    const before = (await pool.query('SELECT (SELECT count(*) FROM entities)::int e, (SELECT count(*) FROM changes)::int c, (SELECT count(*) FROM snapshots WHERE finished_at IS NOT NULL)::int s')).rows[0];
    await expect(ingest(pool, { id: 'rb', authority: 'rb', attribution: 'x' }, [E('country:FR', 'country', 'FR', 'France')], { kinds: ['country'] })).rejects.toThrow(/queue down/);
    const after = (await pool.query('SELECT (SELECT count(*) FROM entities)::int e, (SELECT count(*) FROM changes)::int c, (SELECT count(*) FROM snapshots WHERE finished_at IS NOT NULL)::int s')).rows[0];
    expect(after).toEqual(before);
    await pool.query('DROP TRIGGER boom ON webhook_deliveries; DROP FUNCTION boom()');
    expect((await ingest(pool, { id: 'rb', authority: 'rb', attribution: 'x' }, [E('country:FR', 'country', 'FR', 'France')], { kinds: ['country'] })).inserted).toBe(1);
  });
});
