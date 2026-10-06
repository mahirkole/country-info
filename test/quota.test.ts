import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildApp } from '../src/api.js';
import { migrate } from '../src/db.js';

const url = process.env.TEST_DATABASE_URL;
describe.skipIf(!url)('monthly request quota of an API key', () => {
  const pool = new pg.Pool({ connectionString: url });
  let app: Awaited<ReturnType<typeof buildApp>>;
  beforeAll(async () => {
    await migrate(pool);
    await pool.query('TRUNCATE api_keys, api_usage RESTART IDENTITY CASCADE');
    app = await buildApp(pool, { adminToken: 'adm', exportDir: await mkdtemp(join(tmpdir(), 'ci-')), requireApiKey: true });
  });
  afterAll(async () => { await app.close(); await pool.end(); });

  it('rejects bad quota values, shows plan and quota, counts requests, answers 429 quota_exceeded without metering it, and leaves other keys alone', async () => {
    const mk = (payload: object) => app.inject({ method: 'POST', url: '/v1/api-keys', headers: { authorization: 'Bearer adm' }, payload });
    expect((await mk({ name: 'bad', monthly_quota: 0 })).statusCode).toBe(400);
    expect((await mk({ name: 'bad', monthly_quota: 1.5 })).statusCode).toBe(400);
    const small = (await mk({ name: 'small', plan: 'free', monthly_quota: 3 })).json();
    const open = (await mk({ name: 'open' })).json();
    expect(small).toMatchObject({ plan: 'free', monthly_quota: 3 });
    expect(open.monthly_quota).toBeNull();
    const call = (key: string) => app.inject({ url: '/v1/scopes', headers: { 'x-api-key': key } });
    const r1 = await call(small.key);
    expect(r1.statusCode).toBe(200);
    expect(r1.headers['x-quota-limit']).toBe('3');
    expect(r1.headers['x-quota-remaining']).toBe('2');
    expect((await call(small.key)).headers['x-quota-remaining']).toBe('1');
    expect((await call(small.key)).headers['x-quota-remaining']).toBe('0');
    const over = await call(small.key);
    expect(over.statusCode).toBe(429);
    expect(over.json()).toMatchObject({ error: 'quota_exceeded', monthly_quota: 3 });
    expect(over.json().resets_at).toMatch(/^\d{4}-\d{2}-01T00:00:00\.000Z$/);
    expect(Number(over.headers['retry-after'])).toBeGreaterThan(0);
    expect((await call(open.key)).statusCode).toBe(200); // another key, no quota
    const list = (await app.inject({ url: '/v1/api-keys', headers: { authorization: 'Bearer adm' } })).json().data;
    expect(list.find((k: { name: string }) => k.name === 'small')).toMatchObject({ plan: 'free', monthly_quota: 3 });
  });
});
