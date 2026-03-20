// utils/mailer.js
const nodemailer = require('nodemailer');

// ── Check if email is configured ─────────────────────────────────────────────
const EMAIL_ENABLED = !!(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);

let transporter = null;

if (EMAIL_ENABLED) {
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });

  transporter.verify((err) => {
    if (err) {
      console.warn('⚠️  Nodemailer not ready:', err.message);
    } else {
      console.log('📧  Nodemailer ready — Gmail OTP emails enabled');
    }
  });
} else {
  console.warn('⚠️  GMAIL_USER / GMAIL_APP_PASSWORD not set — OTP emails disabled.');
  console.warn('   OTPs will be logged to console instead.');
}

// ── Send OTP email (or log to console if email not configured) ────────────────
const sendOTPEmail = async (to, otp, type = 'signup') => {
  if (!EMAIL_ENABLED) {
    // Fallback: just log the OTP — useful for development / when email not configured
    console.log(`\n📬  OTP for ${to} [${type}]: >>>  ${otp}  <<<\n`);
    return;
  }

  const isSignup  = type === 'signup';
  const subject   = isSignup
    ? '🔐 VAPT Platform — Verify Your Email'
    : '🔑 VAPT Platform — Your Login OTP';
  const actionText = isSignup ? 'to complete your registration' : 'to sign in to your account';

  const html = `
<!DOCTYPE html><html><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f4f3ef;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f3ef;padding:40px 16px;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#fff;border:1px solid #ddd9d0;border-radius:4px;overflow:hidden;max-width:520px;width:100%;">
        <tr><td style="background:#2b2d3a;padding:0;">
          <div style="height:4px;background:#c8001e;"></div>
          <div style="padding:22px 32px;">
            <span style="font-size:22px;">🛡️</span>
            <span style="color:#fff;font-size:15px;font-weight:800;margin-left:12px;">VAPT Report Tool</span>
          </div>
        </td></tr>
        <tr><td style="padding:36px 32px 28px;">
          <h2 style="font-size:20px;font-weight:800;color:#1a1a1a;margin:0 0 10px;">
            ${isSignup ? 'Verify Your Email Address' : 'Your One-Time Password'}
          </h2>
          <p style="font-size:14px;color:#666;line-height:1.6;margin:0 0 28px;">
            Use the OTP code below ${actionText}. Valid for
            <strong>${process.env.OTP_EXPIRE_MINUTES || 10} minutes</strong>.
          </p>
          <div style="background:#f4f3ef;border:2px dashed #ddd9d0;border-radius:6px;padding:24px;text-align:center;margin-bottom:28px;">
            <div style="font-family:'Courier New',monospace;font-size:42px;font-weight:800;letter-spacing:12px;color:#c8001e;line-height:1;">${otp}</div>
            <div style="font-family:'Courier New',monospace;font-size:11px;color:#888;letter-spacing:1.5px;text-transform:uppercase;margin-top:10px;">One-Time Password</div>
          </div>
          <div style="background:#fff4f4;border-left:4px solid #c8001e;padding:14px 16px;border-radius:2px;">
            <p style="font-size:12px;color:#c8001e;margin:0;font-weight:700;">⚠️ Security Notice</p>
            <p style="font-size:12px;color:#888;margin:6px 0 0;line-height:1.5;">
              Never share this code. If you did not request this, please ignore this email.
            </p>
          </div>
        </td></tr>
        <tr><td style="background:#f4f3ef;padding:16px 32px;border-top:1px solid #ddd9d0;">
          <p style="font-size:11px;color:#aaa;margin:0;text-align:center;font-family:'Courier New',monospace;">
            VAPT REPORT TOOL — AUTOMATED EMAIL — DO NOT REPLY
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  await transporter.sendMail({
    from:    `"VAPT Report Tool" <${process.env.GMAIL_USER}>`,
    to,
    subject,
    html,
    text: `Your VAPT OTP code is: ${otp}\nValid for ${process.env.OTP_EXPIRE_MINUTES || 10} minutes.`,
  });
};

// ── Send password reset OTP email ─────────────────────────────────────────────
const sendPasswordResetEmail = async (to, otp) => {
  if (!EMAIL_ENABLED) {
    console.log(`\n📬  PASSWORD RESET OTP for ${to}: >>>  ${otp}  <<<\n`);
    return;
  }

  const html = `
<!DOCTYPE html><html><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f4f3ef;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f3ef;padding:40px 16px;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#fff;border:1px solid #ddd9d0;border-radius:4px;overflow:hidden;max-width:520px;width:100%;">
        <tr><td style="background:#2b2d3a;padding:0;">
          <div style="height:4px;background:#c8001e;"></div>
          <div style="padding:22px 32px;">
            <span style="font-size:22px;">🛡️</span>
            <span style="color:#fff;font-size:15px;font-weight:800;margin-left:12px;">VAPT Report Tool — Password Reset</span>
          </div>
        </td></tr>
        <tr><td style="padding:36px 32px 28px;">
          <h2 style="font-size:20px;font-weight:800;color:#1a1a1a;margin:0 0 10px;">Reset Your Password</h2>
          <p style="font-size:14px;color:#666;line-height:1.6;margin:0 0 28px;">
            Use this code to reset your password. Expires in
            <strong>${process.env.OTP_EXPIRE_MINUTES || 10} minutes</strong>.
          </p>
          <div style="background:#f4f3ef;border:2px dashed #ddd9d0;border-radius:6px;padding:24px;text-align:center;margin-bottom:28px;">
            <div style="font-family:'Courier New',monospace;font-size:42px;font-weight:800;letter-spacing:12px;color:#c8001e;">${otp}</div>
          </div>
          <p style="font-size:12px;color:#888;">If you did not request a password reset, ignore this email.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  await transporter.sendMail({
    from:    `"VAPT Report Tool" <${process.env.GMAIL_USER}>`,
    to,
    subject: '🔑 VAPT Platform — Password Reset Code',
    html,
    text: `Your VAPT password reset code is: ${otp}\nValid for ${process.env.OTP_EXPIRE_MINUTES || 10} minutes.`,
  });
};

module.exports = { sendOTPEmail, sendPasswordResetEmail, EMAIL_ENABLED };
