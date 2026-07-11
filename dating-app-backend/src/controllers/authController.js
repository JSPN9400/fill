const pool = require('../config/db');
const otpService = require('../services/otpService');
const googleAuthService = require('../services/googleAuthService');
const faceService = require('../services/faceVerificationService');
const kycService = require('../services/kycService');
const { issueRegToken, verifyRegToken } = require('../services/regTokenService');
const refreshTokenService = require('../services/refreshTokenService');
const jwt = require('jsonwebtoken');

// Helper to generate access token
function generateAccessToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '15m' });
}

// ---------- STEP 1: Phone number ----------

async function sendOtp(req, res) {
  const { phone_number } = req.body;
  if (!phone_number) return res.status(400).json({ error: 'phone_number is required' });

  const existing = await pool.query('SELECT id FROM users WHERE phone_number = $1', [phone_number]);
  if (existing.rows.length > 0) {
    return res.status(409).json({ error: 'An account already exists with this phone number. Please log in instead.' });
  }

  await otpService.sendOtp(phone_number);
  res.json({ message: 'OTP sent' });
}

async function verifyOtp(req, res) {
  const { phone_number, code } = req.body;
  if (!phone_number || !code) return res.status(400).json({ error: 'phone_number and code are required' });

  const approved = await otpService.checkOtp(phone_number, code);
  if (!approved) return res.status(400).json({ error: 'Invalid or expired OTP' });

  const regToken = issueRegToken({ phone_number, phone_verified: true, step: 'phone' });
  res.json({ reg_token: regToken, next_step: 'google_login' });
}

// ---------- STEP 2: Gmail login ----------

async function googleLogin(req, res) {
  const { reg_token, google_id_token } = req.body;
  const progress = verifyRegToken(reg_token);
  if (!progress || !progress.phone_verified) {
    return res.status(401).json({ error: 'Please verify your phone number first.' });
  }

  const { googleId, email, emailVerified } = await googleAuthService.verifyGoogleToken(google_id_token);
  if (!emailVerified) return res.status(400).json({ error: 'Gmail account is not verified' });

  const existing = await pool.query(
    'SELECT id FROM users WHERE google_id = $1 OR email = $2',
    [googleId, email]
  );
  if (existing.rows.length > 0) {
    return res.status(409).json({ error: 'This Gmail account is already linked to another profile.' });
  }

  const regToken = issueRegToken({
    ...progress,
    google_id: googleId,
    email,
    google_verified: true,
    step: 'google',
  });
  res.json({ reg_token: regToken, next_step: 'face_scan' });
}

// ---------- STEP 3: Face scan (one face = one account) ----------

async function faceScan(req, res) {
  const { reg_token } = req.body;
  const progress = verifyRegToken(reg_token);
  if (!progress || !progress.google_verified) {
    return res.status(401).json({ error: 'Please complete Gmail login first.' });
  }
  if (!req.file) return res.status(400).json({ error: 'Face image is required' });

  const imageBytes = req.file.buffer;

  const quality = await faceService.checkFaceQuality(imageBytes);
  if (!quality.ok) return res.status(400).json({ error: quality.reason });

  const dup = await faceService.findDuplicateFace(imageBytes);
  if (dup.isDuplicate) {
    return res.status(409).json({
      error: 'This face is already linked to an existing account. Each person can only have one account.',
    });
  }

  const faceId = await faceService.indexNewFace(imageBytes, progress.phone_number);

  const regToken = issueRegToken({
    ...progress,
    face_id: faceId,
    face_verified: true,
    step: 'face',
  });
  res.json({ reg_token: regToken, next_step: 'id_verify' });
}

// ---------- STEP 4: Government ID verification (KYC) ----------

async function idVerify(req, res) {
  const { reg_token, id_document } = req.body;
  const progress = verifyRegToken(reg_token);
  if (!progress || !progress.face_verified) {
    return res.status(401).json({ error: 'Please complete face verification first.' });
  }
  if (!id_document) return res.status(400).json({ error: 'id_document is required' });

  const kycResult = await kycService.verifyIdDocument(id_document);
  if (kycResult.status === 'rejected') {
    return res.status(400).json({ error: 'ID verification failed. Please check your document and try again.' });
  }

  const regToken = issueRegToken({
    ...progress,
    kyc_reference_id: kycResult.referenceId,
    kyc_status: kycResult.status,
    id_verified: true,
    step: 'id',
  });
  res.json({ reg_token: regToken, next_step: 'profile', kyc_status: kycResult.status });
}

// ---------- STEP 5: Basic profile -> create account ----------

async function completeProfile(req, res) {
  const { reg_token, name, dob, gender, interested_in, nationality, state, city, area, interests, photo_base64, profession } = req.body;
  const progress = verifyRegToken(reg_token);
  if (!progress || !progress.id_verified) {
    return res.status(401).json({ error: 'Please complete ID verification first.' });
  }
  if (!name || !dob || !gender || !interested_in) {
    return res.status(400).json({ error: 'name, dob, gender, and interested_in are required' });
  }

  const insertResult = await pool.query(
    `INSERT INTO users
       (phone_number, email, google_id, face_id, kyc_status, kyc_reference_id,
        display_name, birth_date, gender, interested_in, nationality, state, city, area, interests, profession, is_verified, verified_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16, TRUE, CURRENT_TIMESTAMP)
     RETURNING id`,
    [
      progress.phone_number,
      progress.email,
      progress.google_id,
      progress.face_id,
      progress.kyc_status,
      progress.kyc_reference_id,
      name,
      dob,
      gender,
      interested_in,
      nationality,
      state,
      city,
      area,
      Array.isArray(interests) ? interests : [],
      profession || null,
    ]
  );

  const userId = insertResult.rows[0].id;

  if (photo_base64) {
    await pool.query(
      'INSERT INTO user_media (user_id, media_url, display_order) VALUES ($1, $2, 0)',
      [userId, photo_base64]
    );
  }

  const accessToken = generateAccessToken(userId);
  const refreshToken = refreshTokenService.generateToken();
  await refreshTokenService.saveRefreshToken(userId, refreshToken, req.headers['user-agent']);

  res.status(201).json({ 
    message: 'Account created', 
    user_id: userId, 
    session_token: accessToken,
    refresh_token: refreshToken
  });
}

// ---------- LOGIN (existing users) ----------

async function loginWithGoogle(req, res) {
  const { google_id_token } = req.body;
  if (!google_id_token) return res.status(400).json({ error: 'google_id_token is required' });

  const { googleId, email, emailVerified } = await googleAuthService.verifyGoogleToken(google_id_token);
  if (!emailVerified) return res.status(400).json({ error: 'Gmail account is not verified' });

  const result = await pool.query(
    'SELECT id, display_name FROM users WHERE google_id = $1 OR email = $2',
    [googleId, email]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'No account found with this Gmail. Please sign up first.' });
  }

  const user = result.rows[0];
  const accessToken = generateAccessToken(user.id);
  const refreshToken = refreshTokenService.generateToken();
  await refreshTokenService.saveRefreshToken(user.id, refreshToken, req.headers['user-agent']);

  res.json({ 
    message: 'Logged in', 
    user_id: user.id, 
    display_name: user.display_name, 
    session_token: accessToken,
    refresh_token: refreshToken
  });
}

// ---------- PHONE LOGIN FOR EXISTING USERS ----------

async function loginWithPhoneSendOtp(req, res) {
  const { phone_number } = req.body;
  if (!phone_number) return res.status(400).json({ error: 'phone_number is required' });

  const existing = await pool.query('SELECT id FROM users WHERE phone_number = $1', [phone_number]);
  if (existing.rows.length === 0) {
    return res.status(404).json({ error: 'No account found with this phone number. Please sign up first.' });
  }

  await otpService.sendOtp(phone_number);
  res.json({ message: 'OTP sent' });
}

async function loginWithPhoneVerifyOtp(req, res) {
  const { phone_number, code } = req.body;
  if (!phone_number || !code) return res.status(400).json({ error: 'phone_number and code are required' });

  const approved = await otpService.checkOtp(phone_number, code);
  if (!approved) return res.status(400).json({ error: 'Invalid or expired OTP' });

  const result = await pool.query('SELECT id, display_name FROM users WHERE phone_number = $1', [phone_number]);
  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'User not found' });
  }

  const user = result.rows[0];
  const accessToken = generateAccessToken(user.id);
  const refreshToken = refreshTokenService.generateToken();
  await refreshTokenService.saveRefreshToken(user.id, refreshToken, req.headers['user-agent']);

  res.json({ 
    message: 'Logged in', 
    user_id: user.id, 
    display_name: user.display_name, 
    session_token: accessToken,
    refresh_token: refreshToken
  });
}

// ---------- REFRESH TOKEN ----------

async function refreshToken(req, res) {
  const { refresh_token } = req.body;
  if (!refresh_token) return res.status(400).json({ error: 'refresh_token is required' });

  const userId = await refreshTokenService.verifyRefreshToken(refresh_token);
  if (!userId) {
    return res.status(401).json({ error: 'Invalid or expired refresh token' });
  }

  // Generate new token pair (refresh token rotation)
  const newAccessToken = generateAccessToken(userId);
  const newRefreshToken = refreshTokenService.generateToken();
  
  // Revoke old token and save new token
  await refreshTokenService.revokeRefreshToken(refresh_token);
  await refreshTokenService.saveRefreshToken(userId, newRefreshToken, req.headers['user-agent']);

  res.json({
    session_token: newAccessToken,
    refresh_token: newRefreshToken
  });
}

// ---------- LOGOUT ----------

async function logout(req, res) {
  const { refresh_token } = req.body;
  if (!refresh_token) return res.status(400).json({ error: 'refresh_token is required' });

  await refreshTokenService.revokeRefreshToken(refresh_token);
  res.json({ message: 'Logged out successfully' });
}

module.exports = { 
  sendOtp, 
  verifyOtp, 
  googleLogin, 
  faceScan, 
  idVerify, 
  completeProfile, 
  loginWithGoogle,
  loginWithPhoneSendOtp,
  loginWithPhoneVerifyOtp,
  refreshToken,
  logout
};
