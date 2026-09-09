const { query } = require('../config/db');
const AppError = require('../utils/AppError');
const { parseQuery, makePagination } = require('../utils/pagination');
const { audit } = require('../utils/auditHelper');

async function listDepartments({ page, limit, offset, sort, order, where, params }) {
  const base = `FROM departments d LEFT JOIN users u ON u.id = d.manager_id WHERE d.deleted_at IS NULL`;
  const count = await query(`SELECT count(*) ${base} ${where}`, params);
  const data = await query(
    `SELECT d.*, u.first_name || ' ' || u.last_name AS manager_name
     ${base}
     ${where}
     ORDER BY ${sort} ${order}
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset]
  );
  return { rows: data.rows, pagination: makePagination({ page, limit }, parseInt(count.rows[0].count, 10)) };
}

async function getDepartment(id) {
  const res = await query(
    `SELECT d.*, u.first_name || ' ' || u.last_name AS manager_name
     FROM departments d LEFT JOIN users u ON u.id = d.manager_id
     WHERE d.id=$1 AND d.deleted_at IS NULL`,
    [id]
  );
  if (res.rowCount === 0) throw new AppError('Department not found.', 404);
  return res.rows[0];
}

async function createDepartment(data, actor) {
  try {
    const res = await query(
      `INSERT INTO departments (name, code, description, manager_id, color)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [data.name, data.code, data.description || null, data.managerId || null, data.color || '#6366f1']
    );
    await audit({
      actorId: actor?.id, actorEmail: actor?.email, category: 'administrative',
      action: 'department.created', entityType: 'department', entityId: res.rows[0].id, afterData: res.rows[0],
    });
    return res.rows[0];
  } catch (err) {
    if (err.code === '23505') throw new AppError('A department with that name or code already exists.', 409);
    throw err;
  }
}

async function updateDepartment(id, data, actor) {
  const existing = await getDepartment(id);
  const fields = []; const params = []; let ps = 1;
  const map = { name: 'name', code: 'code', description: 'description', managerId: 'manager_id', color: 'color' };
  for (const [k, col] of Object.entries(map)) {
    if (data[k] !== undefined) { fields.push(`${col}=$${ps++}`); params.push(data[k]); }
  }
  if (!fields.length) return existing;
  params.push(id);
  const res = await query(`UPDATE departments SET ${fields.join(', ')}, updated_at=now() WHERE id=$${ps} RETURNING *`, params);
  await audit({
    actorId: actor?.id, actorEmail: actor?.email, category: 'administrative',
    action: 'department.updated', entityType: 'department', entityId: id, beforeData: existing, afterData: res.rows[0],
  });
  return res.rows[0];
}

async function deleteDepartment(id, actor) {
  await getDepartment(id);
  await query(`UPDATE departments SET deleted_at=now(), updated_at=now() WHERE id=$1`, [id]);
  await audit({ actorId: actor?.id, actorEmail: actor?.email, category: 'administrative', action: 'department.deleted', entityType: 'department', entityId: id });
  return { id };
}

/** Per-department statistics. */
async function departmentStats(id) {
  const dept = await getDepartment(id);
  const result = await query(
    `SELECT
       (SELECT count(*) FROM users WHERE department_id=$1 AND deleted_at IS NULL) AS users,
       (SELECT count(*) FROM laboratories WHERE department_id=$1 AND deleted_at IS NULL) AS laboratories,
       (SELECT count(*) FROM computers c JOIN laboratories l ON l.id=c.laboratory_id WHERE l.department_id=$1 AND c.deleted_at IS NULL) AS computers,
       (SELECT count(*) FROM bookings b JOIN laboratories l ON l.id=b.laboratory_id WHERE l.department_id=$1 AND b.deleted_at IS NULL AND b.status='pending') AS pending_bookings,
       (SELECT COALESCE(count(*),0) FROM maintenance_tickets mt JOIN laboratories l ON l.id=mt.laboratory_id WHERE l.department_id=$1 AND mt.status IN ('open','in_progress')) AS open_maintenance`,
    [id]
  );
  return { department: dept, stats: result.rows[0] };
}

module.exports = { listDepartments, getDepartment, createDepartment, updateDepartment, deleteDepartment, departmentStats };