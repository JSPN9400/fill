const jwt = require('jsonwebtoken');
require('dotenv').config();

const REG_TOKEN_TTL = '30m'; // signup must be completed within 30 minutes

/**
 * Creates/refreshes the "registration in progress" token.
 * Each signup step adds a new verified flag to the payload,
 * so later steps can check that earlier ones were actually completed.
 */
function issueRegToken(payload) {
  // If this payload came from a previously-verified token, it will already
  // carry JWT's own `exp`/`iat` claims — strip them before re-signing,
  // otherwise jsonwebtoken throws "payload already has an exp property".
  const { exp, iat, ...cleanPayload } = payload;
  return jwt.sign(cleanPayload, process.env.JWT_SECRET, { expiresIn: REG_TOKEN_TTL });
}

function verifyRegToken(token) {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return null;
  }
}

module.exports = { issueRegToken, verifyRegToken };
