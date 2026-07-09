require('dotenv').config();
const { OAuth2Client } = require('google-auth-library');

const MOCK_MODE = process.env.MOCK_MODE === 'true';
const client = MOCK_MODE ? null : new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

/**
 * Verifies the ID token sent by the frontend after Google Sign-In.
 * Returns { googleId, email, name, emailVerified } or throws on invalid token.
 *
 * MOCK MODE: instead of a real Google id_token, the frontend just sends a
 * plain JSON string like {"email":"test@gmail.com","name":"Test User"} so
 * you can exercise the whole flow before a real Google OAuth Client ID exists.
 */
async function verifyGoogleToken(idToken) {
  if (MOCK_MODE) {
    const fake = JSON.parse(idToken);
    return {
      googleId: `mock-${fake.email}`,
      email: fake.email,
      emailVerified: true,
      name: fake.name || 'Test User',
    };
  }

  const ticket = await client.verifyIdToken({
    idToken,
    audience: process.env.GOOGLE_CLIENT_ID,
  });
  const payload = ticket.getPayload();

  return {
    googleId: payload.sub,
    email: payload.email,
    emailVerified: payload.email_verified,
    name: payload.name,
  };
}

module.exports = { verifyGoogleToken };
