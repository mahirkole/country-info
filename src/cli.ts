import { config } from './config.js';
import { createPool, migrate } from './db.js';
import { loadGeoNames } from './sources/geonames.js';
import { ingest } from './ingest.js';
import { GEONAMES } from './sources/geonames.js';
import { GISCO_NUTS, GISCO_LAU, loadNuts, loadLau } from './sources/gisco.js';
import { EU27 } from './sources/eu.js';
import { linkRegions } from './linking.js';
import { enrichWikidata, linkByQid, syncLayerQids, enrichIso3166_2 } from './enrich.js';
import { NATIONAL, nationalSource } from './sources/national/index.js';
import { allTargets, syncTargetMetadata } from './targets.js';
import { dueSourceIds, runRefresh, type RunResult } from './refresh.js';
import { ackLicense, checkLicenses } from './license-watch.js';
import { loadHolidayFiles, HOLIDAYS_SOURCE } from './holidays/load.js';
import { compileHolidays } from './holidays/rules.js';
import { diffHolidays, fetchNager } from './holidays/check.js';
import { exportSnapshot } from './export.js';
import { processDeliveries } from './webhooks.js';
import { buildApp } from './api.js';
import { enrichCldr } from './sources/cldr.js';
import { join } from 'node:path';
import { pruneArchive } from './sources/fetch.js';
import { formatSummary, holidayGaps, notify, summarizeCycle } from './notify.js';
import { createStore, publish, PROFILES, rollback, type Profile } from './publish.js';
import { retractRelease, runDigest, webhookMailer } from './release-notes.js';

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
      const results: RunResult[] = [];
      for (const t of chosen) {
        const r = await runRefresh(pool, t, { cacheDir: config.cacheDir, force: flag('--force'), dryRun: flag('--dry-run') });
        console.log(`${r.status.padEnd(12)} ${r.source.padEnd(20)} rows=${r.rows ?? '-'} +${r.inserted ?? 0} ~${r.updated ?? 0} -${r.deleted ?? 0} ${r.detail ?? ''}`);
        results.push(r);
        if (r.status === 'failed' || r.status === 'needs_review') bad++;
      }
      const pruned = await pruneArchive(join(config.cacheDir, 'raw'), config.rawArchiveMaxMb * 1024 * 1024);
      if (pruned) console.log(`raw archive: pruned ${pruned} oldest file(s)`);
      if (!flag('--dry-run')) {
        // Tell the operator what needs a person (quiet days send nothing).
        const summary = await summarizeCycle(pool, results);
        summary.attention.push(...(await holidayGaps(pool)));
        if (summary.attention.length || summary.changes.length) {
          const sent = await notify(config.notifyUrl, formatSummary(summary));
          console.log(formatSummary(summary) + (config.notifyUrl ? (sent ? '\n(notification sent)' : '\n(notification FAILED)') : ''));
        }
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
      const flagged = res.filter((r) => r.status === 'changed' || r.status === 'error');
      if (flagged.length) {
        process.exitCode = 1;
        await notify(config.notifyUrl, ['country-info license watch', ...flagged.map((r) => `⚖️ ${r.source}: ${r.status} ${r.detail ?? ''}`)].join('\n'));
      }
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
      console.log('layer QIDs registered:', await syncLayerQids(pool));
      console.log('linked by QID:', await linkByQid(pool));
      console.log('iso 3166-2:', await enrichIso3166_2(pool));
      break;
    }
    case 'enrich-cldr': {
      // enrich-cldr: localized country names and current currencies from Unicode CLDR (Unicode License v3).
      await migrate(pool);
      console.log(await enrichCldr(pool, config.cacheDir));
      break;
    }
    case 'export':
      {
      const idArg = process.argv.slice(3).find((a) => /^\d+$/.test(a));
      console.log(await exportSnapshot(pool, config.exportDir, idArg ? Number(idArg) : undefined, { commercialOnly: process.argv.includes('--commercial') }));
    }
      break;
    case 'publish': {
      // publish [--profile commercial|full] [--rollback <snapshotId>]: export what is new and upload it (manifest last); see docs/OPERATIONS.md.
      await migrate(pool);
      const store = createStore();
      if (!store) throw new Error('storage is not configured (PUBLISH_STORE=s3 needs S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY, S3_SECRET_KEY)');
      const args = process.argv.slice(3);
      const val = (n: string) => args[args.indexOf(n) + 1];
      const profiles = args.includes('--profile') ? ([val('--profile')] as Profile[]) : PROFILES;
      if (profiles.some((p) => !PROFILES.includes(p))) throw new Error(`profile must be one of ${PROFILES.join(', ')}`);
      if (args.includes('--rollback')) {
        const to = Number(val('--rollback'));
        for (const p of profiles) {
          const retracted = await rollback(store, p, to);
          // Withdraw the matching release notes too (subscribers get release.retracted).
          for (const id of retracted) {
            const n = (await pool.query('SELECT id FROM release_notes WHERE snapshot_id = $1', [id])).rows[0];
            if (n) await retractRelease(pool, Number(n.id));
          }
          console.log(`${p}: rolled back to snapshot ${to}, retracted ${retracted.join(', ') || 'none'}`);
        }
        break;
      }
      const res = await publish(pool, store, join(config.publishDir, 'work'), { profiles, log: console.log });
      console.log(res.map((r) => `${r.profile}: ${r.snapshots.length ? `snapshots ${r.snapshots.join(',')}` : 'nothing new'}`).join('\n'));
      break;
    }
    case 'digest': {
      // Send new release notes to e-mail subscribers (needs MAIL_WEBHOOK_URL).
      await migrate(pool);
      if (!config.mailWebhookUrl) {
        console.log('MAIL_WEBHOOK_URL is not set; digests are not sent');
        break;
      }
      console.log('digests sent:', await runDigest(pool, webhookMailer(config.mailWebhookUrl, config.mailFrom)));
      break;
    }
    case 'notify': {
      // notify [text]: send an operations alert (used by scripts/cron/run-cycle.sh); without text a test message.
      const text = process.argv.slice(3).join(' ') || 'country-info: test notification';
      console.log((await notify(config.notifyUrl, text)) ? 'sent' : 'not sent (NOTIFY_WEBHOOK_URL unset or rejected)');
      break;
    }
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
      console.error('usage: cli.ts migrate | ingest | ingest-gisco | ingest-holidays [from] [to] | refresh [--due|--source ids] [--force] [--dry-run] | check-licenses [id] | license-ack <id> | link | enrich-wikidata [--spec s] [--limit n] | enrich-cldr | ingest-national <CC|all> | check-holidays [year] | export [snapshotId] [--commercial] | publish [--profile p] [--rollback id] | digest | notify [text] | deliver | serve');
      process.exitCode = 1;
  }
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(2); // 1 is reserved for "sources need attention" (refresh, check-licenses)
});
