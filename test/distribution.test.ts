import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import pg from 'pg';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { migrate } from '../src/db.js';
import { ingest } from '../src/ingest.js';
import { buildApp } from '../src/api.js';
import { processDeliveries } from '../src/webhooks.js';
import { createReleaseNote, retractRelease, runDigest } from '../src/release-notes.js';
import { formatSummary, holidayGaps, notify, summarizeCycle } from '../src/notify.js';
import { exportLinks, publish, rollback, verifyCommercialBundle } from '../src/publish.js';
import { FsStore, S3Store, signV4 } from '../src/object-store.js';
import type { EntityInput } from '../src/model.js';
import { createHash } from 'node:crypto';

const url = process.env.TEST_DATABASE_URL;
const d = url ? describe : describe.skip;

describe('object stores (no database)', () => {
  it('reproduces the AWS Signature V4 presigned-URL example', () => {
    const s = signV4({
      method: 'GET', host: 'examplebucket.s3.amazonaws.com', path: '/test.txt', payloadHash: 'UNSIGNED-PAYLOAD',
      query: { 'X-Amz-Algorithm': 'AWS4-HMAC-SHA256', 'X-Amz-Credential': 'AKIAIOSFODNN7EXAMPLE/20130524/us-east-1/s3/aws4_request', 'X-Amz-Date': '20130524T000000Z', 'X-Amz-Expires': '86400', 'X-Amz-SignedHeaders': 'host' },
      accessKey: 'AKIAIOSFODNN7EXAMPLE', secretKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY', region: 'us-east-1', amzDate: '20130524T000000Z',
    });
    expect(s.signature).toBe('aeeed9bbccd4d02ee5c0109b86d86835f995330da4c265957d157751f604d404');
  });

  it('S3Store signs uploads and presigns downloads for a path-style endpoint', async () => {
    const seen: { url: string; init: RequestInit }[] = [];
    const fake = (async (u: string, init: RequestInit) => { seen.push({ url: u, init }); return new Response('hello', { status: 200 }); }) as unknown as typeof fetch;
    const s3 = new S3Store({ endpoint: 'https://s3.example.com', bucket: 'bkt', region: 'eu-1', accessKey: 'AK', secretKey: 'SK', prefix: 'pre', fetch: fake, now: () => new Date('2026-10-05T10:00:00Z') });
    await s3.put('commercial/manifest.json', Buffer.from('{}'), 'application/json');
    expect(seen[0]!.url).toBe('https://s3.example.com/bkt/pre/commercial/manifest.json');
    const h = seen[0]!.init.headers as Record<string, string>;
    expect(h['x-amz-content-sha256']).toBe(createHash('sha256').update('{}').digest('hex'));
    expect(h.authorization).toMatch(/^AWS4-HMAC-SHA256 Credential=AK\/20261005\/eu-1\/s3\/aws4_request, SignedHeaders=host;x-amz-content-sha256;x-amz-date, Signature=[0-9a-f]{64}$/);
    expect((await s3.get('commercial/manifest.json'))?.toString()).toBe('hello');
    const link = new URL(await s3.presign('commercial/a b.json', 900));
    expect(link.pathname).toBe('/bkt/pre/commercial/a%20b.json');
    expect(link.searchParams.get('X-Amz-Expires')).toBe('900');
    expect(link.searchParams.get('X-Amz-Signature')).toMatch(/^[0-9a-f]{64}$/);
  });

  it('FsStore links expire and cannot be tampered with; keys cannot escape the root', async () => {
    let t = Date.parse('2026-10-05T10:00:00Z');
    const root = await mkdtemp(join(tmpdir(), 'fs-'));
    const fs = new FsStore(root, 'https://api.test', 'secret', () => t);
    await fs.put('commercial/x.json', Buffer.from('1'));
    const u = new URL(await fs.presign('commercial/x.json', 60));
    const [exp, sig] = [u.searchParams.get('exp')!, u.searchParams.get('sig')!];
    expect(u.pathname).toBe('/dl/commercial/x.json');
    expect(fs.verifyDownload('commercial/x.json', exp, sig)).toBe(true);
    expect(fs.verifyDownload('commercial/y.json', exp, sig)).toBe(false);
    expect(fs.verifyDownload('commercial/x.json', String(Number(exp) + 999), sig)).toBe(false);
    t += 61_000;
    expect(fs.verifyDownload('commercial/x.json', exp, sig)).toBe(false);
    expect(fs.localPath('../etc/passwd')).toBeNull();
    await expect(fs.put('../escape', Buffer.from('x'))).rejects.toThrow();
  });
});

const E = (id: string, kind: EntityInput['kind'], cc: string, name: string, parent: string | null = null): EntityInput =>
  ({ id, kind, parent_id: parent, country_code: cc, code: id.split(':')[1]!, name, name_ascii: null, lat: null, lon: null, data: {} });
const GREEN = { id: 'src-green', authority: 'Green Office', attribution: 'Green credit', version: '2026' };
const RED = { id: 'src-red', authority: 'Red Office', attribution: 'Red credit' };
const countries = [E('country:DE', 'country', 'DE', 'Germany'), E('country:FR', 'country', 'FR', 'France')];

d('distribution', () => {
  let pool: pg.Pool;
  let work: string;
  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: url });
    await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public');
    await migrate(pool);
    work = await mkdtemp(join(tmpdir(), 'pub-'));
  });
  beforeEach(async () => {
    await pool.query('TRUNCATE webhook_deliveries, webhook_subscriptions, release_notes, release_subscribers, api_keys, changes, snapshots, entities, entity_links, review_items, source_runs, sources RESTART IDENTITY CASCADE');
    await ingest(pool, { id: 'geonames', authority: 'g', attribution: 'g' }, countries, { kinds: ['country'] });
    await pool.query("UPDATE sources SET license_verdict = 'green' WHERE id = 'geonames'");
  });
  afterAll(() => pool.end());

  const setVerdict = (id: string, v: string) => pool.query('UPDATE sources SET license_verdict = $2 WHERE id = $1', [id, v]);
  const divs = (src: string, cc: string, n: number, tag = '') => Array.from({ length: n }, (_, i) => E(`div:${cc}:${src}-${i}`, 'division', cc, `${tag}Unit ${i}`, `country:${cc}`));
  const deliver = async (calls: { event: string; body: string }[] = [], status = 200) =>
    processDeliveries(pool, (async (_u: string, init: RequestInit) => { calls.push({ event: (init.headers as Record<string, string>)['x-countryinfo-event']!, body: init.body as string }); return new Response(null, { status }); }) as unknown as typeof fetch);

  async function appWithKeys() {
    const app = await buildApp(pool, { adminToken: 'tok', exportDir: await mkdtemp(join(tmpdir(), 'ci-')), requireApiKey: true });
    const mk = async (name: string, extra = {}) => (await app.inject({ method: 'POST', url: '/v1/api-keys', headers: { authorization: 'Bearer tok' }, payload: { name, ...extra } })).json() as { id: number; key: string };
    return { app, mk };
  }

  describe('customer webhooks', () => {
    it('isolates subscriptions per API key, validates events, logs deliveries, replays and tests', async () => {
      const { app, mk } = await appWithKeys();
      const [a, b] = [await mk('A'), await mk('B')];
      const post = (key: string, payload: object) => app.inject({ method: 'POST', url: '/v1/webhooks', headers: { 'x-api-key': key }, payload });

      expect((await app.inject({ method: 'POST', url: '/v1/webhooks', payload: { url: 'https://x.test' } })).statusCode).toBe(401);
      expect((await post(a.key, { url: 'https://a.test/h', events: ['nope'] })).statusCode).toBe(400);
      const created = await post(a.key, { url: 'https://a.test/h', events: ['snapshot.completed'] });
      expect(created.statusCode).toBe(201);
      const sub = created.json() as { id: number; secret: string };
      expect(sub.secret).toHaveLength(48);

      const list = (key: string) => app.inject({ url: '/v1/webhooks', headers: key === 'tok' ? { authorization: 'Bearer tok' } : { 'x-api-key': key } }).then((r) => r.json().data as { id: number }[]);
      expect(await list(a.key)).toHaveLength(1);
      expect(await list(b.key)).toHaveLength(0);
      expect(await list('tok')).toHaveLength(1); // admin sees all
      // B cannot touch A's subscription
      for (const [method, path] of [['DELETE', ''], ['GET', '/deliveries'], ['POST', '/test']] as const) {
        expect((await app.inject({ method, url: `/v1/webhooks/${sub.id}${path}`, headers: { 'x-api-key': b.key } })).statusCode).toBe(404);
      }

      // The test event is delivered with its event header and a signed body, and shows in the log.
      const t = (await app.inject({ method: 'POST', url: `/v1/webhooks/${sub.id}/test`, headers: { 'x-api-key': a.key } })).json() as { id: number };
      const calls: { event: string; body: string }[] = [];
      await deliver(calls);
      expect(calls.map((c) => c.event)).toEqual(['webhook.test']);
      const log = (await app.inject({ url: `/v1/webhooks/${sub.id}/deliveries`, headers: { 'x-api-key': a.key } })).json() as { data: { id: number; status: string; event: string }[] };
      expect(log.data).toMatchObject([{ id: t.id, status: 'delivered', event: 'webhook.test' }]);

      // Replay queues a copy; the original stays in the log.
      const rep = await app.inject({ method: 'POST', url: `/v1/webhooks/${sub.id}/deliveries/${t.id}/replay`, headers: { 'x-api-key': a.key } });
      expect(rep.statusCode).toBe(202);
      await deliver(calls);
      expect(calls).toHaveLength(2);
      expect((await app.inject({ method: 'POST', url: `/v1/webhooks/${sub.id}/deliveries/99999/replay`, headers: { 'x-api-key': a.key } })).statusCode).toBe(404);

      expect((await app.inject({ method: 'DELETE', url: `/v1/webhooks/${sub.id}`, headers: { 'x-api-key': a.key } })).statusCode).toBe(204);
      await app.close();
    });

    it('does not deliver the same row twice when two workers run at once (lease)', async () => {
      await pool.query("INSERT INTO webhook_subscriptions (url, secret) VALUES ('https://x.test', 's')");
      for (let i = 0; i < 6; i++) await pool.query("INSERT INTO webhook_deliveries (subscription_id, payload, event) VALUES (1, '{}', 'webhook.test')");
      const seen: string[] = [];
      const slow = (async (_u: string, init: RequestInit) => { seen.push((init.headers as Record<string, string>)['x-countryinfo-delivery']!); await new Promise((r) => setTimeout(r, 30)); return new Response(null, { status: 200 }); }) as unknown as typeof fetch;
      await Promise.all([processDeliveries(pool, slow), processDeliveries(pool, slow)]);
      expect(seen).toHaveLength(6);
      expect(new Set(seen).size).toBe(6);
    });

    it('honours the events filter for snapshot notifications', async () => {
      await pool.query("INSERT INTO webhook_subscriptions (url, secret, events) VALUES ('https://x.test', 's', ARRAY['release.published'])");
      await ingest(pool, GREEN, divs('g', 'DE', 3), { kinds: ['division'], countries: ['DE'] });
      expect((await pool.query('SELECT count(*)::int n FROM webhook_deliveries')).rows[0].n).toBe(0);
    });
  });

  describe('release notes', () => {
    it('creates a note per applied snapshot, publishes it only for cleared sources and notifies subscribers', async () => {
      await pool.query("INSERT INTO webhook_subscriptions (url, secret, events, countries) VALUES ('https://x.test', 's', ARRAY['release.published', 'release.retracted'], ARRAY['DE'])");
      await pool.query("INSERT INTO webhook_subscriptions (url, secret, events, countries) VALUES ('https://y.test', 's', ARRAY['release.published'], ARRAY['FR'])");
      const r = await ingest(pool, GREEN, divs('g', 'DE', 4), { kinds: ['division'], countries: ['DE'] });
      await setVerdict('src-green', 'green');
      const id = await createReleaseNote(pool, r.snapshotId);
      expect(id).not.toBeNull();
      expect(await createReleaseNote(pool, r.snapshotId)).toBeNull(); // idempotent
      const calls: { event: string; body: string }[] = [];
      await deliver(calls);
      expect(calls.map((c) => c.event)).toEqual(['release.published']); // only the DE subscriber
      expect(JSON.parse(calls[0]!.body)).toMatchObject({ release_id: id, source_ids: ['src-green'], vintage: '2026', changes_by_country: { DE: 4 }, release_url: `/v1/releases/${id}` });

      const app = await buildApp(pool, { adminToken: 'tok', exportDir: await mkdtemp(join(tmpdir(), 'ci-')) });
      const listed = (await app.inject('/v1/releases')).json() as { data: { id: number; title: string }[] };
      expect(listed.data).toHaveLength(1);
      expect(listed.data[0]!.title).toContain('Green Office');
      const one = (await app.inject(`/v1/releases/${id}`)).json() as { body_md: string };
      expect(one.body_md).toContain('4 added');

      // A source that is not cleared for sale never shows up for customers.
      const red = await ingest(pool, RED, divs('r', 'FR', 2), { kinds: ['division'], countries: ['FR'] });
      await setVerdict('src-red', 'red');
      const rid = await createReleaseNote(pool, red.snapshotId);
      expect(rid).not.toBeNull();
      expect(((await app.inject('/v1/releases')).json() as { data: unknown[] }).data).toHaveLength(1);
      expect((await app.inject(`/v1/releases/${rid}`)).statusCode).toBe(404);
      await deliver(calls);
      expect(calls).toHaveLength(1);

      expect(await retractRelease(pool, id!)).toBe(true);
      await deliver(calls);
      expect(calls.at(-1)!.event).toBe('release.retracted');
      await app.close();
    });

    it('does not create a note for a no-op snapshot', async () => {
      const r = await ingest(pool, GREEN, divs('g', 'DE', 2), { kinds: ['division'], countries: ['DE'] });
      const again = await ingest(pool, GREEN, divs('g', 'DE', 2), { kinds: ['division'], countries: ['DE'] });
      expect(await createReleaseNote(pool, again.snapshotId)).toBeNull();
      expect(r.inserted).toBe(2);
    });

    it('sends digests: weekly waits unless a note is a highlight, instant sends at once, cursors advance only on success', async () => {
      await setVerdict('geonames', 'green');
      await pool.query("INSERT INTO release_subscribers (email, frequency) VALUES ('w@x.test','weekly'), ('i@x.test','instant')");
      const r1 = await ingest(pool, GREEN, divs('g', 'DE', 3), { kinds: ['division'], countries: ['DE'] });
      await setVerdict('src-green', 'green');
      await createReleaseNote(pool, r1.snapshotId); // insert only, 3 records: no highlight
      const mails: { to: string; subject: string }[] = [];
      let now = new Date('2026-10-05T10:00:00Z');
      const mail = async (to: string, subject: string) => { mails.push({ to, subject }); };
      // Weekly subscriber never received anything -> due the first time; instant too.
      expect(await runDigest(pool, mail, () => now)).toBe(2);
      expect(await runDigest(pool, mail, () => now)).toBe(0); // nothing new

      const r2 = await ingest(pool, GREEN, [...divs('g', 'DE', 3), E('div:DE:extra', 'division', 'DE', 'Extra', 'country:DE')], { kinds: ['division'], countries: ['DE'] });
      await createReleaseNote(pool, r2.snapshotId); // +1, small: not a highlight
      now = new Date('2026-10-06T10:00:00Z');
      mails.length = 0;
      expect(await runDigest(pool, mail, () => now)).toBe(1);
      expect(mails.map((m) => m.to)).toEqual(['i@x.test']);

      const r3 = await ingest(pool, GREEN, divs('g', 'DE', 3), { kinds: ['division'], countries: ['DE'] }); // removes 'extra' -> highlight
      await createReleaseNote(pool, r3.snapshotId);
      mails.length = 0;
      expect(await runDigest(pool, async (to) => { if (to === 'i@x.test') throw new Error('smtp down'); }, () => now)).toBe(1);
      const row = (await pool.query("SELECT last_sent_note_id FROM release_subscribers WHERE email = 'i@x.test'")).rows[0];
      expect(Number(row.last_sent_note_id)).toBeLessThan(3); // failed mail: cursor stayed, retried next time
      expect(await runDigest(pool, mail, () => now)).toBe(1);
    });

    it('lets an admin manage subscribers; a new one starts after the existing notes', async () => {
      const { app } = await appWithKeys();
      const adm = { authorization: 'Bearer tok' };
      expect((await app.inject({ method: 'POST', url: '/v1/release-subscribers', headers: adm, payload: { email: 'bad' } })).statusCode).toBe(400);
      expect((await app.inject({ method: 'POST', url: '/v1/release-subscribers', headers: adm, payload: { email: 'A@X.test', frequency: 'daily' } })).statusCode).toBe(400);
      const ok = await app.inject({ method: 'POST', url: '/v1/release-subscribers', headers: adm, payload: { email: 'A@X.test', frequency: 'instant' } });
      expect(ok.json()).toMatchObject({ email: 'a@x.test', frequency: 'instant' });
      expect((await app.inject({ url: '/v1/release-subscribers', headers: { 'x-api-key': 'nope' } })).statusCode).toBe(401);
      expect(((await app.inject({ url: '/v1/release-subscribers', headers: adm })).json() as { data: unknown[] }).data).toHaveLength(1);
      expect((await app.inject({ method: 'DELETE', url: `/v1/release-subscribers/${ok.json().id}`, headers: adm })).statusCode).toBe(204);
      await app.close();
    });
  });

  describe('operations alerts', () => {
    it('summarises failures once, never repeats an unchanged needs_review, and stays quiet otherwise', async () => {
      await pool.query("INSERT INTO sources (id, authority) VALUES ('s1','s'), ('s2','s')");
      const run = (id: string, status: string) => pool.query('INSERT INTO source_runs (source_id, finished_at, status) VALUES ($1, now(), $2)', [id, status]);
      await run('s1', 'needs_review');
      let s = await summarizeCycle(pool, [{ source: 's1', status: 'needs_review', detail: 'band' }, { source: 's2', status: 'failed', detail: 'HTTP 500' }, { source: 's3', status: 'success', inserted: 2, updated: 0, deleted: 1 }]);
      expect(s.attention.some((l) => l.includes('s1'))).toBe(true); // first time
      expect(s.attention.some((l) => l.includes('s2: failed'))).toBe(true);
      expect(s.changes).toEqual(['✅ s3: +2 ~0 -1']);
      await run('s1', 'needs_review'); // second consecutive
      s = await summarizeCycle(pool, [{ source: 's1', status: 'needs_review', detail: 'band' }]);
      expect(s.attention).toEqual([]);
      s = await summarizeCycle(pool, [{ source: 's1', status: 'unchanged' }]);
      expect(s).toEqual({ attention: [], changes: [] });
      expect(formatSummary({ attention: ['a'], changes: ['b'] })).toBe('country-info refresh\na\nb');
    });

    it('flags blocked/overdue sources and holiday calendars that do not reach next year (from September)', async () => {
      await pool.query("INSERT INTO sources (id, authority, status) VALUES ('lic','x','license_changed')");
      expect((await summarizeCycle(pool, [])).attention).toEqual(['🕓 lic: overdue or blocked (see /v1/status)']);
      const h = (id: string, cc: string, date: string): EntityInput => ({ ...E(id, 'holiday', cc, 'H'), data: { date } });
      await ingest(pool, { id: 'hol', authority: 'h', attribution: 'h' }, [h('hol:DE:1', 'DE', '2027-01-01'), h('hol:FR:1', 'FR', '2026-12-25')], { kinds: ['holiday'] });
      expect(await holidayGaps(pool, new Date('2026-07-01'))).toEqual([]);
      expect(await holidayGaps(pool, new Date('2026-10-05'))).toEqual(['📅 holiday data does not cover 2027 for: FR']);
    });

    it('posts a Slack-compatible body and reports failure without throwing', async () => {
      let body = '';
      const ok = (async (_u: string, i: RequestInit) => { body = i.body as string; return new Response('ok'); }) as unknown as typeof fetch;
      expect(await notify('https://hook.test', 'hi', ok)).toBe(true);
      expect(JSON.parse(body)).toEqual({ text: 'hi' });
      expect(await notify('https://hook.test', 'hi', (async () => { throw new Error('down'); }) as unknown as typeof fetch)).toBe(false);
      expect(await notify('', 'hi', ok)).toBe(false);
    });
  });

  describe('publishing file bundles', () => {
    it('publishes the commercial profile without uncleared sources, manifest last, delta files per snapshot, and links via the API', async () => {
      const store = new FsStore(join(work, 'store'), 'https://api.test', 'secret');
      const wd = join(work, 'work');
      await setVerdict('geonames', 'green');
      const g = await ingest(pool, GREEN, divs('g', 'DE', 5), { kinds: ['division'], countries: ['DE'] });
      await setVerdict('src-green', 'green');
      await ingest(pool, RED, divs('r', 'FR', 3), { kinds: ['division'], countries: ['FR'] });
      await setVerdict('src-red', 'red');

      const res = await publish(pool, store, wd, { profiles: ['commercial', 'full'] });
      expect(res.find((r) => r.profile === 'commercial')!.snapshots.length).toBe(1); // first publish: the newest cleared snapshot only
      const m = JSON.parse((await store.get('commercial/manifest.json'))!.toString());
      expect(m.latest).toBe(m.snapshots[0].snapshot_id);
      const regions = (await store.get(`commercial/${m.snapshots[0].files['regions.ndjson'].path}`))!.toString().trim().split('\n').map((l) => JSON.parse(l));
      expect(regions.map((r) => r.source_id)).toEqual(Array(5).fill('src-green'));
      const full = JSON.parse((await store.get('full/manifest.json'))!.toString());
      const fullRegions = (await store.get(`full/${full.snapshots[0].files['regions.ndjson'].path}`))!.toString().trim().split('\n');
      expect(fullRegions).toHaveLength(8); // red source included in the internal profile

      // Nothing new -> nothing published.
      expect((await publish(pool, store, wd, { profiles: ['commercial'] }))[0]).toMatchObject({ snapshots: [], uploaded: 0 });

      // Two new snapshots in one cycle: both get a delta file, only the newest the full data.
      const g2 = await ingest(pool, GREEN, divs('g', 'DE', 6), { kinds: ['division'], countries: ['DE'] });
      const g3 = await ingest(pool, GREEN, divs('g', 'DE', 7), { kinds: ['division'], countries: ['DE'] });
      const again = (await publish(pool, store, wd, { profiles: ['commercial'] }))[0]!;
      expect(again.snapshots).toEqual([g2.snapshotId, g3.snapshotId]);
      const m2 = JSON.parse((await store.get('commercial/manifest.json'))!.toString());
      expect(m2.latest).toBe(g3.snapshotId);
      expect(m2.snapshots.find((s: { snapshot_id: number }) => s.snapshot_id === g2.snapshotId)).toMatchObject({ delta_only: true });
      const delta2 = (await store.get(`commercial/snapshots/${g2.snapshotId}/delta.ndjson`))!.toString().trim().split('\n');
      expect(delta2).toHaveLength(1);
      expect(await store.get(`commercial/snapshots/${g2.snapshotId}/regions.ndjson`)).toBeNull();
      expect(g.inserted).toBe(5);

      // Customer API: the key's profile decides, links are signed and download.
      const { app, mk } = await (async () => {
        const app = await buildApp(pool, { adminToken: 'tok', exportDir: await mkdtemp(join(tmpdir(), 'ci-')), requireApiKey: true, store });
        const mk = async (name: string, extra = {}) => (await app.inject({ method: 'POST', url: '/v1/api-keys', headers: { authorization: 'Bearer tok' }, payload: { name, ...extra } })).json() as { key: string; export_profile: string };
        return { app, mk };
      })();
      const cust = await mk('cust');
      expect(cust.export_profile).toBe('commercial');
      expect((await app.inject({ method: 'POST', url: '/v1/api-keys', headers: { authorization: 'Bearer tok' }, payload: { name: 'x', export_profile: 'bogus' } })).statusCode).toBe(400);
      const lat = (await app.inject({ url: '/v1/exports/latest', headers: { 'x-api-key': cust.key } })).json() as { profile: string; snapshot_id: number; files: Record<string, { url: string; sha256: string; bytes: number }>; snapshots: { delta: { url: string } }[] };
      expect(lat).toMatchObject({ profile: 'commercial', snapshot_id: g3.snapshotId });
      const dl = await app.inject({ url: new URL(lat.files['regions.ndjson']!.url).pathname + new URL(lat.files['regions.ndjson']!.url).search });
      expect(dl.statusCode).toBe(200);
      expect(createHash('sha256').update(dl.rawPayload).digest('hex')).toBe(lat.files['regions.ndjson']!.sha256);
      expect((await app.inject({ url: '/dl/commercial/manifest.json?exp=1&sig=bad' })).statusCode).toBe(403);
      const fullKey = await mk('internal', { export_profile: 'full' });
      expect(((await app.inject({ url: '/v1/exports/latest', headers: { 'x-api-key': fullKey.key } })).json() as { profile: string }).profile).toBe('full');
      await app.close();

      // Rollback: manifest points back, later snapshots are retracted and skipped by the next publish.
      const retracted = await rollback(store, 'commercial', m.latest);
      expect(retracted).toEqual([g2.snapshotId, g3.snapshotId]);
      const back = JSON.parse((await store.get('commercial/manifest.json'))!.toString());
      expect(back).toMatchObject({ latest: m.latest, retracted: [g2.snapshotId, g3.snapshotId] });
      expect((await publish(pool, store, wd, { profiles: ['commercial'] }))[0]!.snapshots).toEqual([]);
      await expect(rollback(store, 'commercial', 999)).rejects.toThrow(/not a published full snapshot/);
    });

    it('serves per-country file sets to keys licensed for some countries only', async () => {
      const store = new FsStore(join(work, 'store3'), 'https://api.test', 'secret');
      const wd = join(work, 'work3');
      await setVerdict('geonames', 'green');
      const both = (n: number) => [...divs('g', 'DE', n), ...divs('g', 'FR', n)];
      await ingest(pool, GREEN, both(3), { kinds: ['division'], countries: ['DE', 'FR'] });
      await setVerdict('src-green', 'green');
      await publish(pool, store, wd, { profiles: ['commercial'] });
      const fr = await ingest(pool, GREEN, [...divs('g', 'DE', 3), ...divs('g', 'FR', 5)], { kinds: ['division'], countries: ['DE', 'FR'] }); // only FR changes
      await publish(pool, store, wd, { profiles: ['commercial'] });

      const app = await buildApp(pool, { adminToken: 'tok', exportDir: await mkdtemp(join(tmpdir(), 'ci-')), requireApiKey: true, store });
      const mk = async (payload: object) => (await app.inject({ method: 'POST', url: '/v1/api-keys', headers: { authorization: 'Bearer tok' }, payload })).json() as { key: string; export_countries: string[] | null };
      expect((await app.inject({ method: 'POST', url: '/v1/api-keys', headers: { authorization: 'Bearer tok' }, payload: { name: 'bad', export_countries: ['Germany'] } })).statusCode).toBe(400);
      const de = await mk({ name: 'de-only', export_countries: ['de'] });
      expect(de.export_countries).toEqual(['DE']);
      const get = async (key: string, q = '') => (await app.inject({ url: `/v1/exports/latest${q}`, headers: { 'x-api-key': key } })).json() as { files: Record<string, unknown>; by_country: Record<string, { files: Record<string, { url: string; sha256: string }>; deltas: { snapshot_id: number }[] }>; snapshots: { delta?: unknown }[] };

      const r = await get(de.key);
      expect(r.files).toEqual({}); // restricted key: no global files
      expect(Object.keys(r.by_country)).toEqual(['DE']);
      expect(Object.keys(r.by_country.DE!.files).sort()).toEqual(['country.json', 'holidays.ndjson', 'regions.ndjson']);
      expect(r.snapshots.every((x) => x.delta === undefined)).toBe(true);
      expect(r.by_country.DE!.deltas.map((x) => x.snapshot_id)).not.toContain(fr.snapshotId); // nothing changed in DE in that snapshot
      const dl = await app.inject({ url: new URL(r.by_country.DE!.files['regions.ndjson']!.url).pathname + new URL(r.by_country.DE!.files['regions.ndjson']!.url).search });
      const lines = dl.body.trim().split('\n').map((l) => JSON.parse(l));
      expect(lines).toHaveLength(3);
      expect(new Set(lines.map((l) => l.country_code))).toEqual(new Set(['DE']));
      expect(Object.keys((await get(de.key, '?country=FR')).by_country)).toEqual([]); // outside the license
      expect(Object.keys((await get(de.key, '?country=de,fr')).by_country)).toEqual(['DE']);

      const all = await mk({ name: 'all' });
      const g = await get(all.key);
      expect(Object.keys(g.files)).toContain('regions.ndjson');
      expect(g.by_country).toEqual({}); // no country selection: global files only
      const f = await get(all.key, '?country=FR');
      expect(f.files).toEqual({});
      expect(f.by_country.FR!.deltas.map((x) => x.snapshot_id)).toContain(fr.snapshotId); // FR changed in that snapshot
      await app.close();
    });

    it('keeps a source out of the commercial profile while its license page change is unreviewed', async () => {
      const store = new FsStore(join(work, 'store2'), 'https://api.test', 'secret');
      await ingest(pool, GREEN, divs('g', 'DE', 4), { kinds: ['division'], countries: ['DE'] });
      await setVerdict('src-green', 'green');
      await pool.query("UPDATE sources SET status = 'license_changed' WHERE id = 'src-green'");
      // Only the unrelated (cleared) geonames snapshot is published; nothing of the blocked source.
      const res = (await publish(pool, store, join(work, 'work2'), { profiles: ['commercial'] }))[0]!;
      expect(res.snapshots).toHaveLength(1);
      const m = JSON.parse((await store.get('commercial/manifest.json'))!.toString());
      expect((await store.get(`commercial/${m.snapshots[0].files['regions.ndjson'].path}`))!.toString()).toBe('');
      expect((await store.get(`commercial/${m.snapshots[0].files['ATTRIBUTION.md'].path}`))!.toString()).not.toContain('src-green');
    });

    it('refuses to upload a commercial bundle that contains an uncleared source', async () => {
      await ingest(pool, RED, divs('r', 'FR', 2), { kinds: ['division'], countries: ['FR'] });
      await setVerdict('src-red', 'red');
      const dir = join(work, 'bad');
      const sid = 777;
      const { mkdir } = await import('node:fs/promises');
      await mkdir(join(dir, 'snapshots', String(sid)), { recursive: true });
      await writeFile(join(dir, 'snapshots', String(sid), 'regions.ndjson'), JSON.stringify({ id: 'x', source_id: 'src-red' }) + '\n');
      const entry = { snapshot_id: sid, from_seq: 0, to_seq: 0, created_at: '', files: { 'regions.ndjson': { path: '', sha256: '', bytes: 0 } } };
      await expect(verifyCommercialBundle(pool, dir, entry)).rejects.toThrow(/src-red/);
      await writeFile(join(dir, 'snapshots', String(sid), 'regions.ndjson'), '');
      await expect(verifyCommercialBundle(pool, dir, entry)).resolves.toBeUndefined();
      expect(await readFile(join(dir, 'snapshots', String(sid), 'regions.ndjson'), 'utf8')).toBe('');
    });

    it('exportLinks returns null before anything is published', async () => {
      expect(await exportLinks(new FsStore(join(work, 'empty'), 'https://api.test', 's'), 'commercial')).toBeNull();
    });
  });
});
