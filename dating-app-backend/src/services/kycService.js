require('dotenv').config();

/**
 * Generic KYC verification call.
 * Replace the URL/payload below with your chosen provider's actual API
 * (HyperVerge, IDfy, Signzy all follow a similar "submit doc -> get reference_id
 * -> poll/webhook for verified/rejected status" pattern).
 *
 * idDocument = { type: 'aadhaar' | 'passport' | 'driving_license', imageBase64, number? }
 */
async function verifyIdDocument(idDocument) {
  if (process.env.MOCK_MODE === 'true') {
    return { referenceId: `mock-kyc-${Date.now()}`, status: 'verified' };
  }

  const response = await fetch(`${process.env.KYC_PROVIDER_BASE_URL}/v1/verify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.KYC_PROVIDER_API_KEY}`,
    },
    body: JSON.stringify(idDocument),
  });

  if (!response.ok) {
    throw new Error(`KYC provider error: ${response.status}`);
  }

  const data = await response.json();
  // Expected shape varies by provider — normalize it here so the rest of
  // the app only ever deals with { referenceId, status }
  return {
    referenceId: data.reference_id || data.id,
    status: data.status === 'verified' ? 'verified' : data.status === 'rejected' ? 'rejected' : 'pending',
  };
}

module.exports = { verifyIdDocument };
