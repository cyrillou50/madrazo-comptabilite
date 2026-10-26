import 'dotenv/config';
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { createPool } from './db.js';

const config = loadConfig();
const pool = createPool(config);
const app = createApp(pool, config);
const server = app.listen(config.port, () => {
  app.request.log?.info({ port: config.port }, 'Madrazo API started');
});

async function shutdown(signal: string) {
  console.info(`${signal}: arrêt gracieux…`);
  server.close(async () => { await pool.end(); process.exit(0); });
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGTERM', () => { void shutdown('SIGTERM'); });
process.on('SIGINT', () => { void shutdown('SIGINT'); });
