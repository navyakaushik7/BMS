import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth, requireAdmin, resolveWardScope } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  const wardId = resolveWardScope(req);
  const params = [];
  let sql = `SELECT b.*, COUNT(v.id)::int AS voter_count
             FROM booths b LEFT JOIN voters v ON v.booth_id = b.id`;
  if (wardId) {
    params.push(wardId);
    sql += ` WHERE b.ward_id = $1`;
  }
  sql += ` GROUP BY b.id ORDER BY b.name`;
  const { rows } = await query(sql, params);
  res.json(rows);
});

// Creating and deleting booths is an admin-only action; MLA staff can still
// view booths and assign voters to them, but not manage the booth list.
router.post('/', requireAdmin, async (req, res) => {
  const wardId = req.user.role === 'admin' ? req.body.ward_id : req.user.wardId;
  const { name, address } = req.body;
  if (!name || !wardId) return res.status(400).json({ error: 'name and ward_id are required' });
  const { rows } = await query(
    `INSERT INTO booths (name, ward_id, address) VALUES ($1,$2,$3) RETURNING *`,
    [name, wardId, address || null]
  );
  res.status(201).json(rows[0]);
});

router.delete('/:id', requireAdmin, async (req, res) => {
  const wardId = resolveWardScope(req);
  const params = [req.params.id];
  let sql = 'DELETE FROM booths WHERE id = $1';
  if (wardId) { params.push(wardId); sql += ' AND ward_id = $2'; }
  const { rowCount } = await query(sql, params);
  if (rowCount === 0) return res.status(404).json({ error: 'Booth not found in your ward' });
  res.json({ success: true });
});

// Editing a booth's name/address is allowed for admins and for the MLA of that ward.
router.put('/:id', async (req, res) => {
  const wardId = resolveWardScope(req);
  const { name, address } = req.body;
  if (!name || !String(name).trim()) return res.status(400).json({ error: 'Name required' });
  const params = [String(name).trim(), address || null, req.params.id];
  let sql = 'UPDATE booths SET name = $1, address = $2 WHERE id = $3';
  if (wardId) { params.push(wardId); sql += ' AND ward_id = $4'; }
  const { rows } = await query(sql + ' RETURNING *', params);
  if (!rows.length) return res.status(404).json({ error: 'Booth not found' });
  res.json(rows[0]);
});

export default router;
