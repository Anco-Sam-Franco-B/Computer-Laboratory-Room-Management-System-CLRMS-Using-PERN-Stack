const { query } = require('../config/db');
const AppError = require('../utils/AppError');
const { parseQuery, makePagination } = require('../utils/pagination');
const { audit } = require('../utils/auditHelper');
const { createNotification, createNotificationForMany, userIdsForRole } = require('../utils/notificationHelper');
const { generateRef } = require('../utils/helpers');

async function listIncidents({ page, limit, offset, sort, order, where, params }) {
  const base = `FROM incidents i
    LEFT JOIN laboratories l ON l.id = i.laboratory_id
    LEFT JOIN users rep ON rep.id = i.reported_by
    LEFT JOIN users asg ON asg.id = i.assigned_to
    WHERE i.deleted_at IS NULL`;
  const count = await query(`SELECT count(*) ${base} ${where}`, params);
  const data = await query(
    `SELECT i.*, l.name AS laboratory_name,
            rep.first_name || ' ' || rep.last_name AS reported_by_name,
            asg.first_name || ' ' || asg.last_name AS assigned_to_name
     ${base}
     ${where}
     ORDER BY ${sort} ${order}
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset]
  );
  return { rows: data.rows, pagination: makePagination({ page, limit }, parseInt(count.rows[0].count, 10)) };
}

async function getIncident(id) {
  const res = await query(
    `SELECT i.*, l.name AS laboratory_name,
            rep.first_name || ' ' || rep.last_name AS reported_by_name,
            asg.first_name || ' ' || asg.last_name AS assigned_to_name
     FROM incidents i
     LEFT JOIN laboratories l ON l.id=i.laboratory_id
     LEFT JOIN users rep ON rep.id=i.reported_by
     LEFT JOIN users asg ON asg.id=i.assigned_to
     WHERE i.id=$1 AND i.deleted_at IS NULL`,
    [id]
  );
  if (res.rowCount === 0) throw new AppError('Incident not found.', 404);
  return res.rows[0];
}

async function createIncident(data, actor) {
  const incidentNo = generateRef('INC');
  const res = await query(
    `INSERT INTO incidents (incident_no, type, title, description, priority, status, laboratory_id, computer_id, reported_by)
     VALUES ($1,$2,$3,$4,$5,'open',$6,$7,$8) RETURNING *`,
    [incidentNo, data.type, data.title, data.description, data.priority || 'medium',
     data.laboratoryId || null, data.computerId || null, actor.id]
  );
  const techs = await userIdsForRole('technician');
  await createNotificationForMany({
    user_ids: techs, type: 'warning', title: 'New incident reported',
    message: `${data.title} (${incidentNo}) — ${data.priority} ${data.type}`, link: `/incidents/${res.rows[0].id}`,
    data: { incidentId: res.rows[0].id },
  });
  await audit({ actorId: actor?.id, actorEmail: actor?.email, category: 'incident', action: 'incident.created', entityType: 'incident', entityId: res.rows[0].id, afterData: res.rows[0] });
  return res.rows[0];
}

async function updateIncident(id, data, actor) {
  const existing = await getIncident(id);
  const fields = []; const params = []; let ps = 1;
  const map = {
    type: 'type', title: 'title', description: 'description', priority: 'priority',
    status: 'status', laboratoryId: 'laboratory_id', computerId: 'computer_id',
    assignedTo: 'assigned_to', resolution: 'resolution',
  };
  for (const [k, col] of Object.entries(map)) {
    if (data[k] !== undefined) { fields.push(`${col}=$${ps++}`); params.push(data[k]); }
  }
  if ((data.status === 'resolved' || data.status === 'closed') && !data.resolution) {
    throw new AppError('A resolution note is required to resolve this incident.', 400);
  }
  if (!fields.length) return existing;
  params.push(id);
  const res = await query(`UPDATE incidents SET ${fields.join(', ')}, updated_at=now() WHERE id=$${ps} RETURNING *`, params);
  await audit({ actorId: actor?.id, actorEmail: actor?.email, category: 'incident', action: 'incident.updated', entityType: 'incident', entityId: id, beforeData: existing, afterData: res.rows[0] });
  return res.rows[0];
}

async function deleteIncident(id, actor) {
  await getIncident(id);
  await query('UPDATE incidents SET deleted_at=now(), updated_at=now() WHERE id=$1', [id]);
  await audit({ actorId: actor?.id, actorEmail: actor?.email, category: 'incident', action: 'incident.deleted', entityType: 'incident', entityId: id });
  return { id };
}

module.exports = { listIncidents, getIncident, createIncident, updateIncident, deleteIncident };