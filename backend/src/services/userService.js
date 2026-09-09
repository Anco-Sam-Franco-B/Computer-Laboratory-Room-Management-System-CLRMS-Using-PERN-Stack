const bcrypt = require('bcryptjs');
const { query, withTransaction } = require('../config/db');
const AppError = require('../utils/AppError');
const { parseQuery, makePagination } = require('../utils/pagination');
const { audit } = require('../utils/auditHelper');
const templates = require('../mailers/templates');

/** List users with filters, pagination, search. */
async function listUsers({ page, limit, offset, sort, order, where, params }) {
  const base = `
    FROM users u
    JOIN roles r ON r.id = u.role_id
    LEFT JOIN departments d ON d.id = u.department_id
    WHERE u.deleted_at IS NULL`;
  const countRes = await query(`SELECT count(*) ${base} ${where}`, params);
  const total = parseInt(countRes.rows[0].count, 10);

  const dataRes = await query(
    `SELECT u.id, u.email, u.first_name, u.last_name, u.phone, u.student_id, u.status,
            u.avatar_url, u.email_verified_at, u.last_login_at, u.department_id,
            r.code AS role_code, r.name AS role_name,
            d.name AS department_name, u.created_at
     ${base}
     ${where}
     ORDER BY ${sort} ${order}
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset]
  );

  return { rows: dataRes.rows, pagination: makePagination({ page, limit }, total) };
}

/** Get a single user by id. */
async function getUser(id) {
  const res = await query(
    `SELECT u.id, u.email, u.first_name, u.last_name, u.phone, u.student_id, u.status,
            u.avatar_url, u.email_verified_at, u.last_login_at, u.department_id,
            r.code AS role_code, r.name AS role_name, d.name AS department_name,
            u.created_at, u.updated_at
     FROM users u
     JOIN roles r ON r.id = u.role_id
     LEFT JOIN departments d ON d.id = u.department_id
     WHERE u.id = $1 AND u.deleted_at IS NULL`,
    [id]
  );
  if (res.rowCount === 0) throw new AppError('User not found.', 404);
  return res.rows[0];
}

/** Create a user (admin only). */
async function createUser(data, actor) {
  const role = await query('SELECT id FROM roles WHERE code=$1', [data.roleCode]);
  if (role.rowCount === 0) throw new AppError('Invalid role.', 400);

  const defaultPassword = data.password || 'CLRMS@Default1';
  const hash = await bcrypt.hash(defaultPassword, parseInt(process.env.BCRYPT_ROUNDS, 10) || 12);

  try {
    const res = await query(
      `INSERT INTO users (role_id, email, password_hash, first_name, last_name, phone, student_id, department_id, status, email_verified_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,
               CASE WHEN $9='active' THEN now() ELSE NULL END)
       RETURNING *`,
      [role.rows[0].id, data.email, hash, data.firstName, data.lastName, data.phone || null,
       data.studentId || null, data.departmentId || null, data.status || 'active']
    );

    // If active, consider verified so they can log in (admin created them).
    await query(`UPDATE users SET email_verified_at = CASE WHEN status='active' THEN COALESCE(email_verified_at, now()) ELSE email_verified_at END WHERE id=$1`, [res.rows[0].id]);

    if (data.sendWelcome) {
      await templates.sendWelcomeEmail(res.rows[0]).catch(() => {});
    }

    await audit({
      actorId: actor?.id, actorEmail: actor?.email, category: 'user',
      action: 'user.created', entityType: 'user', entityId: res.rows[0].id,
      afterData: { email: res.rows[0].email, roleCode: data.roleCode },
    });

    return res.rows[0];
  } catch (err) {
    if (err.code === '23505') throw new AppError('A user with that email already exists.', 409);
    throw err;
  }
}

/** Update a user (admin) or self (limited fields allowed later). */
async function updateUser(id, data, actor) {
  const existing = await query('SELECT * FROM users WHERE id=$1 AND deleted_at IS NULL', [id]);
  if (existing.rowCount === 0) throw new AppError('User not found.', 404);

  const fields = [];
  const params = [];
  let ps = 1;

  const map = {
    firstName: 'first_name',
    lastName: 'last_name',
    phone: 'phone',
    studentId: 'student_id',
    departmentId: 'department_id',
    roleCode: null,
    status: 'status',
    avatarUrl: 'avatar_url',
  };
  const roleLookup = {};
  if (data.roleCode) {
    const r = await query('SELECT id FROM roles WHERE code=$1', [data.roleCode]);
    if (r.rowCount === 0) throw new AppError('Invalid role.', 400);
    roleLookup.role_id = r.rows[0].id;
  }

  for (const [key, col] of Object.entries(map)) {
    if (data[key] !== undefined && col) {
      fields.push(`${col} = $${ps++}`);
      params.push(data[key]);
    }
  }
  for (const [col, val] of Object.entries(roleLookup)) {
    fields.push(`${col} = $${ps++}`);
    params.push(val);
  }
  if (fields.length === 0) return existing.rows[0];

  params.push(id);
  const res = await query(
    `UPDATE users SET ${fields.join(', ')}, updated_at = now() WHERE id = $${ps} RETURNING *`,
    params
  );

  await audit({
    actorId: actor?.id, actorEmail: actor?.email, category: 'user',
    action: 'user.updated', entityType: 'user', entityId: id,
    beforeData: existing.rows[0], afterData: res.rows[0],
  });
  return res.rows[0];
}

/** Change status: activate / suspend / set status. */
async function setStatus(id, status, actor) {
  const allowed = ['active', 'suspended'];
  if (!allowed.includes(status)) throw new AppError('Invalid status.', 400);
  const res = await query(
    `UPDATE users SET status=$2, locked_until=NULL, failed_attempts=0, updated_at=now() WHERE id=$1 AND deleted_at IS NULL RETURNING *`,
    [id, status]
  );
  if (res.rowCount === 0) throw new AppError('User not found.', 404);
  await audit({
    actorId: actor?.id, actorEmail: actor?.email, category: 'user',
    action: status === 'active' ? 'user.activated' : 'user.suspended',
    entityType: 'user', entityId: id, afterData: { status },
  });
  return res.rows[0];
}

/** Soft delete a user. */
async function deleteUser(id, actor) {
  const res = await query(
    `UPDATE users SET deleted_at = now(), status='suspended', updated_at=now() WHERE id=$1 AND deleted_at IS NULL RETURNING *`,
    [id]
  );
  if (res.rowCount === 0) throw new AppError('User not found.', 404);
  await audit({
    actorId: actor?.id, actorEmail: actor?.email, category: 'user',
    action: 'user.deleted', entityType: 'user', entityId: id,
  });
  return res.rows[0];
}

/** Get a user's activity logs (paginated). */
async function getUserLogs(id, { page, limit }) {
  const offset = (page - 1) * limit;
  const count = await query('SELECT count(*) FROM user_activity_logs WHERE user_id=$1', [id]);
  const logs = await query(
    `SELECT * FROM user_activity_logs WHERE user_id=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
    [id, limit, offset]
  );
  return {
    rows: logs.rows,
    pagination: makePagination({ page, limit }, parseInt(count.rows[0].count, 10)),
  };
}

/** List defined roles. */
async function listRoles() {
  const res = await query('SELECT * FROM roles ORDER BY created_at');
  return res.rows;
}

module.exports = { listUsers, getUser, createUser, updateUser, setStatus, deleteUser, getUserLogs, listRoles };