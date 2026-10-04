import { Router } from 'express';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { query } from '../db.js';
import { createOtp, verifyOtp, assertResendAllowed } from '../utils/otp.js';
import { sendOtpSms } from '../utils/sms.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// Basic brute-force protection on OTP endpoints
const otpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many OTP requests from this device. Please try again later.' }
});

function normalizePhone(raw) {
  if (!raw) return null;
  const trimmed = String(raw).trim();
  // Expect E.164-ish input; require it to start with a digit or '+'
  if (!/^\+?[0-9]{10,15}$/.test(trimmed)) return null;
  return trimmed.startsWith('+') ? trimmed : `+91${trimmed}`; // default country code
}

/**
 * POST /api/auth/request-otp
 * body: { phone }
 * Looks up a registered, active user by phone, then sends an OTP.
 * Does not reveal whether a phone is registered in the response wording,
 * to avoid leaking which numbers have accounts.
 */
router.post('/request-otp', otpLimiter, async (req, res) => {
  const phone = normalizePhone(req.body.phone);
  if (!phone) {
    return res.status(400).json({ error: 'Enter a valid phone number.' });
  }

  try {
    const { rows } = await query(
      'SELECT id, is_active FROM users WHERE phone = $1',
      [phone]
    );

    if (rows.length === 0 || !rows[0].is_active) {
      // Generic response — don't confirm/deny account existence
      return res.status(200).json({
        message: 'If this number is registered, an OTP has been sent.'
      });
    }

    await assertResendAllowed(phone);
    const code = await createOtp(phone);
    const result = await sendOtpSms(phone, code);

    return res.status(200).json({
      message: 'If this number is registered, an OTP has been sent.',
      // dev_otp is ONLY present when Twilio isn't configured (local dev)
      ...(result.delivered ? {} : { dev_otp: result.devCode })
    });
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message || 'Failed to send OTP' });
  }
});

/**
 * POST /api/auth/verify-otp
 * body: { phone, code }
 * On success, issues a JWT carrying role + wardId for data isolation.
 */
router.post('/verify-otp', otpLimiter, async (req, res) => {
  const phone = normalizePhone(req.body.phone);
  const code = String(req.body.code || '').trim();

  if (!phone || !code) {
    return res.status(400).json({ error: 'Phone and OTP code are required.' });
  }

  try {
    const result = await verifyOtp(phone, code);
    if (!result.valid) {
      return res.status(401).json({ error: result.reason });
    }

    const { rows } = await query(
      `SELECT u.id, u.name, u.phone, u.role, u.ward_id, w.name AS ward_name
       FROM users u LEFT JOIN wards w ON w.id = u.ward_id
       WHERE u.phone = $1 AND u.is_active = true`,
      [phone]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Account not found or inactive.' });
    }

    const user = rows[0];
    const token = jwt.sign(
      { id: user.id, phone: user.phone, role: user.role, wardId: user.ward_id, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '12h' }
    );

    await query(
      `INSERT INTO activity_log (user_id, action, entity, ward_id, details)
       VALUES ($1, 'login', 'auth', $2, $3)`,
      [user.id, user.ward_id, JSON.stringify({ phone: user.phone })]
    );

    return res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        role: user.role,
        wardId: user.ward_id,
        wardName: user.ward_name
      }
    });
  } catch (err) {
    return res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

/** GET /api/auth/me — returns the current session's user, for app boot/refresh */
router.get('/me', requireAuth, async (req, res) => {
  const { rows } = await query(
    `SELECT u.id, u.name, u.phone, u.role, u.ward_id, w.name AS ward_name
     FROM users u LEFT JOIN wards w ON w.id = u.ward_id WHERE u.id = $1`,
    [req.user.id]
  );
  if (rows.length === 0) return res.status(404).json({ error: 'User not found' });
  const user = rows[0];
  res.json({
    id: user.id, name: user.name, phone: user.phone, role: user.role,
    wardId: user.ward_id, wardName: user.ward_name
  });
});

export default router;
