const crypto = require('crypto');

/**
 * Async wrapper for express route handlers (auto forwards errors).
 */
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/** Generate a random opaque token (e.g. for email verification / reset). */
function generateTokenBytes(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}

/** SHA-256 hash a token (we only ever store the hash). */
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/** Generate a human-friendly ticket/incident number. */
function generateRef(prefix) {
  const ts = Date.now().toString(36).toUpperCase().slice(-6);
  const rand = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `${prefix}-${ts}${rand}`;
}

/** Build a deterministic case-id style identifier. */
function uuidFromParts(...parts) {
  return crypto.createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 32);
}

module.exports = { asyncHandler, generateTokenBytes, hashToken, generateRef, uuidFromParts };