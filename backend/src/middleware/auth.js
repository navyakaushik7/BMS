import jwt from 'jsonwebtoken';
import { query } from '../db.js';

/** Verifies the Bearer JWT and attaches { id, phone, role, wardId } to req.user */
export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Login required' });

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ error: 'Session expired' });
  }

  // Re-check the account on every request so an admin revoking access (or
  // changing a role/ward) takes effect immediately, not when the JWT expires.
  try {
    const { rows } = await query('SELECT is_active, role, ward_id, name FROM users WHERE id = $1', [payload.id]);
    if (!rows.length || !rows[0].is_active) {
      return res.status(401).json({ error: 'Access revoked', revoked: true });
    }
    req.user = { ...payload, role: rows[0].role, wardId: rows[0].ward_id, name: rows[0].name };
    next();
  } catch (err) {
    next(err);
  }
}

/** Restricts a route to admin accounts only (e.g. Staff & Access page). */
export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

/**
 * Ward data isolation: an MLA can only ever act on data in their own ward.
 * Admins may pass an explicit ?ward_id= to view any ward.
 * Returns the ward_id to scope the current request to, or null for
 * "no ward" (admin with no filter — caller decides whether that's allowed).
 */
export function resolveWardScope(req) {
  if (req.user.role === 'admin') {
    const requested = req.query.ward_id || req.body.ward_id;
    return requested ? parseInt(requested, 10) : null;
  }
  return req.user.wardId;
}
