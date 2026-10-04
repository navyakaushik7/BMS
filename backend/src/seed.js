import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function seed() {
  const sql = fs.readFileSync(path.join(__dirname, '..', 'sql', 'seed.sql'), 'utf8');
  console.log('Seeding sample data...');
  await pool.query(sql);
  console.log('✔ Seed data inserted (or already present).');
  await pool.end();
}

seed().catch((err) => {
  console.error('✘ Seeding failed:', err.message);
  process.exit(1);
});
