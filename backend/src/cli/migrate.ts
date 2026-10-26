import 'dotenv/config';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import type { RowDataPacket } from 'mysql2/promise';
import { loadConfig } from '../config.js';
import { createPool, withTransaction } from '../db.js';

const config = loadConfig();
const pool = createPool(config);
const migrationsDir = path.resolve(process.cwd(), '..', 'database', 'migrations');

try {
  await pool.execute(`CREATE TABLE IF NOT EXISTS schema_migrations (
    filename VARCHAR(255) PRIMARY KEY, checksum CHAR(64) NOT NULL, applied_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
  ) ENGINE=InnoDB`);
  const { createHash } = await import('node:crypto');
  const files = (await readdir(migrationsDir)).filter((name) => name.endsWith('.sql')).sort();
  for (const filename of files) {
    const sql = await readFile(path.join(migrationsDir, filename), 'utf8');
    const checksum = createHash('sha256').update(sql).digest('hex');
    const [prior] = await pool.execute<RowDataPacket[]>('SELECT checksum FROM schema_migrations WHERE filename=?', [filename]);
    if (prior[0]) {
      if (prior[0].checksum !== checksum) throw new Error(`Migration déjà appliquée modifiée: ${filename}`);
      console.info(`déjà appliquée  ${filename}`); continue;
    }
    const statements = sql.split(/^\s*-- statement-breakpoint\s*$/m).map((part) => part.trim()).filter(Boolean);
    await withTransaction(pool, async (connection) => {
      for (const statement of statements) await connection.query(statement);
      await connection.execute('INSERT INTO schema_migrations(filename,checksum) VALUES(?,?)', [filename, checksum]);
    });
    console.info(`appliquée        ${filename}`);
  }
} finally { await pool.end(); }
