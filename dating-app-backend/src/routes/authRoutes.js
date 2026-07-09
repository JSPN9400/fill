const express = require('express');
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const authController = require('../controllers/authController');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// Prevent OTP-spam / abuse on this endpoint
const otpLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 5 });

router.post('/signup/send-otp', otpLimiter, asyncHandler(authController.sendOtp));
router.post('/signup/verify-otp', asyncHandler(authController.verifyOtp));
router.post('/signup/google', asyncHandler(authController.googleLogin));
router.post('/signup/face-scan', upload.single('face_image'), asyncHandler(authController.faceScan));
router.post('/signup/id-verify', asyncHandler(authController.idVerify));
router.post('/signup/complete-profile', asyncHandler(authController.completeProfile));
router.post('/login/google', asyncHandler(authController.loginWithGoogle));

module.exports = router;
