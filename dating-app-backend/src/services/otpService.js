require('dotenv').config();
const twilio = require('twilio');

const MOCK_MODE = process.env.MOCK_MODE === 'true';
const client = MOCK_MODE ? null : twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const VERIFY_SERVICE_SID = process.env.TWILIO_VERIFY_SERVICE_SID;

/**
 * Sends an OTP to the given phone number.
 * phoneNumber must be in E.164 format, e.g. +919876543210
 */
async function sendOtp(phoneNumber) {
  if (MOCK_MODE) {
    console.log(`[MOCK] OTP for ${phoneNumber} is 123456`);
    return { mock: true };
  }
  return client.verify.v2
    .services(VERIFY_SERVICE_SID)
    .verifications.create({ to: phoneNumber, channel: 'sms' });
}

/**
 * Checks the OTP code the user entered.
 * Returns true if approved, false otherwise.
 */
async function checkOtp(phoneNumber, code) {
  if (MOCK_MODE) {
    return code === '123456'; // fixed test code while no real SMS provider is connected
  }
  const result = await client.verify.v2
    .services(VERIFY_SERVICE_SID)
    .verificationChecks.create({ to: phoneNumber, code });
  return result.status === 'approved';
}

module.exports = { sendOtp, checkOtp };
