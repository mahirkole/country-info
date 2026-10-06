import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildApp } from '../src/api.js';
import { migrate } from '../src/db.js';
import { attributeChanges, recordAttributeChanges } from '../src/attribute-changes.js';

const row = (code: string, grp: string, data: unknown) => ({ code, grp, data });

describe('attributeChanges', () => {
  it('nothing stored before = first load, no changes; otherwise added/changed/removed groups per country', () => {
    expect(attributeChanges([], [row('TR', 'week', { a: 1 })])).toEqual([]);
    const ch = attributeChanges(
      [row('TR', 'week', { a: 1, b: 2 }), row('TR', 'time', { h: 'h23' }), row('DE', 'week', { x: 1 }), row('FR', 'week', { x: 1 })],
      [row('TR', 'week', { b: 2, a: 1 }), row('TR', 'time', { h: 'h12' }), row('DE', 'week', { x: 1 }), row('DE', 'units', { m: 1 }), row('US', 'week', { x: 9 })],
    );
    expect(ch.map((c) => [c.code, c.op, c.groups])).toEqual([['DE', 'update', ['units']], ['FR', 'delete', ['week']], ['TR', 'update', ['time']], ['US', 'insert', ['week']]]);
    expect(ch.find((c) => c.code === 'TR')).toMatchObject({ before: { time: { h: 'h23' } }, after: { time: { h: 'h12' } } });
  });
});

const url = process.env.TEST_DATABASE_URL;
describe.skipIf(!url)('attribute changes in the change feed', () => {
  const pool = new pg.Pool({ connectionString: url });
  beforeAll(() => migrate(pool));
  afterAll(() => pool.end());

  it('are served by /v1/changes (kind attributes), notified with snapshot.completed to matching subscribers, and nothing is recorded for an empty diff', async () => {
    await pool.query('TRUNCATE webhook_deliveries, webhook_subscriptions, changes, snapshots, release_notes, entities, sources RESTART IDENTITY CASCADE');
    await pool.query(`INSERT INTO sources (id, authority, url, license, attribution, source_class, license_verdict) VALUES ('cldr','Unicode','u','l','a','community','green')`);
    await pool.query(`INSERT INTO webhook_subscriptions (url, secret, kinds, events) VALUES ('https://a.test/h', 's', ARRAY['attributes'], NULL), ('https://b.test/h', 's', ARRAY['holiday'], NULL)`);
    expect(await recordAttributeChanges(pool, 'cldr', [])).toBeNull();
    const id = await recordAttributeChanges(pool, 'cldr', attributeChanges([row('TR', 'time', { h: 'h23' })], [row('TR', 'time', { h: 'h12' }), row('US', 'week', { f: 'sun' })]), 'vintage_change: CLDR 49');
    expect(id).not.toBeNull();
    const snap = (await pool.query('SELECT source, inserted, updated, deleted, reason, finished_at FROM snapshots WHERE id = $1', [id])).rows[0];
    expect(snap).toMatchObject({ source: 'cldr', inserted: 1, updated: 1, deleted: 0, reason: 'vintage_change: CLDR 49' });
    expect(snap.finished_at).not.toBeNull();
    const app = await buildApp(pool, { adminToken: 't', exportDir: await mkdtemp(join(tmpdir(), 'ci-')) });
    const feed = (await app.inject('/v1/changes?kind=attributes')).json();
    expect(feed.data.map((c: { entity_id: string; op: string; changed_fields: string[] }) => [c.entity_id, c.op, c.changed_fields])).toEqual([['country:TR', 'update', ['time']], ['country:US', 'insert', ['week']]]);
    expect(feed.data[0].after).toEqual({ time: { h: 'h12' } });
    const d = (await pool.query('SELECT s.url FROM webhook_deliveries d JOIN webhook_subscriptions s ON s.id = d.subscription_id')).rows;
    expect(d.map((r) => r.url)).toEqual(['https://a.test/h']);
    await app.close();
  });
});
