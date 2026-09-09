const { query } = require('../config/db');
const { makePagination } = require('../utils/pagination');

async function listNotifications(userId, { page = 1, limit = 20, unreadOnly = false }) {
  const offset = (page - 1) * limit;
  const where = unreadOnly ? 'AND read_at IS NULL' : '';
  const count = await query(`SELECT count(*) FROM notifications WHERE user_id=$1 ${where}`, [userId]);
  const data = await query(
    `SELECT * FROM notifications WHERE user_id=$1 ${where} ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
    [userId, limit, offset]
  );
  return {
    rows: data.rows,
    pagination: makePagination({ page, limit }, parseInt(count.rows[0].count, 10)),
  };
}

async function unreadCount(userId) {
  const res = await query(`SELECT count(*)::int AS count FROM notifications WHERE user_id=$1 AND read_at IS NULL`, [userId]);
  return res.rows[0].count;
}

async function markRead(userId, notificationId) {
  const res = await query(
    `UPDATE notifications SET read_at=COALESCE(read_at, now()) WHERE id=$1 AND user_id=$2 RETURNING *`,
    [notificationId, userId]
  );
  return res.rowCount ? res.rows[0] : null;
}

async function markAllRead(userId) {
  const res = await query(`UPDATE notifications SET read_at=now() WHERE user_id=$1 AND read_at IS NULL RETURNING *`, [userId]);
  return res.rows;
}

module.exports = { listNotifications, unreadCount, markRead, markAllRead };