import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from './pool.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(__dirname, '../../../migrations');

async function run(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    const applied = await client.query<{ name: string }>('SELECT name FROM schema_migrations');
    const appliedNames = new Set(applied.rows.map((r) => r.name));

    const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith('.sql')).sort();

    for (const file of files) {
      if (appliedNames.has(file)) {
        console.log(`↷ ${file} ya aplicada`);
        continue;
      }
      const sql = await readFile(path.join(MIGRATIONS_DIR, file), 'utf-8');
      console.log(`→ aplicando ${file}...`);
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
        await client.query('COMMIT');
        console.log(`✔ ${file} aplicada`);
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }
    }

    console.log('Migraciones al día.');
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error('Error ejecutando migraciones:', err);
  process.exit(1);
});
