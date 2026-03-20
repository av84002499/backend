// controllers/authController.js
const bcrypt           = require('bcryptjs');
const crypto           = require('crypto');
const User             = require('../models/User');
const OTP              = require('../models/OTP');
const generateToken    = require('../utils/generateToken');
const { sendOTPEmail, sendPasswordResetEmail, EMAIL_ENABLED } = require('../utils/mailer');

// ── helpers ─────────────────────────────────────────────────────────────────
const generate6DigitOTP = () => String(Math.floor(100000 + Math.random() * 900000));
const OTP_EXPIRE_MS     = () => (parseInt(process.env.OTP_EXPIRE_MINUTES) || 10) * 60 * 1000;

const createOTPRecord = async (email, type, plainOTP, pendingUser = null) => {
  await OTP.deleteMany({ email, type });
  const hashed = await bcrypt.hash(plainOTP, 10);
  return OTP.create({
    email, otp: hashed, type, attempts: 0,
    expiresAt: new Date(Date.now() + OTP_EXPIRE_MS()),
    ...(pendingUser ? { pendingUser } : {}),
  });
};

// ── SIGNUP — Step 1: send OTP ────────────────────────────────────────────────
// @route POST /api/auth/send-otp
exports.sendSignupOTP = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ success: false, message: 'Name, email and password are required' });

    const existing = await User.findOne({ email });
    if (existing)
      return res.status(400).json({ success: false, message: 'This email is already registered. Please sign in.' });

    const otp = generate6DigitOTP();
    await createOTPRecord(email, 'signup', otp, { name, password, role: 'tester' });
    await sendOTPEmail(email, otp, 'signup');

    // If email not configured, return OTP in response so user can still test
    res.json({
      success: true,
      message: EMAIL_ENABLED
        ? `Verification code sent to ${email}`
        : `Email not configured — use this OTP to continue: ${otp}`,
      ...(!EMAIL_ENABLED && { devOtp: otp }),
    });
  } catch (err) {
    console.error('sendSignupOTP error:', err);
    res.status(500).json({ success: false, message: 'Failed to send OTP. Please try again.' });
  }
};

// ── SIGNUP — Step 2: verify OTP and create account ───────────────────────────
// @route POST /api/auth/verify-signup
exports.verifySignupOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp)
      return res.status(400).json({ success: false, message: 'Email and OTP are required' });

    const record = await OTP.findOne({ email, type: 'signup' });
    if (!record)
      return res.status(400).json({ success: false, message: 'OTP expired or not found. Please request a new code.' });

    if (record.attempts >= 5) {
      await OTP.deleteOne({ _id: record._id });
      return res.status(400).json({ success: false, message: 'Too many wrong attempts. Please request a new OTP.' });
    }

    const isMatch = await bcrypt.compare(String(otp), record.otp);
    if (!isMatch) {
      record.attempts += 1;
      await record.save();
      const left = 5 - record.attempts;
      return res.status(400).json({ success: false, message: `Incorrect code. ${left} attempt${left !== 1 ? 's' : ''} remaining.` });
    }

    const { name, password, role } = record.pendingUser;
    const user = await User.create({ name, email, password, role, isEmailVerified: true });
    await OTP.deleteOne({ _id: record._id });

    const token = generateToken(user._id);
    res.status(201).json({
      success: true, token,
      user: { _id: user._id, name: user.name, email: user.email, role: user.role, isEmailVerified: true },
    });
  } catch (err) {
    console.error('verifySignupOTP error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── LOGIN — Step 1: verify password, then send OTP ───────────────────────────
// @route POST /api/auth/login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ success: false, message: 'Email and password are required' });

    const user = await User.findOne({ email }).select('+password');
    if (!user)
      return res.status(401).json({ success: false, message: 'No account found with this email address' });

    const passwordMatch = await user.matchPassword(password);
    if (!passwordMatch)
      return res.status(401).json({ success: false, message: 'Incorrect password. Please try again.' });

    if (!user.isActive)
      return res.status(401).json({ success: false, message: 'Your account has been deactivated. Contact support.' });

    const otp = generate6DigitOTP();
    await createOTPRecord(email, 'login', otp);
    await sendOTPEmail(email, otp, 'login');

    // If email not configured, return OTP in response so login still works
    res.json({
      success: true,
      requiresOTP: true,
      message: EMAIL_ENABLED
        ? `Verification code sent to ${email}`
        : `Email not configured — use this OTP to sign in: ${otp}`,
      ...(!EMAIL_ENABLED && { devOtp: otp }),
    });
  } catch (err) {
    console.error('login error:', err);
    res.status(500).json({ success: false, message: 'Login failed. Please try again.' });
  }
};

// ── LOGIN — Step 2: verify OTP and issue JWT ──────────────────────────────────
// @route POST /api/auth/verify-login
exports.verifyLoginOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp)
      return res.status(400).json({ success: false, message: 'Email and OTP are required' });

    const record = await OTP.findOne({ email, type: 'login' });
    if (!record)
      return res.status(400).json({ success: false, message: 'OTP expired. Please sign in again.' });

    if (record.attempts >= 5) {
      await OTP.deleteOne({ _id: record._id });
      return res.status(400).json({ success: false, message: 'Too many wrong attempts. Please sign in again.' });
    }

    const isMatch = await bcrypt.compare(String(otp), record.otp);
    if (!isMatch) {
      record.attempts += 1;
      await record.save();
      const left = 5 - record.attempts;
      return res.status(400).json({ success: false, message: `Incorrect code. ${left} attempt${left !== 1 ? 's' : ''} remaining.` });
    }

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    await OTP.deleteOne({ _id: record._id });
    const token = generateToken(user._id);

    res.json({
      success: true, token,
      user: { _id: user._id, name: user.name, email: user.email, role: user.role, isEmailVerified: user.isEmailVerified },
    });
  } catch (err) {
    console.error('verifyLoginOTP error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── RESEND OTP ────────────────────────────────────────────────────────────────
// @route POST /api/auth/resend-otp
exports.resendOTP = async (req, res) => {
  try {
    const { email, type } = req.body;
    if (!email || !['signup', 'login'].includes(type))
      return res.status(400).json({ success: false, message: 'Email and valid type (signup|login) are required' });

    if (type === 'login') {
      const user = await User.findOne({ email });
      if (!user) return res.status(404).json({ success: false, message: 'No account found with this email' });
    }

    const old = await OTP.findOne({ email, type });
    const pendingUser = old?.pendingUser || null;

    if (type === 'signup' && !pendingUser)
      return res.status(400).json({ success: false, message: 'No pending signup found. Please start again.' });

    const otp = generate6DigitOTP();
    await createOTPRecord(email, type, otp, pendingUser);
    await sendOTPEmail(email, otp, type);

    res.json({
      success: true,
      message: EMAIL_ENABLED ? `New code sent to ${email}` : `New OTP: ${otp}`,
      ...(!EMAIL_ENABLED && { devOtp: otp }),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── FORGOT PASSWORD ───────────────────────────────────────────────────────────
// @route POST /api/auth/forgot-password
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email)
      return res.status(400).json({ success: false, message: 'Email address is required' });

    const user = await User.findOne({ email });
    if (!user)
      return res.json({ success: true, message: 'If this email exists, a reset code has been sent.' });

    const otp = generate6DigitOTP();
    await createOTPRecord(email, 'login', otp);
    await sendPasswordResetEmail(email, otp);

    res.json({
      success: true,
      message: EMAIL_ENABLED ? `Password reset code sent to ${email}` : `OTP: ${otp}`,
      ...(!EMAIL_ENABLED && { devOtp: otp }),
    });
  } catch (err) {
    console.error('forgotPassword error:', err);
    res.status(500).json({ success: false, message: 'Failed to send reset code. Please try again.' });
  }
};

// ── RESET PASSWORD ────────────────────────────────────────────────────────────
// @route POST /api/auth/reset-password
exports.resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword)
      return res.status(400).json({ success: false, message: 'Email, OTP and new password are required' });

    if (newPassword.length < 6)
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });

    const record = await OTP.findOne({ email, type: 'login' });
    if (!record)
      return res.status(400).json({ success: false, message: 'Reset code expired. Please request a new one.' });

    if (record.attempts >= 5) {
      await OTP.deleteOne({ _id: record._id });
      return res.status(400).json({ success: false, message: 'Too many wrong attempts. Please request a new code.' });
    }

    const isMatch = await bcrypt.compare(String(otp), record.otp);
    if (!isMatch) {
      record.attempts += 1;
      await record.save();
      const left = 5 - record.attempts;
      return res.status(400).json({ success: false, message: `Incorrect code. ${left} attempt${left !== 1 ? 's' : ''} remaining.` });
    }

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    user.password = newPassword;
    await user.save();
    await OTP.deleteOne({ _id: record._id });

    res.json({ success: true, message: 'Password reset successfully. You can now sign in.' });
  } catch (err) {
    console.error('resetPassword error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── PROFILE ───────────────────────────────────────────────────────────────────
exports.getMe = async (req, res) => {
  res.json({ success: true, user: req.user });
};

exports.updateMe = async (req, res) => {
  try {
    const { name, email } = req.body;
    const user = await User.findByIdAndUpdate(req.user._id, { name, email }, { new: true, runValidators: true });
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id).select('+password');
    if (!(await user.matchPassword(currentPassword)))
      return res.status(400).json({ success: false, message: 'Current password is incorrect' });
    user.password = newPassword;
    await user.save();
    res.json({ success: true, message: 'Password updated successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
