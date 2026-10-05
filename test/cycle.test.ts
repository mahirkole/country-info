import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { migrate } from '../src/db.js';

const url = process.env.TEST_DATABASE_URL;
const d = url ? describe : describe.skip;

function run(env: Record<string, string>): Promise<{ code: number; out: string }> {
  return new Promise((resolve) => {
    const p = spawn('bash', ['scripts/cron/run-cycle.sh'], { env: { ...process.env, ...env } });
    let out = '';
    p.stdout.on('data', (b) => (out += b));
    p.stderr.on('data', (b) => (out += b));
    p.on('close', (code) => resolve({ code: code ?? -1, out }));
  });
}

d('scripts/cron/run-cycle.sh', () => {
  let alerts: string[] = [];
  let server: http.Server;
  let hook = '';
  let tmp: string;
  const base = () => ({ DATABASE_URL: url!, PUBLISH_DIR: join(tmp, 'pub'), CACHE_DIR: join(tmp, 'cache'), CYCLE_LOCK: join(tmp, 'lock'), NOTIFY_WEBHOOK_URL: hook, REFRESH_ARGS: '--source none-such', SKIP_STEPS: 'check-licenses' });
  beforeAll(async () => {
    tmp = await mkdtemp(join(tmpdir(), 'cyc-'));
    const pool = new pg.Pool({ connectionString: url });
    await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public');
    await migrate(pool);
    await pool.end();
    server = http.createServer((req, res) => {
      let b = '';
      req.on('data', (c) => (b += c));
      req.on('end', () => { alerts.push(JSON.parse(b).text); res.end('ok'); });
    });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    hook = `http://127.0.0.1:${(server.address() as { port: number }).port}/`;
  });
  afterAll(() => server.close());

  it('runs the steps, exits 0 and sends no alert on a quiet cycle', async () => {
    const r = await run(base());
    expect(r.out).toContain('::: refresh');
    expect(r.out).toContain('::: check-licenses (skipped)');
    expect(r.out).toContain('::: publish');
    expect(r.code).toBe(0);
    expect(alerts).toEqual([]);
  }, 60_000);

  it('does not start a second cycle while another holds the lock', async () => {
    const lock = join(tmp, 'held');
    const holder = spawn('bash', ['-c', `exec 9>${lock}; flock 9; echo held; sleep 5`]);
    await new Promise((r) => holder.stdout.once('data', r)); // lock is taken
    const r = await run({ ...base(), CYCLE_LOCK: lock });
    holder.kill();
    expect(r.out).toContain('another cycle is running');
    expect(r.out).not.toContain('::: refresh');
    expect(r.code).toBe(0);
  }, 30_000);

  it('exits 1 and alerts when a step fails (unreachable database)', async () => {
    alerts = [];
    const r = await run({ ...base(), DATABASE_URL: 'postgres://postgres@127.0.0.1:1/none' });
    expect(r.code).toBe(1);
    expect(r.out).toContain('!!! migrate failed');
    await new Promise((res) => setTimeout(res, 300));
    expect(alerts.some((a) => a.includes('failed steps') && a.includes('migrate'))).toBe(true);
  }, 60_000);
});
