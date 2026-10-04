import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth, requireAdmin, resolveWardScope } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  const wardId = resolveWardScope(req);
  const params = [];
  // A voter can be enrolled in multiple schemes, so "enrolled" is counted
  // through the voter_schemes join table (distinct voters), not a single
  // scheme_id column on voters.
  let sql = `SELECT s.*, COUNT(DISTINCT vs.voter_id)::int AS enrolled_count
             FROM schemes s LEFT JOIN voter_schemes vs ON vs.scheme_id = s.id`;
  if (wardId) {
    params.push(wardId);
    sql += ` WHERE s.ward_id = $1`;
  }
  sql += ` GROUP BY s.id ORDER BY s.category, s.name`;
  const { rows } = await query(sql, params);
  res.json(rows);
});

/**
 * GET /api/schemes/:id/voters
 * Lists every voter enrolled in this scheme, along with the full set of
 * OTHER schemes each of them is also enrolled in — since one person is
 * often part of several schemes at once.
 */
router.get('/:id/voters', async (req, res) => {
  const wardId = resolveWardScope(req);
  const schemeId = parseInt(req.params.id, 10);
  const params = [schemeId];
  let wardClause = '';
  if (wardId) {
    params.push(wardId);
    wardClause = ` AND v.ward_id = $${params.length}`;
  }
  const { rows } = await query(
    `SELECT v.id, v.voter_card_id, v.name, v.relation_name, v.age, v.gender, v.phone, v.address,
            v.religion, v.caste, v.sub_caste, v.booth_id, v.family_id, v.ward_id,
            b.name AS booth_name,
            COALESCE(
              (SELECT json_agg(json_build_object('id', s2.id, 'name', s2.name) ORDER BY s2.name)
               FROM voter_schemes vs2 JOIN schemes s2 ON s2.id = vs2.scheme_id WHERE vs2.voter_id = v.id),
              '[]'
            ) AS schemes
     FROM voters v
     JOIN voter_schemes vs ON vs.voter_id = v.id AND vs.scheme_id = $1
     LEFT JOIN booths b ON b.id = v.booth_id
     WHERE true ${wardClause}
     ORDER BY v.name`,
    params
  );
  res.json(rows);
});

// Creating, editing and deleting schemes is an admin-only action; MLA staff
// can still view schemes (and enrol voters into them) but not manage the
// scheme list itself.
router.post('/', requireAdmin, async (req, res) => {
  const wardId = req.user.role === 'admin' ? req.body.ward_id : req.user.wardId;
  const { name, category } = req.body;
  if (!name || !category || !wardId) {
    return res.status(400).json({ error: 'name, category and ward_id are required' });
  }
  const { rows } = await query(
    `INSERT INTO schemes (name, category, ward_id) VALUES ($1,$2,$3) RETURNING *`,
    [name, category, wardId]
  );
  res.status(201).json(rows[0]);
});

router.delete('/:id', requireAdmin, async (req, res) => {
  const wardId = resolveWardScope(req);
  const params = [req.params.id];
  let sql = 'DELETE FROM schemes WHERE id = $1';
  if (wardId) { params.push(wardId); sql += ' AND ward_id = $2'; }
  const { rowCount } = await query(sql, params);
  if (rowCount === 0) return res.status(404).json({ error: 'Scheme not found in your ward' });
  res.json({ success: true });
});

// Edit a scheme's name / category (admin, or the MLA of that ward).
router.put('/:id', async (req, res) => {
  const wardId = resolveWardScope(req);
  const { name, category } = req.body;
  if (!name?.trim() || !category?.trim()) return res.status(400).json({ error: 'Name and category required' });
  const params = [name.trim(), category.trim(), req.params.id];
  let sql = 'UPDATE schemes SET name = $1, category = $2 WHERE id = $3';
  if (wardId) { params.push(wardId); sql += ' AND ward_id = $4'; }
  const { rows } = await query(sql + ' RETURNING *', params);
  if (!rows.length) return res.status(404).json({ error: 'Scheme not found' });
  res.json(rows[0]);
});

async function loadScheme(req) {
  const wardId = resolveWardScope(req);
  const params = [req.params.id];
  let sql = 'SELECT id, ward_id FROM schemes WHERE id = $1';
  if (wardId) { params.push(wardId); sql += ' AND ward_id = $2'; }
  const { rows } = await query(sql, params);
  return rows[0];
}

// Enrol many voters into a scheme at once: body { voter_ids: [] }
router.post('/:id/voters', async (req, res) => {
  const scheme = await loadScheme(req);
  if (!scheme) return res.status(404).json({ error: 'Scheme not found' });
  const ids = (req.body.voter_ids || []).map((n) => parseInt(n, 10)).filter(Boolean);
  if (!ids.length) return res.status(400).json({ error: 'No voters selected' });
  const { rowCount } = await query(
    `INSERT INTO voter_schemes (voter_id, scheme_id)
     SELECT id, $1 FROM voters WHERE id = ANY($2::int[]) AND ward_id = $3
     ON CONFLICT DO NOTHING`,
    [scheme.id, ids, scheme.ward_id]
  );
  req.app.get('io')?.to(`ward-${scheme.ward_id}`).emit('voter:updated');
  res.json({ enrolled: rowCount });
});

// Remove one voter from a scheme
router.delete('/:id/voters/:voterId', async (req, res) => {
  const scheme = await loadScheme(req);
  if (!scheme) return res.status(404).json({ error: 'Scheme not found' });
  await query('DELETE FROM voter_schemes WHERE scheme_id = $1 AND voter_id = $2', [scheme.id, req.params.voterId]);
  req.app.get('io')?.to(`ward-${scheme.ward_id}`).emit('voter:updated');
  res.json({ success: true });
});

export default router;
