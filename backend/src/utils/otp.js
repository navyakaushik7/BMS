import bcrypt from 'bcryptjs';
import { query } from '../db.js';

const OTP_LENGTH = parseInt(process.env.OTP_LENGTH || '6', 10);
const OTP_EXPIRY_MINUTES = parseInt(process.env.OTP_EXPIRY_MINUTES || '5', 10);
const OTP_MAX_ATTEMPTS = parseInt(process.env.OTP_MAX_ATTEMPTS || '5', 10);
const RESEND_COOLDOWN_SECONDS = parseInt(process.env.OTP_RESEND_COOLDOWN_SECONDS || '30', 10);

function generateNumericCode(length) {
  const min = 10 ** (length - 1);
  const max = 10 ** length - 1;
  return String(Math.floor(min + Math.random() * (max - min + 1)));
}

/** Throws if the phone requested an OTP too recently (rate limiting). */
export async function assertResendAllowed(phone) {
  const { rows } = await query(
    `SELECT created_at FROM otp_codes WHERE phone = $1 ORDER BY created_at DESC LIMIT 1`,
    [phone]
  );
  if (rows.length === 0) return;
  const last = new Date(rows[0].created_at).getTime();
  const secondsSince = (Date.now() - last) / 1000;
  if (secondsSince < RESEND_COOLDOWN_SECONDS) {
    const wait = Math.ceil(RESEND_COOLDOWN_SECONDS - secondsSince);
    const err = new Error(`Please wait ${wait}s before requesting another OTP`);
    err.status = 429;
    throw err;
  }
}

export async function createOtp(phone) {
  const code = generateNumericCode(OTP_LENGTH);
  const codeHash = await bcrypt.hash(code, 10);
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  await query(
    `INSERT INTO otp_codes (phone, code_hash, expires_at) VALUES ($1, $2, $3)`,
    [phone, codeHash, expiresAt]
  );

  return code;
}

/** Verifies a submitted code against the most recent unconsumed OTP for a phone. */
export async function verifyOtp(phone, submittedCode) {
  const { rows } = await query(
    `SELECT * FROM otp_codes
     WHERE phone = $1 AND consumed = false
     ORDER BY created_at DESC LIMIT 1`,
    [phone]
  );

  if (rows.length === 0) {
    return { valid: false, reason: 'No OTP requested for this number. Please request a new code.' };
  }

  const otpRow = rows[0];

  if (new Date(otpRow.expires_at).getTime() < Date.now()) {
    return { valid: false, reason: 'OTP has expired. Please request a new code.' };
  }

  if (otpRow.attempts >= OTP_MAX_ATTEMPTS) {
    return { valid: false, reason: 'Too many incorrect attempts. Please request a new code.' };
  }

  const matches = await bcrypt.compare(submittedCode, otpRow.code_hash);

  if (!matches) {
    await query(`UPDATE otp_codes SET attempts = attempts + 1 WHERE id = $1`, [otpRow.id]);
    return { valid: false, reason: 'Incorrect OTP.' };
  }

  await query(`UPDATE otp_codes SET consumed = true WHERE id = $1`, [otpRow.id]);
  return { valid: true };
}
