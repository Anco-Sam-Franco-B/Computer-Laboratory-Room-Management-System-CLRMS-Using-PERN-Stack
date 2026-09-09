const { query } = require('../config/db');

/**
 * Write an entry to the audit_logs table.
 * @param {object} a
 * @param {string} a.actorId    - user uuid (or null for system)
 * @param {string} a.actorEmail - cached email for quick reference (optional)
 * @param {string} a.category   - audit_category enum
 * @param {string} a.action     - human readable action
 * @param {string} a.entityType - logical entity name, e.g. 'booking'
 * @param {string} a.entityId   - row uuid
 * @param {object} a.beforeData
 * @param {object} a.afterData
 * @param {string} a.ip         - ip address
 * @param {object} a.metadata
 */
async function audit(a) {
  try {
    await query(
      `INSERT INTO audit_logs
        (actor_id, actor_email, category, action, entity_type, entity_id, before_data, after_data, ip_address, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        a.actorId || null,
        a.actorEmail || null,
        a.category,
        a.action,
        a.entityType || null,
        a.entityId || null,
        a.beforeData ? JSON.stringify(a.beforeData) : null,
        a.afterData ? JSON.stringify(a.afterData) : null,
        a.ip ? String(a.ip).split('::ffff:').pop() : null,
        JSON.stringify(a.metadata || {}),
      ]
    );
  } catch (err) {
    // Auditing must never break the primary operation.
    // eslint-disable-next-line no-console
    console.error('[audit] failed to write audit log:', err.message);
  }
}

module.exports = { audit };