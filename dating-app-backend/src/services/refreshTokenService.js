const crypto = require('crypto');
const pool = require('../config/db');

function generateToken() {
  return crypto.randomBytes(40).toString('hex');
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

async function saveRefreshToken(userId, token, deviceInfo) {
  const tokenHash = hashToken(token);
  // Set expiry to 30 days
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  
  await pool.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, device_info, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [userId, tokenHash, deviceInfo || null, expiresAt]
  );
}

async function verifyRefreshToken(token) {
  const tokenHash = hashToken(token);
  
  const result = await pool.query(
    `SELECT user_id, expires_at FROM refresh_tokens 
     WHERE token_hash = $1`,
    [tokenHash]
  );
  
  if (result.rows.length === 0) {
    return null;
  }
  
  const { user_id, expires_at } = result.rows[0];
  
  // Check if expired
  if (new Date() > new Date(expires_at)) {
    // Delete expired token
    await revokeRefreshToken(token);
    return null;
  }
  
  return user_id;
}

async function revokeRefreshToken(token) {
  const tokenHash = hashToken(token);
  await pool.query('DELETE FROM refresh_tokens WHERE token_hash = $1', [tokenHash]);
}

async function revokeAllUserTokens(userId) {
  await pool.query('DELETE FROM refresh_tokens WHERE user_id = $1', [userId]);
}

module.exports = {
  generateToken,
  saveRefreshToken,
  verifyRefreshToken,
  revokeRefreshToken,
  revokeAllUserTokens
};
