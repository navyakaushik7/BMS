import { Router } from 'express';
import { query, pool } from '../db.js';
import { requireAuth, resolveWardScope } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

/**
 * Derives a stable family grouping key when one isn't given explicitly.
 * A shared household phone number is the most common real-world signal —
 * this is intentionally NOT a substitute for voter_card_id as an identifier,
 * it just clusters likely-same-household rows together in the UI so staff
 * can tell family members apart (name/age/relation_name) once they've
 * narrowed a search down to a household.
 */
function deriveFamilyId(phone, address) {
  if (phone && String(phone).trim()) return `phone:${String(phone).trim()}`;
  if (address && String(address).trim()) return `addr:${String(address).trim().toLowerCase()}`;
  return null;
}

/**
 * GET /api/voters?search=&ageGroup=&booth_id=&scheme_id=&religion=&caste=&family=
 * `search` matches name OR voter_card_id (the candidate key) OR phone.
 * `family` matches the family_id exactly — used for "show me this household".
 */
router.get('/', async (req, res) => {
  const wardId = resolveWardScope(req);
  const { search, ageGroup, booth_id, scheme_id, religion, caste, family, contact_status } = req.query;

  const clauses = [];
  const params = [];

  if (wardId) {
    params.push(wardId);
    clauses.push(`v.ward_id = $${params.length}`);
  }
  if (search) {
    params.push(`%${search}%`);
    clauses.push(`(v.name ILIKE $${params.length} OR v.voter_card_id ILIKE $${params.length} OR v.phone ILIKE $${params.length})`);
  }
  if (booth_id) {
    params.push(parseInt(booth_id, 10));
    clauses.push(`v.booth_id = $${params.length}`);
  }
  if (religion) {
    params.push(religion);
    clauses.push(`v.religion = $${params.length}`);
  }
  if (caste) {
    params.push(`%${caste}%`);
    clauses.push(`(v.caste ILIKE $${params.length} OR v.sub_caste ILIKE $${params.length})`);
  }
  if (family) {
    params.push(family);
    clauses.push(`v.family_id = $${params.length}`);
  }
  if (contact_status) {
    params.push(contact_status);
    clauses.push(`v.contact_status = $${params.length}`);
  }
  if (ageGroup) {
    const ranges = { '18-25': [18, 25], '26-35': [26, 35], '36-45': [36, 45], '46-60': [46, 60], '60+': [61, 150] };
    const range = ranges[ageGroup];
    if (range) {
      params.push(range[0], range[1]);
      clauses.push(`v.age BETWEEN $${params.length - 1} AND $${params.length}`);
    }
  }

  if (scheme_id) {
    // Membership in the many-to-many junction, not the legacy single column
    params.push(parseInt(scheme_id, 10));
    clauses.push(`EXISTS (SELECT 1 FROM voter_schemes vs WHERE vs.voter_id = v.id AND vs.scheme_id = $${params.length})`);
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const { rows } = await query(
    `SELECT v.*, b.name AS booth_name, w.name AS ward_name,
            COALESCE(
              (SELECT json_agg(json_build_object('id', s.id, 'name', s.name, 'category', s.category) ORDER BY s.name)
               FROM voter_schemes vs JOIN schemes s ON s.id = vs.scheme_id WHERE vs.voter_id = v.id),
              '[]'
            ) AS schemes
     FROM voters v
     LEFT JOIN booths b ON b.id = v.booth_id
     LEFT JOIN wards w ON w.id = v.ward_id
     ${where}
     ORDER BY v.created_at DESC`,
    params
  );
  const withSchemeName = rows.map((r) => ({
    ...r,
    scheme_name: r.schemes.map((s) => s.name).join(', ')
  }));
  res.json(withSchemeName);
});

/** GET /api/voters/religions — distinct religion values in scope, for the filter dropdown */
router.get('/religions', async (req, res) => {
  const wardId = resolveWardScope(req);
  const { rows } = await query(
    `SELECT DISTINCT religion FROM voters WHERE religion IS NOT NULL AND religion <> '' ${wardId ? 'AND ward_id = $1' : ''} ORDER BY religion`,
    wardId ? [wardId] : []
  );
  res.json(rows.map((r) => r.religion));
});

/** POST /api/voters — create. voter_card_id is the candidate key: it must be globally unique within the ward. */
router.post('/', async (req, res) => {
  const wardId = req.user.role === 'admin' ? req.body.ward_id : req.user.wardId;
  if (!wardId) return res.status(400).json({ error: 'ward_id is required' });

  const { voter_card_id, name, relation_name, age, gender, phone, address, religion, caste, sub_caste, booth_id, contact_status, notes } = req.body;
  // Accept either the new scheme_ids array (a voter can be in many schemes)
  // or the legacy single scheme_id, for backward compatibility.
  const schemeIds = Array.isArray(req.body.scheme_ids)
    ? req.body.scheme_ids.map((id) => parseInt(id, 10)).filter(Boolean)
    : (req.body.scheme_id ? [parseInt(req.body.scheme_id, 10)] : []);
  if (!voter_card_id || !name || !age) {
    return res.status(400).json({ error: 'voter_card_id, name and age are required' });
  }
  const family_id = req.body.family_id || deriveFamilyId(phone, address);

  try {
    const initialStatus = contact_status || 'Not Contacted';
    const { rows } = await query(
      `INSERT INTO voters (voter_card_id, name, relation_name, age, gender, phone, address, religion, caste, sub_caste, family_id, ward_id, booth_id, created_by, contact_status, notes, last_contacted_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING *`,
      [voter_card_id, name, relation_name || null, age, gender || 'Male', phone || null, address || null,
       religion || null, caste || null, sub_caste || null, family_id, wardId, booth_id || null, req.user.id,
       initialStatus, notes || null, initialStatus !== 'Not Contacted' ? new Date() : null]
    );
    const voter = rows[0];
    for (const schemeId of schemeIds) {
      await query(`INSERT INTO voter_schemes (voter_id, scheme_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [voter.id, schemeId]);
    }
    await query(
      `INSERT INTO activity_log (user_id, action, entity, entity_id, ward_id, details) VALUES ($1,'create','voter',$2,$3,$4)`,
      [req.user.id, voter.id, wardId, JSON.stringify({ voter_card_id })]
    );
    req.app.get('io')?.to(`ward-${wardId}`).emit('voter:created', voter);
    res.status(201).json({ ...voter, scheme_ids: schemeIds });
  } catch (err) {
    if (err.code === '23505') {
      // unique_violation on the candidate key — duplicate detection triggered
      return res.status(409).json({ error: `Voter card ID "${voter_card_id}" already exists in this ward.` });
    }
    res.status(500).json({ error: 'Failed to create voter' });
  }
});

/** PUT /api/voters/:id */
router.put('/:id', async (req, res) => {
  const wardId = resolveWardScope(req);
  const { name, relation_name, age, gender, phone, address, religion, caste, sub_caste, family_id, booth_id, contact_status, notes } = req.body;
  // scheme_ids, when provided, fully replaces this voter's scheme enrollment
  // (a voter can belong to several schemes at once).
  const schemeIds = Array.isArray(req.body.scheme_ids)
    ? req.body.scheme_ids.map((id) => parseInt(id, 10)).filter(Boolean)
    : (req.body.scheme_id !== undefined ? (req.body.scheme_id ? [parseInt(req.body.scheme_id, 10)] : []) : null);

  const params = [];
  const setParts = [];
  const push = (col, val) => { params.push(val); setParts.push(`${col} = $${params.length}`); };

  if (name !== undefined) push('name', name);
  if (relation_name !== undefined) push('relation_name', relation_name);
  if (age !== undefined) push('age', age);
  if (gender !== undefined) push('gender', gender);
  if (phone !== undefined) push('phone', phone);
  if (address !== undefined) push('address', address);
  if (religion !== undefined) push('religion', religion);
  if (caste !== undefined) push('caste', caste);
  if (sub_caste !== undefined) push('sub_caste', sub_caste);
  if (family_id !== undefined) push('family_id', family_id);
  if (booth_id !== undefined) push('booth_id', booth_id);
  if (notes !== undefined) push('notes', notes);
  // Whenever contact_status moves away from 'Not Contacted', stamp
  // last_contacted_at automatically so field staff don't have to enter it
  // by hand. Moving back to 'Not Contacted' clears the timestamp.
  if (contact_status !== undefined) {
    push('contact_status', contact_status);
    push('last_contacted_at', contact_status === 'Not Contacted' ? null : new Date());
  }

  if (setParts.length === 0 && schemeIds === null) return res.status(400).json({ error: 'No fields to update' });

  let voter;
  if (setParts.length > 0) {
    params.push(req.params.id);
    let sql = `UPDATE voters SET ${setParts.join(', ')} WHERE id = $${params.length}`;
    if (wardId) {
      params.push(wardId);
      sql += ` AND ward_id = $${params.length}`;
    }
    sql += ' RETURNING *';
    const { rows } = await query(sql, params);
    if (rows.length === 0) return res.status(404).json({ error: 'Voter not found in your ward' });
    voter = rows[0];
  } else {
    const wardCheck = wardId ? ' AND ward_id = $2' : '';
    const { rows } = await query(`SELECT * FROM voters WHERE id = $1${wardCheck}`, wardId ? [req.params.id, wardId] : [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Voter not found in your ward' });
    voter = rows[0];
  }

  if (schemeIds !== null) {
    await query(`DELETE FROM voter_schemes WHERE voter_id = $1`, [voter.id]);
    for (const schemeId of schemeIds) {
      await query(`INSERT INTO voter_schemes (voter_id, scheme_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [voter.id, schemeId]);
    }
  }

  await query(
    `INSERT INTO activity_log (user_id, action, entity, entity_id, ward_id) VALUES ($1,'update','voter',$2,$3)`,
    [req.user.id, voter.id, voter.ward_id]
  );
  req.app.get('io')?.to(`ward-${voter.ward_id}`).emit('voter:updated', voter);
  res.json({ ...voter, scheme_ids: schemeIds });
});

/** DELETE /api/voters/:id */
router.delete('/:id', async (req, res) => {
  const wardId = resolveWardScope(req);
  const params = [req.params.id];
  let sql = 'DELETE FROM voters WHERE id = $1';
  if (wardId) {
    params.push(wardId);
    sql += ' AND ward_id = $2';
  }
  sql += ' RETURNING id, ward_id';

  const { rows } = await query(sql, params);
  if (rows.length === 0) {
    return res.status(404).json({ error: 'Voter not found in your ward' });
  }
  await query(
    `INSERT INTO activity_log (user_id, action, entity, entity_id, ward_id) VALUES ($1,'delete','voter',$2,$3)`,
    [req.user.id, rows[0].id, rows[0].ward_id]
  );
  req.app.get('io')?.to(`ward-${rows[0].ward_id}`).emit('voter:deleted', { id: rows[0].id });
  res.json({ success: true });
});

/**
 * POST /api/voters/bulk-import
 * body: { rows: [{voter_card_id, name, relation_name, age, gender, phone, address,
 *                  religion, caste, sub_caste, ward_name, booth_name, scheme_name}, ...], ward_id? }
 * Used by the Excel import feature.
 *
 * Two modes:
 *  - ward_id provided: every row is imported into that one ward (booth_name/
 *    scheme_name resolved within it). Used by MLA users, or an admin who
 *    picked a specific ward.
 *  - ward_id omitted (admin only): each row's own `ward_name` decides which
 *    ward it belongs to. Unknown ward names are created automatically, so a
 *    single spreadsheet covering the whole constituency can be imported in
 *    one go. Booths/schemes are resolved (and created if missing) per-ward.
 */
router.post('/bulk-import', async (req, res) => {
  const rows = Array.isArray(req.body.rows) ? req.body.rows : [];
  if (rows.length === 0) return res.status(400).json({ error: 'No rows to import' });

  const fixedWardId = req.user.role === 'admin' ? (req.body.ward_id || null) : req.user.wardId;
  if (!fixedWardId && req.user.role !== 'admin') {
    return res.status(400).json({ error: 'ward_id is required' });
  }
  if (!fixedWardId && req.user.role === 'admin') {
    const missingWardName = rows.some((r) => !String(r.ward_name || '').trim());
    if (missingWardName) {
      return res.status(400).json({
        error: 'No ward selected, and some rows are missing a "Ward / Locality" value to auto-assign one.'
      });
    }
  }

  const wardCache = new Map();
  const boothCache = new Map();
  const schemeCache = new Map();

  async function resolveWardId(client, wardName) {
    const key = String(wardName).trim().toLowerCase();
    if (wardCache.has(key)) return wardCache.get(key);
    const existing = await client.query('SELECT id FROM wards WHERE LOWER(name) = $1', [key]);
    let id;
    if (existing.rows.length > 0) {
      id = existing.rows[0].id;
    } else {
      const inserted = await client.query(
        'INSERT INTO wards (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id',
        [String(wardName).trim()]
      );
      id = inserted.rows[0].id;
    }
    wardCache.set(key, id);
    return id;
  }

  async function resolveBoothId(client, wardId, boothName) {
    if (!boothName) return null;
    const key = `${wardId}:${String(boothName).trim().toLowerCase()}`;
    if (boothCache.has(key)) return boothCache.get(key);
    const existing = await client.query(
      'SELECT id FROM booths WHERE ward_id = $1 AND LOWER(name) = $2',
      [wardId, String(boothName).trim().toLowerCase()]
    );
    let id;
    if (existing.rows.length > 0) {
      id = existing.rows[0].id;
    } else {
      const inserted = await client.query(
        'INSERT INTO booths (name, ward_id) VALUES ($1, $2) RETURNING id',
        [String(boothName).trim(), wardId]
      );
      id = inserted.rows[0].id;
    }
    boothCache.set(key, id);
    return id;
  }

  /**
   * A voter can be enrolled in several schemes at once, so the "Scheme" /
   * "Schemes Enrolled" cell in the spreadsheet may list more than one name
   * separated by a comma or semicolon (e.g. "PM-KISAN, Ujjwala Yojana").
   * Every name listed is resolved (creating the scheme if it's new) and
   * returned as an array of scheme IDs.
   */
  async function resolveSchemeIds(client, wardId, schemeNameCell) {
    if (!schemeNameCell) return [];
    const names = String(schemeNameCell).split(/[,;]/).map((n) => n.trim()).filter(Boolean);
    const ids = [];
    for (const name of names) {
      const key = `${wardId}:${name.toLowerCase()}`;
      let id = schemeCache.get(key);
      if (id === undefined) {
        const existing = await client.query(
          'SELECT id FROM schemes WHERE ward_id = $1 AND LOWER(name) = $2',
          [wardId, name.toLowerCase()]
        );
        if (existing.rows.length > 0) {
          id = existing.rows[0].id;
        } else {
          const inserted = await client.query(
            'INSERT INTO schemes (name, category, ward_id) VALUES ($1, $2, $3) RETURNING id',
            [name, 'Imported', wardId]
          );
          id = inserted.rows[0].id;
        }
        schemeCache.set(key, id);
      }
      ids.push(id);
    }
    return ids;
  }

  const client = await pool.connect();
  const imported = [];
  const updated = [];
  const skipped = [];
  const touchedWardIds = new Set();

  try {
    await client.query('BEGIN');
    for (const r of rows) {
      if (!r.voter_card_id || !r.name || !r.age) {
        skipped.push({ row: r, reason: 'Missing required field(s)' });
        continue;
      }
      try {
        const wardId = fixedWardId || (await resolveWardId(client, r.ward_name));
        const boothId = await resolveBoothId(client, wardId, r.booth_name);
        const schemeIds = await resolveSchemeIds(client, wardId, r.scheme_name);
        const familyId = r.family_id || deriveFamilyId(r.phone, r.address);
        touchedWardIds.add(wardId);

        // Matched against the candidate key (voter_card_id, scoped to the
        // ward): re-uploading the same person's row updates their record
        // instead of being rejected as a duplicate, so a refreshed
        // pre-poll spreadsheet can be dropped in repeatedly as data changes.
        const { rows: upserted } = await client.query(
          `INSERT INTO voters (voter_card_id, name, relation_name, age, gender, phone, address, religion, caste, sub_caste, family_id, ward_id, booth_id, created_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
           ON CONFLICT (ward_id, voter_card_id) DO UPDATE SET
             name = EXCLUDED.name,
             relation_name = EXCLUDED.relation_name,
             age = EXCLUDED.age,
             gender = EXCLUDED.gender,
             phone = EXCLUDED.phone,
             address = EXCLUDED.address,
             religion = EXCLUDED.religion,
             caste = EXCLUDED.caste,
             sub_caste = EXCLUDED.sub_caste,
             family_id = EXCLUDED.family_id,
             booth_id = EXCLUDED.booth_id,
             updated_at = now()
           RETURNING *, (xmax = 0) AS is_new`,
          [
            r.voter_card_id, r.name, r.relation_name || null, parseInt(r.age, 10), r.gender || 'Male',
            r.phone || null, r.address || null, r.religion || null, r.caste || null, r.sub_caste || null,
            familyId, wardId, boothId, req.user.id
          ]
        );
        const voter = upserted[0];
        // Scheme enrollment from a re-uploaded sheet is additive: it adds any
        // newly-listed schemes without dropping enrollments the voter already
        // had that simply weren't repeated in this particular sheet.
        for (const schemeId of schemeIds) {
          await client.query(`INSERT INTO voter_schemes (voter_id, scheme_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [voter.id, schemeId]);
        }
        if (voter.is_new) imported.push(voter); else updated.push(voter);
      } catch (err) {
        skipped.push({ row: r, reason: err.message || 'Insert failed' });
      }
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    return res.status(500).json({ error: 'Bulk import failed' });
  } finally {
    client.release();
  }

  for (const wardId of touchedWardIds) {
    req.app.get('io')?.to(`ward-${wardId}`).emit('voters:bulk-imported', { count: imported.length + updated.length });
  }
  res.json({
    importedCount: imported.length,
    updatedCount: updated.length,
    skippedCount: skipped.length,
    skipped
  });
});

export default router;
