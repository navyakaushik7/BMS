// Generates a large demo dataset to test charts at scale.
//   npm run seed:large            -> 10,000 voters, 50 booths
//   npm run seed:large -- 50000   -> custom voter count
//   npm run seed:large -- --clear -> remove the demo data again
import { pool } from './db.js';

const arg = process.argv[2];
const COUNT = /^\d+$/.test(arg || '') ? parseInt(arg, 10) : 10000;

async function main() {
  const ward = (await pool.query('SELECT id, name FROM wards ORDER BY id LIMIT 1')).rows[0];
  if (!ward) throw new Error('Run "npm run seed" first (needs a ward).');

  if (arg === '--clear') {
    await pool.query(`DELETE FROM voters WHERE voter_card_id LIKE 'DEMO%'`);
    await pool.query(`DELETE FROM booths WHERE name LIKE 'Demo Booth %'`);
    console.log('Demo data removed.');
    return pool.end();
  }

  await pool.query(
    `INSERT INTO booths (name, ward_id, address)
     SELECT 'Demo Booth ' || lpad(g::text, 3, '0'), $1, 'Demo locality ' || g
     FROM generate_series(1, 50) g
     WHERE NOT EXISTS (SELECT 1 FROM booths WHERE name = 'Demo Booth ' || lpad(g::text, 3, '0') AND ward_id = $1)`,
    [ward.id]
  );
  await pool.query(
    `INSERT INTO schemes (name, category, ward_id)
     SELECT n, c, $1 FROM (VALUES
       ('Old Age Pension','Welfare'),('PM-KISAN','Agriculture'),('Ayushman Bharat','Health'),
       ('Ujjwala Yojana','Welfare'),('Scholarship','Education'),('Housing Grant','Housing')) t(n, c)
     WHERE NOT EXISTS (SELECT 1 FROM schemes s WHERE s.name = t.n AND s.ward_id = $1)`,
    [ward.id]
  );

  // Skewed randomness (power of random) so some booths/castes are much bigger — like real data
  await pool.query(
    `INSERT INTO voters (voter_card_id, name, relation_name, age, gender, phone, address, religion, caste, family_id, ward_id, booth_id)
     SELECT 'DEMO' || lpad(t.g::text, 7, '0'),
            (ARRAY['Amit','Gurpreet','Simran','Rahul','Harjeet','Priya','Manjit','Neha','Sukhdev','Anita','Karan','Jaswant'])[1 + (random()*11)::int]
              || ' ' || (ARRAY['Singh','Kaur','Sharma','Verma','Gill','Sandhu','Mehra','Bajwa','Dhillon','Kumar'])[1 + (random()*9)::int],
            'S/O Demo', 18 + (random()*62)::int,
            (ARRAY['Male','Female','Male','Female','Other'])[1 + (random()*4)::int],
            '+9198' || lpad((t.g / 3)::text, 8, '0'), 'House ' || t.g,
            (ARRAY['Hindu','Sikh','Muslim','Christian','Other'])[1 + (power(random(), 1.6)*4)::int],
            (ARRAY['General','OBC','SC','ST','Jat Sikh','Ramgarhia','Khatri','Brahmin','Rajput','Bania','Gujjar','Yadav',
                   'Kurmi','Mazhabi','Valmiki','Ravidasia','Arora','Saini','Kamboj','Lubana'])[1 + (power(random(), 1.8)*19)::int],
            'phone:+9198' || lpad((t.g / 3)::text, 8, '0'), $1, b.id
     FROM (SELECT g, 1 + (power(random(), 1.5)*49)::int AS bn FROM generate_series(1, $2) g) t(g, bn)
     JOIN booths b ON b.ward_id = $1 AND b.name = 'Demo Booth ' || lpad(t.bn::text, 3, '0')
     ON CONFLICT (ward_id, voter_card_id) DO NOTHING`,
    [ward.id, COUNT]
  );
  await pool.query(
    `INSERT INTO voter_schemes (voter_id, scheme_id)
     SELECT v.id, (SELECT array_agg(id ORDER BY id) FROM schemes WHERE ward_id = $1 AND name IN
              ('Old Age Pension','PM-KISAN','Ayushman Bharat','Ujjwala Yojana','Scholarship','Housing Grant'))[1 + (random()*5)::int]
     FROM voters v WHERE v.voter_card_id LIKE 'DEMO%' AND v.ward_id = $1 AND random() < 0.6
     ON CONFLICT DO NOTHING`,
    [ward.id]
  );
  console.log(`Added up to ${COUNT} demo voters, 50 booths and 6 schemes to ward "${ward.name}".`);
  await pool.end();
}

main().catch((e) => { console.error(e.message); process.exit(1); });
