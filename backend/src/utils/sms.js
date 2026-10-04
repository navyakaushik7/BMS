import dotenv from 'dotenv';
dotenv.config();

const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER } = process.env;

const smsConfigured = Boolean(TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_FROM_NUMBER);

let twilioClient = null;
if (smsConfigured) {
  const { default: twilio } = await import('twilio');
  twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
}

/**
 * Sends the OTP SMS. If Twilio credentials are not configured (local/dev),
 * it falls back to logging the code to the server console so development
 * can continue without a paid SMS account. In production, set the
 * TWILIO_* env vars and real texts will be sent to the MLA's phone.
 *
 * Returns { delivered: boolean, devCode?: string }
 */
export async function sendOtpSms(phone, code) {
  if (!smsConfigured) {
    console.log(`\n[DEV MODE — no Twilio configured] OTP for ${phone}: ${code}\n`);
    return { delivered: false, devCode: code };
  }

  try {
    await twilioClient.messages.create({
      body: `Your Booth Management System login OTP is ${code}. It expires in ${process.env.OTP_EXPIRY_MINUTES || 5} minutes. Do not share this code.`,
      from: TWILIO_FROM_NUMBER,
      to: phone
    });
    return { delivered: true };
  } catch (err) {
    // Twilio is configured but the real send failed — most commonly because
    // this is a trial account and `phone` isn't a Verified Caller ID yet.
    // Rather than blocking login entirely during dev/testing, fall back to
    // showing the code on-screen (same as the "not configured" path).
    console.error(`Twilio send failed for ${phone}:`, err.message);
    console.log(`\n[TWILIO DELIVERY FAILED — fallback] OTP for ${phone}: ${code}\n`);
    return { delivered: false, devCode: code, twilioError: err.message };
  }
}
