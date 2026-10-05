import { config } from './config.js';
import { createPool, migrate } from './db.js';
import { loadGeoNames } from './sources/geonames.js';
import { ingest } from './ingest.js';
import { GEONAMES } from './sources/geonames.js';
import { GISCO_NUTS, GISCO_LAU, loadNuts, loadLau } from './sources/gisco.js';
import { EU27 } from './sources/eu.js';
import { linkRegions } from './linking.js';
import { enrichWikidata, linkByQid } from './enrich.js';
import { NATIONAL, nationalSource } from './sources/national/index.js';
import { allTargets, syncTargetMetadata } from './targets.js';
import { dueSourceIds, runRefresh } from './refresh.js';
import { ackLicense, checkLicenses } from './license-watch.js';
import { loadHolidayFiles, HOLIDAYS_SOURCE } from './holidays/load.js';
import { compileHolidays } from './holidays/rules.js';
import { diffHolidays, fetchNager } from './holidays/check.js';
import { exportSnapshot } from './export.js';
import { processDeliveries } from './webhooks.js';
import { buildApp } from './api.js';

const cmd = process.argv[2];
/** `ALLOW_BULK_DELETE=1` disables the ingest delete guard for an intentional large removal. */
const deleteRatio = () => (process.env.ALLOW_BULK_DELETE === '1' ? 1 : undefined);
const pool = createPool();

async function main() {
  switch (cmd) {
    case 'migrate':
      console.log('applied:', await migrate(pool));
      break;
    case 'ingest': {
      await migrate(pool);
      const input = await loadGeoNames(config.cacheDir, { admin2: config.ingestAdmin2, cities: config.ingestCities });
      const kinds = ['country', 'admin1', ...(config.ingestAdmin2 ? ['admin2'] : []), ...(config.ingestCities ? ['city'] : [])];
      console.log(await ingest(pool, GEONAMES, input, { kinds, maxDeleteRatio: deleteRatio() }));
      break;
    }
    case 'ingest-gisco': {
      // NUTS (EU27 + Türkiye İBBS) and LAU (EU27). Requires `ingest` (GeoNames countries) first: parents are countries.
      await migrate(pool);
      const nutsCountries = new Set<string>([...EU27, 'TR']);
      console.log('nuts', await ingest(pool, GISCO_NUTS, await loadNuts(config.cacheDir, nutsCountries), { kinds: ['nuts1', 'nuts2', 'nuts3'], countries: [...nutsCountries], maxDeleteRatio: deleteRatio() }));
      const lauCountries = new Set<string>(EU27);
      console.log('lau', await ingest(pool, GISCO_LAU, await loadLau(config.cacheDir, lauCountries), { kinds: ['lau'], countries: [...lauCountries], maxDeleteRatio: deleteRatio() }));
      break;
    }
    case 'ingest-holidays': {
      // Usage: ingest-holidays [fromYear] [toYear]; default 2024 .. current year + 2 (past years are kept, never deleted by the rolling window).
      await migrate(pool);
      const from = Number(process.argv[3] ?? 2024);
      const to = Number(process.argv[4] ?? new Date().getUTCFullYear() + 2);
      const files = await loadHolidayFiles();
      const input = files.flatMap((f) => compileHolidays(f, from, to));
      console.log(await ingest(pool, HOLIDAYS_SOURCE, input, { kinds: ['holiday'], countries: files.map((f) => f.country), maxDeleteRatio: deleteRatio() }));
      break;
    }
    case 'link': {
      await migrate(pool);
      const p = await linkRegions(pool);
      console.log({ linked: p.links.length, ambiguous: p.ambiguous.length, unmatched: p.unmatched.length, levels: p.levelByCountry });
      break;
    }
    case 'check-holidays': {
      // Alarm only: compare our nationwide public holidays with Nager.Date for the given year (default: current).
      const year = Number(process.argv[3] ?? new Date().getUTCFullYear());
      for (const f of await loadHolidayFiles()) {
        const d = diffHolidays(compileHolidays(f, year, year), await fetchNager(f.country, year));
        console.log(f.country, year, d.onlyOurs.length + d.onlyTheirs.length === 0 ? 'ok' : d);
      }
      break;
    }
    case 'ingest-national': {
      // Usage: ingest-national <CC>|all. Each country's own official source; GeoNames countries must exist first.
      await migrate(pool);
      const arg = (process.argv[3] ?? '').toUpperCase();
      const list = arg === 'ALL' ? Object.keys(NATIONAL) : [arg];
      for (const cc of list) {
        const src = nationalSource(cc);
        if (src.licenseStatus === 'partial') console.warn(`${cc}: license only partially established — ${src.meta.license}`);
        const input = await src.load(config.cacheDir);
        console.log(cc, await ingest(pool, src.meta, input, { kinds: ['division'], countries: [cc], maxDeleteRatio: deleteRatio() }));
      }
      break;
    }
    case 'refresh': {
      // refresh [--due] [--source a,b] [--force] [--dry-run]; exit code 1 if any source failed or needs review.
      await migrate(pool);
      const args = process.argv.slice(3);
      const flag = (n: string) => args.includes(n);
      const srcArg = args[args.indexOf('--source') + 1];
      const targets = allTargets();
      await syncTargetMetadata(pool, targets);
      let chosen = targets;
      if (flag('--source')) chosen = targets.filter((t) => (srcArg ?? '').split(',').includes(t.meta.id));
      else if (flag('--due')) {
        const due = new Set(await dueSourceIds(pool, targets));
        chosen = targets.filter((t) => due.has(t.meta.id));
      }
      if (chosen.length === 0) console.log('nothing to do');
      let bad = 0;
      for (const t of chosen) {
        const r = await runRefresh(pool, t, { cacheDir: config.cacheDir, force: flag('--force'), dryRun: flag('--dry-run') });
        console.log(`${r.status.padEnd(12)} ${r.source.padEnd(20)} rows=${r.rows ?? '-'} +${r.inserted ?? 0} ~${r.updated ?? 0} -${r.deleted ?? 0} ${r.detail ?? ''}`);
        if (r.status === 'failed' || r.status === 'needs_review') bad++;
      }
      if (bad) process.exitCode = 1;
      break;
    }
    case 'check-licenses': {
      await migrate(pool);
      const targets = allTargets();
      await syncTargetMetadata(pool, targets);
      const only = process.argv[3];
      const res = await checkLicenses(pool, only ? targets.filter((t) => t.meta.id === only) : targets, config.cacheDir);
      for (const r of res) console.log(`${r.status.padEnd(10)} ${r.source} ${r.detail ?? ''}`);
      if (res.some((r) => r.status === 'changed' || r.status === 'error')) process.exitCode = 1;
      break;
    }
    case 'license-ack': {
      const t = allTargets().find((x) => x.meta.id === process.argv[3]);
      if (!t) throw new Error('usage: license-ack <source-id>');
      await ackLicense(pool, t, config.cacheDir);
      console.log('acknowledged', t.meta.id);
      break;
    }
    case 'enrich-wikidata': {
      // enrich-wikidata [--spec a,b] [--limit N] [--langs en,tr,...]: QIDs and multilingual labels from Wikidata (CC0), incremental.
      await migrate(pool);
      const args = process.argv.slice(3);
      const val = (n: string) => args[args.indexOf(n) + 1];
      const res = await enrichWikidata(pool, { specs: args.includes('--spec') ? val('--spec')!.split(',') : undefined, limit: args.includes('--limit') ? Number(val('--limit')) : undefined, langs: args.includes('--langs') ? val('--langs')!.split(',') : undefined });
      console.table(res);
      console.log('linked by QID:', await linkByQid(pool));
      break;
    }
    case 'export':
      {
      const idArg = process.argv.slice(3).find((a) => /^\d+$/.test(a));
      console.log(await exportSnapshot(pool, config.exportDir, idArg ? Number(idArg) : undefined, { commercialOnly: process.argv.includes('--commercial') }));
    }
      break;
    case 'deliver':
      console.log('attempted:', await processDeliveries(pool));
      break;
    case 'serve': {
      await migrate(pool);
      const app = await buildApp(pool);
      setInterval(() => processDeliveries(pool).catch((e) => console.error('webhook worker:', e)), 15_000).unref();
      await app.listen({ port: config.port, host: '0.0.0.0' });
      console.log(`listening on :${config.port}`);
      return; // keep pool open
    }
    default:
      console.error('usage: cli.ts migrate | ingest | ingest-gisco | ingest-holidays [from] [to] | refresh [--due|--source ids] [--force] [--dry-run] | check-licenses [id] | license-ack <id> | link | enrich-wikidata [--spec s] [--limit n] | ingest-national <CC|all> | check-holidays [year] | export [snapshotId] [--commercial] | deliver | serve');
      process.exitCode = 1;
  }
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
