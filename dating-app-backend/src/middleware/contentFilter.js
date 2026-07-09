// Detects attempts to share contact info / IDs so users can't bypass the app
// to scam or continue contact outside the platform. Used on chat messages,
// bio, and any other free-text field.

const PATTERNS = [
  // Indian mobile numbers, with or without spaces/dashes/+91, incl. spelled-out digit tricks
  { name: 'phone number', regex: /(?:\+?91[\s-]?)?[6-9]\d{9}\b/ },
  { name: 'phone number', regex: /\b\d{3,4}[\s-]\d{3,4}[\s-]\d{3,4}\b/ }, // e.g. 987 654 3210
  // Email addresses
  { name: 'email address', regex: /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i },
  // 12-digit ID-like numbers (Aadhaar pattern)
  { name: 'ID number', regex: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/ },
  // Common ways people paste a social handle / ask to move off-platform
  { name: 'social handle or external contact', regex: /\b(insta(gram)?|whatsapp|whats app|wa\.me|telegram|snapchat|fb|facebook)\s*[:@]?\s*[\w.]{2,}/i },
  { name: 'external link', regex: /\b(https?:\/\/|www\.)\S+/i },
  { name: 'handle mention', regex: /@[a-z0-9_.]{3,}/i },
];

/**
 * Scans free text for contact-sharing attempts.
 * Returns { clean: boolean, reasons: string[] }
 */
function scanText(text) {
  if (!text || typeof text !== 'string') return { clean: true, reasons: [] };

  const reasons = [];
  for (const { name, regex } of PATTERNS) {
    if (regex.test(text)) reasons.push(name);
  }
  return { clean: reasons.length === 0, reasons: [...new Set(reasons)] };
}

/**
 * Express middleware factory — checks the given body field(s) and rejects
 * the request with 400 if contact info is detected.
 * Usage: contentFilter(['message_text'])  or  contentFilter(['bio', 'occupation'])
 */
function contentFilter(fields) {
  return (req, res, next) => {
    for (const field of fields) {
      const value = req.body?.[field];
      const result = scanText(value);
      if (!result.clean) {
        return res.status(400).json({
          error: `Please don't share contact info here (detected: ${result.reasons.join(', ')}). Chat and profile fields can't include phone numbers, emails, IDs, or social handles — this keeps everyone safe.`,
        });
      }
    }
    next();
  };
}

module.exports = { scanText, contentFilter };
