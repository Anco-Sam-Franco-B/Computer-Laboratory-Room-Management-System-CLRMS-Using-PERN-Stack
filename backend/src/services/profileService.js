const bcrypt = require('bcryptjs');
const { query } = require('../config/db');
const AppError = require('../utils/AppError');
const { audit } = require('../utils/auditHelper');
const { publicUser } = require('../services/authService');

async function updateProfile(userId, data, actor) {
  const fields = [];
  const params = [];
  let ps = 1;
  const map = { firstName: 'first_name', lastName: 'last_name', phone: 'phone', avatarUrl: 'avatar_url' };
  for (const [key, col] of Object.entries(map)) {
    if (data[key] !== undefined) {
      fields.push(`${col} = $${ps++}`);
      params.push(data[key]);
    }
  }
  if (fields.length) {
    params.push(userId);
    await query(`UPDATE users SET ${fields.join(', ')}, updated_at=now() WHERE id=$${ps}`, params);
  }
  const res = await query(
    `SELECT u.*, r.code AS role_code, r.name AS role_name FROM users u JOIN roles r ON r.id=u.role_id WHERE u.id=$1`,
    [userId]
  );
  await audit({
    actorId: actor?.id, actorEmail: actor?.email, category: 'administrative',
    action: 'profile.updated', entityType: 'user', entityId: userId,
  });
  return res.rows[0];
}

async function changePassword(userId, { currentPassword, newPassword }, actor) {
  const res = await query('SELECT * FROM users WHERE id=$1', [userId]);
  if (res.rowCount === 0) throw new AppError('User not found.', 404);
  const ok = await bcrypt.compare(currentPassword, res.rows[0].password_hash);
  if (!ok) throw new AppError('Current password is incorrect.', 400);

  const hash = await bcrypt.hash(newPassword, parseInt(process.env.BCRYPT_ROUNDS, 10) || 12);
  await query(
    `UPDATE users SET password_hash=$1, updated_at=now() WHERE id=$2`,
    [hash, userId]
  );
  await query(`UPDATE refresh_tokens SET revoked_at=now() WHERE user_id=$1 AND revoked_at IS NULL`, [userId]);
  await audit({
    actorId: actor?.id, actorEmail: actor?.email, category: 'auth',
    action: 'password.changed', entityType: 'user', entityId: userId,
  });
  return publicUser(res.rows[0]);
}

module.exports = { updateProfile, changePassword };