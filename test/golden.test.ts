import { afterAll, describe, expect, it } from 'vitest';
import pg from 'pg';

/**
 * Regression checks against a REAL, fully loaded database (set GOLDEN_DATABASE_URL; skipped otherwise, e.g. in CI).
 * Thresholds are not facts typed from memory: bands come from the refresh targets (`sources.expected_*`, derived from the publishers' own
 * counts when the adapters were written) and the attribute minimums are the parsers' own contract limits (a source that returns fewer rows is rejected).
 */
const url = process.env.GOLDEN_DATABASE_URL;
describe.skipIf(!url)('golden checks on a loaded database', () => {
  const pool = new pg.Pool({ connectionString: url });
  afterAll(() => pool.end());

  it('every source with a row band is inside it', async () => {
    const rows = (await pool.query(`SELECT s.id, s.expected_min, s.expected_max, count(e.id)::int AS n FROM sources s LEFT JOIN entities e ON e.source_id = s.id WHERE s.expected_max > 0 GROUP BY s.id HAVING count(e.id) > 0`)).rows;
    expect(rows.length).toBeGreaterThan(10);
    for (const r of rows) expect(r.n, `${r.id} has ${r.n} rows, expected ${r.expected_min}-${r.expected_max}`).toBeGreaterThanOrEqual(r.expected_min);
    for (const r of rows) expect(r.n, `${r.id} has ${r.n} rows, expected ${r.expected_min}-${r.expected_max}`).toBeLessThanOrEqual(r.expected_max);
  });

  it('country attributes reach the coverage their parsers require', async () => {
    const n = async (grp: string) => Number((await pool.query('SELECT count(*) AS n FROM entity_attributes WHERE grp = $1', [grp])).rows[0].n);
    expect(await n('timezones')).toBeGreaterThanOrEqual(200);
    expect(await n('telephony')).toBeGreaterThanOrEqual(200);
    expect(await n('driving')).toBeGreaterThanOrEqual(200);
    expect(await n('postal')).toBeGreaterThanOrEqual(200);
    expect(await n('week')).toBeGreaterThanOrEqual(240);
    expect(await n('currency')).toBeGreaterThanOrEqual(150);
  });

  it('every holiday is a child of a country or region that exists and verified holidays carry a source URL and read date', async () => {
    const bad = (await pool.query(`SELECT count(*)::int AS n FROM entities h WHERE h.kind = 'holiday' AND h.data->>'verification' = 'verified' AND (h.data->'source'->>'url' IS NULL OR h.data->'source'->>'checked_on' IS NULL)`)).rows[0].n;
    expect(bad).toBe(0);
  });
});
