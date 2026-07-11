const express = require('express');
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const authController = require('../controllers/authController');
const asyncHandler = require('../middleware/asyncHandler');
const {
  validateSendOtp,
  validateVerifyOtp,
  validateGoogleLogin,
  validateGoogleSignup,
  validateIdVerify,
  validateCompleteProfile
} = require('../middleware/validate');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// Prevent OTP-spam / abuse on this endpoint
const otpLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 5 });

// Signup routes
router.post('/signup/send-otp', otpLimiter, validateSendOtp, asyncHandler(authController.sendOtp));
router.post('/signup/verify-otp', validateVerifyOtp, asyncHandler(authController.verifyOtp));
router.post('/signup/google', validateGoogleSignup, asyncHandler(authController.googleLogin));
router.post('/signup/face-scan', upload.single('face_image'), asyncHandler(authController.faceScan)); // multipart, file check in controller
router.post('/signup/id-verify', validateIdVerify, asyncHandler(authController.idVerify));
router.post('/signup/complete-profile', validateCompleteProfile, asyncHandler(authController.completeProfile));

// Login routes
router.post('/login/google', validateGoogleLogin, asyncHandler(authController.loginWithGoogle));
router.post('/login/phone/send-otp', otpLimiter, validateSendOtp, asyncHandler(authController.loginWithPhoneSendOtp));
router.post('/login/phone/verify-otp', validateVerifyOtp, asyncHandler(authController.loginWithPhoneVerifyOtp));

// Token management routes
router.post('/refresh', asyncHandler(authController.refreshToken));
router.post('/logout', asyncHandler(authController.logout));

module.exports = router;
