// routes/authRoutes.js
const express = require('express');
const router  = express.Router();
const {
  sendSignupOTP, verifySignupOTP,
  login, verifyLoginOTP, resendOTP,
  forgotPassword, resetPassword,
  getMe, updateMe, changePassword,
} = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

// OTP Signup
router.post('/send-otp',        sendSignupOTP);
router.post('/verify-signup',   verifySignupOTP);

// OTP Login
router.post('/login',           login);
router.post('/verify-login',    verifyLoginOTP);
router.post('/resend-otp',      resendOTP);

// Forgot / Reset password
router.post('/forgot-password', forgotPassword);
router.post('/reset-password',  resetPassword);

// Protected profile
router.get('/me',               protect, getMe);
router.put('/me',               protect, updateMe);
router.put('/password',         protect, changePassword);

module.exports = router;
