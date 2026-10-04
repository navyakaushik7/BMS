import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

/** GET /api/wards — every logged-in user can see the ward list (names only) */
router.get('/', async (req, res) => {
  const { rows } = await query('SELECT id, name FROM wards ORDER BY name');
  res.json(rows);
});

/** POST /api/wards — admin only */
router.post('/', requireAdmin, async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  try {
    const { rows } = await query('INSERT INTO wards (name) VALUES ($1) RETURNING *', [name]);
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'A ward with this name already exists.' });
    res.status(500).json({ error: 'Failed to create ward' });
  }
});

export default router;
