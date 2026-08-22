import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDatabase } from '../config/database.js';
import { loadEnv } from '../config/env.js';

const directory = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../db/migrations');
const database = createDatabase(loadEnv());
try {
  await database.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    filename TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  for (const file of (await fs.readdir(directory)).filter((name) => name.endsWith('.sql')).sort()) {
    const applied = await database.query('SELECT 1 FROM schema_migrations WHERE filename = $1', [file]);
    if (applied.rows.length) continue;
    await database.query(await fs.readFile(path.join(directory, file), 'utf8'));
    await database.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
    console.log(`Applied ${file}`);
  }
} finally {
  await database.close();
}
