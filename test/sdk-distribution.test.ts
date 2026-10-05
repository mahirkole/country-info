import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { migrate } from '../src/db.js';
import { ingest } from '../src/ingest.js';
import { buildApp } from '../src/api.js';
import { processDeliveries, sign } from '../src/webhooks.js';
import { createReleaseNote } from '../src/release-notes.js';
import { publish } from '../src/publish.js';
import { FsStore } from '../src/object-store.js';
import { CountryInfo, verifyWebhook } from '../src/sdk.js';
import type { EntityInput } from '../src/model.js';

const url = process.env.TEST_DATABASE_URL;
const d = url ? describe : describe.skip;
const E = (id: string, kind: EntityInput['kind'], cc: string, name: string, parent: string | null = null): EntityInput =>
  ({ id, kind, parent_id: parent, country_code: cc, code: id.split(':')[1]!, name, name_ascii: null, lat: null, lon: null, data: {} });

d('SDK: webhooks, releases and file bundles', () => {
  let pool: pg.Pool;
  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: url });
    await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public');
    await migrate(pool);
  });
  afterAll(() => pool.end());

  it('subscribes, tests, replays, verifies signatures, lists releases and downloads a verified bundle', async () => {
    const store = new FsStore(await mkdtemp(join(tmpdir(), 'sdkst-')), 'http://x', 'secret');
    const app = await buildApp(pool, { adminToken: 'tok', exportDir: await mkdtemp(join(tmpdir(), 'ci-')), requireApiKey: true, store });
    const key = (await app.inject({ method: 'POST', url: '/v1/api-keys', headers: { authorization: 'Bearer tok' }, payload: { name: 'c' } })).json().key as string;
    const via = (async (u: string, init: RequestInit = {}) => {
      const r = await app.inject({ method: (init.method ?? 'GET') as 'GET', url: u.replace('http://x', ''), headers: init.headers as Record<string, string>, payload: init.body as string | undefined });
      return new Response(r.statusCode === 204 ? null : new Uint8Array(r.rawPayload), { status: r.statusCode, headers: { 'content-type': String(r.headers['content-type'] ?? 'application/json') } });
    }) as unknown as typeof fetch;
    const c = new CountryInfo({ baseUrl: 'http://x', apiKey: key, fetchFn: via });

    const sub = await c.createWebhook({ url: 'https://r.test/h', events: ['release.published', 'snapshot.completed'] });
    expect(sub.secret).toHaveLength(48);
    expect((await c.webhooks()).map((w) => w.id)).toEqual([sub.id]);
    await expect(c.createWebhook({ url: 'https://r.test/h', events: ['bogus' as never] })).rejects.toMatchObject({ status: 400 });

    // data -> snapshot, release note, bundle
    const src = { id: 'sdk-src', authority: 'SDK Office', attribution: 'x', version: '1' };
    const r = await ingest(pool, src, [E('country:DE', 'country', 'DE', 'Germany'), E('div:DE:1', 'division', 'DE', 'Land', 'country:DE')], { kinds: ['country', 'division'] });
    await pool.query("UPDATE sources SET license_verdict = 'green' WHERE id = 'sdk-src'");
    await createReleaseNote(pool, r.snapshotId);
    await c.testWebhook(sub.id);

    const calls: { headers: Record<string, string>; body: string }[] = [];
    await processDeliveries(pool, (async (_u: string, init: RequestInit) => { calls.push({ headers: init.headers as Record<string, string>, body: init.body as string }); return new Response(null, { status: 200 }); }) as unknown as typeof fetch);
    expect(calls.map((x) => x.headers['x-countryinfo-event']).sort()).toEqual(['release.published', 'snapshot.completed', 'webhook.test']);
    const first = calls[0]!;
    const ts = first.headers['x-countryinfo-timestamp']!;
    expect(await verifyWebhook(sub.secret, first.body, ts, first.headers['x-countryinfo-signature']!)).toBe(true);
    expect(await verifyWebhook(sub.secret, first.body + 'x', ts, first.headers['x-countryinfo-signature']!)).toBe(false);
    expect(await verifyWebhook(sub.secret, first.body, ts, sign(sub.secret, first.body, ts), 300, Date.now() + 3_600_000)).toBe(false); // too old
    expect(await verifyWebhook('other', first.body, ts, first.headers['x-countryinfo-signature']!)).toBe(false);

    const log = await c.webhookDeliveries(sub.id);
    expect(log.data).toHaveLength(3);
    expect(log.data.every((x) => x.status === 'delivered')).toBe(true);
    expect((await c.replayDelivery(sub.id, log.data[0]!.id)).status).toBe('pending');

    const notes: string[] = [];
    for await (const n of c.releases({ limit: 1 })) notes.push(n.title);
    expect(notes).toHaveLength(1);
    expect((await c.release(1)).body_md).toContain('SDK Office');

    await publish(pool, store, await mkdtemp(join(tmpdir(), 'sdkwk-')), { profiles: ['commercial'] });
    const bundle = await c.exportsLatest();
    expect(bundle.profile).toBe('commercial');
    const regions = new TextDecoder().decode(await c.download(bundle.files['regions.ndjson']!));
    expect(JSON.parse(regions.trim()).source_id).toBe('sdk-src');
    await expect(c.download({ ...bundle.files['regions.ndjson']!, sha256: '0'.repeat(64) })).rejects.toThrow(/sha256 mismatch/);

    await c.deleteWebhook(sub.id);
    expect(await c.webhooks()).toEqual([]);
    await app.close();
  });
});
