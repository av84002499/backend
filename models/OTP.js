// models/OTP.js
const mongoose = require('mongoose');

/**
 * Stores OTP codes for:
 *  - 'signup'  → email verification before account is created
 *  - 'login'   → second factor after password check
 *
 * Documents auto-delete via the TTL index after `expiresAt`.
 */
const OTPSchema = new mongoose.Schema({
  email:     { type: String, required: true, lowercase: true, trim: true },
  otp:       { type: String, required: true },   // bcrypt-hashed 6-digit code
  type:      { type: String, enum: ['signup', 'login'], required: true },
  attempts:  { type: Number, default: 0 },        // wrong-guess counter (max 5)
  expiresAt: { type: Date,   required: true },

  // For signup: store the pending user data so we create the account
  // only after OTP is verified (never store plain password here — it
  // is pre-hashed by the User model pre-save hook, so we store it raw
  // and let the User.create() call hash it).
  pendingUser: {
    name:     String,
    password: String,   // plain — hashed on User.create()
    role:     String,
  },
});

// MongoDB TTL index: automatically removes doc after expiresAt
OTPSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Also index email+type for fast lookups
OTPSchema.index({ email: 1, type: 1 });

module.exports = mongoose.model('OTP', OTPSchema);
