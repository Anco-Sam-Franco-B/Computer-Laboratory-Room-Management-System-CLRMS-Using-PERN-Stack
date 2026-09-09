const { query } = require('../config/db');
const AppError = require('../utils/AppError');
const { parseQuery, makePagination } = require('../utils/pagination');
const { audit } = require('../utils/auditHelper');
const { generateRef } = require('../utils/helpers');

async function listVisitors({ page, limit, offset, sort, order, where, params }) {
  const base = `FROM visitors v
    LEFT JOIN users h ON h.id = v.host_user_id
    LEFT JOIN laboratories l ON l.id = v.laboratory_id
    WHERE v.deleted_at IS NULL`;
  const count = await query(`SELECT count(*) ${base} ${where}`, params);
  const data = await query(
    `SELECT v.*, h.first_name || ' ' || h.last_name AS host_name, l.name AS laboratory_name
     ${base}
     ${where}
     ORDER BY ${sort} ${order}
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset]
  );
  return { rows: data.rows, pagination: makePagination({ page, limit }, parseInt(count.rows[0].count, 10)) };
}

async function getVisitor(id) {
  const res = await query(
    `SELECT v.*, h.first_name || ' ' || h.last_name AS host_name, l.name AS laboratory_name
     FROM visitors v
     LEFT JOIN users h ON h.id=v.host_user_id
     LEFT JOIN laboratories l ON l.id=v.laboratory_id
     WHERE v.id=$1 AND v.deleted_at IS NULL`,
    [id]
  );
  if (res.rowCount === 0) throw new AppError('Visitor record not found.', 404);
  return res.rows[0];
}

async function registerVisitor(data, actor) {
  const badge = generateRef('VD');
  const res = await query(
    `INSERT INTO visitors (full_name, email, phone, id_number, organization, purpose, host_user_id, laboratory_id, badge_number, registered_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [data.fullName, data.email || null, data.phone || null, data.idNumber || null,
     data.organization || null, data.purpose, data.hostUserId || null, data.laboratoryId || null,
     badge, actor.id]
  );
  await audit({ actorId: actor?.id, actorEmail: actor?.email, category: 'visitor', action: 'visitor.registered', entityType: 'visitor', entityId: res.rows[0].id, afterData: res.rows[0] });
  return res.rows[0];
}

async function checkInVisitor(id, actor) {
  const existing = await getVisitor(id);
  if (existing.status === 'checked_out') throw new AppError('Visitor already checked out.', 400);
  const res = await query(
    `UPDATE visitors SET status='checked_in', check_in_at=now(), updated_at=now() WHERE id=$1 RETURNING *`,
    [id]
  );
  await audit({ actorId: actor?.id, actorEmail: actor?.email, category: 'visitor', action: 'visitor.checked_in', entityType: 'visitor', entityId: id, beforeData: existing, afterData: res.rows[0] });
  return res.rows[0];
}

async function denyVisitor(id, actor) {
  await getVisitor(id);
  const res = await query(`UPDATE visitors SET status='denied', updated_at=now() WHERE id=$1 RETURNING *`, [id]);
  await audit({ actorId: actor?.id, actorEmail: actor?.email, category: 'visitor', action: 'visitor.denied', entityType: 'visitor', entityId: id, afterData: res.rows[0] });
  return res.rows[0];
}

async function checkOutVisitor(id, actor) {
  await getVisitor(id);
  const res = await query(`UPDATE visitors SET status='checked_out', check_out_at=now(), updated_at=now() WHERE id=$1 RETURNING *`, [id]);
  await audit({ actorId: actor?.id, actorEmail: actor?.email, category: 'visitor', action: 'visitor.checked_out', entityType: 'visitor', entityId: id, afterData: res.rows[0] });
  return res.rows[0];
}

module.exports = { listVisitors, getVisitor, registerVisitor, checkInVisitor, denyVisitor, checkOutVisitor };