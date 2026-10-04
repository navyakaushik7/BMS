import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function migrate() {
  const sql = fs.readFileSync(path.join(__dirname, '..', 'sql', 'schema.sql'), 'utf8');
  console.log('Running schema migration...');
  await pool.query(sql);
  console.log('✔ Schema applied successfully.');
  await pool.end();
}

migrate().catch((err) => {
  console.error('✘ Migration failed:', err.message);
  process.exit(1);
});
