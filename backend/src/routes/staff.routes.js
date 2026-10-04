import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth, requireAdmin);

/** Guard: never let the last active admin be revoked, demoted or deleted. */
async function isLastActiveAdmin(id) {
  const t = await query('SELECT role, is_active FROM users WHERE id = $1', [id]);
  if (!t.rows.length || t.rows[0].role !== 'admin' || !t.rows[0].is_active) return false;
  const c = await query(`SELECT COUNT(*)::int AS n FROM users WHERE role = 'admin' AND is_active = true`);
  return c.rows[0].n <= 1;
}

router.get('/', async (req, res) => {
  const { rows } = await query(
    `SELECT u.id, u.name, u.phone, u.role, u.ward_id, u.is_active, w.name AS ward_name
     FROM users u LEFT JOIN wards w ON w.id = u.ward_id
     ORDER BY u.role, u.name`
  );
  res.json(rows);
});

router.post('/', async (req, res) => {
  const { name, phone, role, ward_id } = req.body;
  if (!name || !phone || !role) return res.status(400).json({ error: 'Name, phone and role required' });
  if (role === 'mla' && !ward_id) return res.status(400).json({ error: 'Select a ward' });
  try {
    const { rows } = await query(
      'INSERT INTO users (name, phone, role, ward_id) VALUES ($1,$2,$3,$4) RETURNING *',
      [name, phone, role, role === 'admin' ? null : ward_id]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Phone already registered' });
    res.status(500).json({ error: 'Failed to create account' });
  }
});

// Edit name / phone / role / ward
router.put('/:id', async (req, res) => {
  const { name, phone, role, ward_id } = req.body;
  if (!name || !phone || !role) return res.status(400).json({ error: 'Name, phone and role required' });
  if (role === 'mla' && !ward_id) return res.status(400).json({ error: 'Select a ward' });
  if (role !== 'admin' && (await isLastActiveAdmin(req.params.id))) {
    return res.status(400).json({ error: 'Cannot demote the last active admin' });
  }
  try {
    const { rows } = await query(
      'UPDATE users SET name=$1, phone=$2, role=$3, ward_id=$4 WHERE id=$5 RETURNING *',
      [name, phone, role, role === 'admin' ? null : ward_id, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    res.json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Phone already registered' });
    res.status(500).json({ error: 'Failed to update account' });
  }
});

// Revoke: blocks new OTPs AND kills any live session on the next request
router.patch('/:id/deactivate', async (req, res) => {
  if (String(req.user.id) === String(req.params.id)) {
    return res.status(400).json({ error: 'You cannot revoke your own access' });
  }
  if (await isLastActiveAdmin(req.params.id)) {
    return res.status(400).json({ error: 'Cannot revoke the last active admin' });
  }
  const { rows } = await query('UPDATE users SET is_active = false WHERE id = $1 RETURNING id', [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'User not found' });
  await query('UPDATE otp_codes SET consumed = true WHERE phone = (SELECT phone FROM users WHERE id = $1)', [req.params.id]);
  res.json({ success: true, id: rows[0].id });
});

router.patch('/:id/reactivate', async (req, res) => {
  const { rows } = await query('UPDATE users SET is_active = true WHERE id = $1 RETURNING id', [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'User not found' });
  res.json({ success: true, id: rows[0].id });
});

router.delete('/:id', async (req, res) => {
  if (String(req.user.id) === String(req.params.id)) return res.status(400).json({ error: 'You cannot delete yourself' });
  if (await isLastActiveAdmin(req.params.id)) return res.status(400).json({ error: 'Cannot delete the last active admin' });
  const { rowCount } = await query('DELETE FROM users WHERE id = $1', [req.params.id]);
  if (!rowCount) return res.status(404).json({ error: 'User not found' });
  res.json({ success: true });
});

export default router;
