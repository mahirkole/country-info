import { config } from './config.js';
import { createPool, migrate } from './db.js';
import { loadGeoNames } from './sources/geonames.js';
import { ingest } from './ingest.js';
import { exportSnapshot } from './export.js';
import { processDeliveries } from './webhooks.js';
import { buildApp } from './api.js';

const cmd = process.argv[2];
const pool = createPool();

async function main() {
  switch (cmd) {
    case 'migrate':
      console.log('applied:', await migrate(pool));
      break;
    case 'ingest': {
      await migrate(pool);
      const input = await loadGeoNames(config.cacheDir, config.ingestAdmin2);
      const kinds = config.ingestAdmin2 ? ['country', 'admin1', 'admin2'] : ['country', 'admin1'];
      console.log(await ingest(pool, 'geonames', input, kinds));
      break;
    }
    case 'export':
      console.log(await exportSnapshot(pool, config.exportDir, process.argv[3] ? Number(process.argv[3]) : undefined));
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
      console.error('usage: cli.ts migrate | ingest | export [snapshotId] | deliver | serve');
      process.exitCode = 1;
  }
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
