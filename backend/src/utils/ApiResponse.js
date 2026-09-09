/**
 * Uniform success response envelope: { success, message, data, pagination }
 */
function ok(message, data = null, pagination = null) {
  return { success: true, message, data, pagination };
}

function created(message, data = null) {
  return { success: true, message, data };
}

module.exports = { ok, created };