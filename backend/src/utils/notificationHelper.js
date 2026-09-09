const { query } = require('../config/db');

/**
 * Notify everyone (or specific users) via the in-app notifications table.
 * A socket event is emitted by the caller (see notifications service) if needed.
 */
async function createNotification({ user_id, type = 'info', title, message, link = null, data = {} }) {
  const res = await query(
    `INSERT INTO notifications (user_id, type, title, message, link, data)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [user_id, type, title, message, link, JSON.stringify(data)]
  );
  return res.rows[0];
}

async function createNotificationForMany({ user_ids, type, title, message, link, data }) {
  if (!user_ids || user_ids.length === 0) return [];
  const params = [];
  const values = [];
  user_ids.forEach((uid, i) => {
    const base = i * 6;
    params.push(`($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6})`);
    values.push(uid, type, title, message, link, JSON.stringify(data || {}));
  });
  const sql = `INSERT INTO notifications (user_id, type, title, message, link, data) VALUES ${params.join(',')} RETURNING *`;
  const res = await query(sql, values);
  return res.rows;
}

/** Get all users of a given role code (helper for broadcast notifications). */
async function userIdsForRole(roleCode) {
  const res = await query(
    `SELECT u.id FROM users u
     JOIN roles r ON r.id = u.role_id
     WHERE r.code = $1 AND u.status = 'active' AND u.deleted_at IS NULL`,
    [roleCode]
  );
  return res.rows.map((r) => r.id);
}

module.exports = { createNotification, createNotificationForMany, userIdsForRole };