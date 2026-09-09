const { query, withTransaction } = require('../config/db');
const AppError = require('../utils/AppError');
const { parseQuery, makePagination } = require('../utils/pagination');
const { audit } = require('../utils/auditHelper');
const { createNotification, createNotificationForMany, userIdsForRole } = require('../utils/notificationHelper');
const { generateRef } = require('../utils/helpers');

async function listTickets({ page, limit, offset, sort, order, where, params }) {
  const base = `FROM maintenance_tickets mt
    LEFT JOIN laboratories l ON l.id = mt.laboratory_id
    LEFT JOIN computers c ON c.id = mt.computer_id
    LEFT JOIN users rep ON rep.id = mt.reported_by
    LEFT JOIN users asg ON asg.id = mt.assigned_to
    WHERE mt.deleted_at IS NULL`;
  const count = await query(`SELECT count(*) ${base} ${where}`, params);
  const data = await query(
    `SELECT mt.*, l.name AS laboratory_name, c.computer_number,
            rep.first_name || ' ' || rep.last_name AS reported_by_name,
            asg.first_name || ' ' || asg.last_name AS assigned_to_name,
            (SELECT COALESCE(sum(p.quantity * p.unit_cost),0)::numeric(12,2) FROM maintenance_parts p WHERE p.ticket_id=mt.id) AS parts_cost
     ${base}
     ${where}
     ORDER BY ${sort} ${order}
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset]
  );
  return { rows: data.rows, pagination: makePagination({ page, limit }, parseInt(count.rows[0].count, 10)) };
}

async function getTicket(id) {
  const res = await query(
    `SELECT mt.*, l.name AS laboratory_name, c.computer_number,
            rep.first_name || ' ' || rep.last_name AS reported_by_name,
            asg.first_name || ' ' || asg.last_name AS assigned_to_name,
            (SELECT COALESCE(sum(p.quantity * p.unit_cost),0)::numeric(12,2) FROM maintenance_parts p WHERE p.ticket_id=mt.id) AS parts_cost
     FROM maintenance_tickets mt
     LEFT JOIN laboratories l ON l.id=mt.laboratory_id
     LEFT JOIN computers c ON c.id=mt.computer_id
     LEFT JOIN users rep ON rep.id=mt.reported_by
     LEFT JOIN users asg ON asg.id=mt.assigned_to
     WHERE mt.id=$1 AND mt.deleted_at IS NULL`,
    [id]
  );
  if (res.rowCount === 0) throw new AppError('Maintenance ticket not found.', 404);
  return res.rows[0];
}

async function listUpdates(ticketId) {
  const res = await query(
    `SELECT u.*, a.first_name || ' ' || a.last_name AS author_name
     FROM maintenance_updates u LEFT JOIN users a ON a.id=u.author_id
     WHERE u.ticket_id=$1 ORDER BY u.created_at DESC`,
    [ticketId]
  );
  return res.rows;
}

async function createTicket(data, actor) {
  const ticketNo = generateRef('MT');
  const res = await query(
    `INSERT INTO maintenance_tickets (ticket_no, title, description, target_type, computer_id, equipment_id, laboratory_id, reported_by, priority, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'open') RETURNING *`,
    [ticketNo, data.title, data.description, data.targetType || 'computer',
     data.computerId || null, data.equipmentId || null, data.laboratoryId || null,
     actor.id, data.priority || 'medium']
  );

  // Mark affected computer as maintenance
  if (data.computerId) {
    await query(`UPDATE computers SET status='maintenance', updated_at=now() WHERE id=$1`, [data.computerId]);
  }
  if (data.equipmentId) {
    await query(`UPDATE equipment SET status='in_repair', updated_at=now() WHERE id=$1`, [data.equipmentId]);
  }

  const techs = await userIdsForRole('technician');
  await createNotificationForMany({
    user_ids: techs,
    type: 'info',
    title: 'New maintenance ticket',
    message: `${data.title} (${ticketNo}) — priority ${data.priority}`,
    link: `/maintenance/${res.rows[0].id}`,
    data: { ticketId: res.rows[0].id },
  });

  await audit({ actorId: actor?.id, actorEmail: actor?.email, category: 'maintenance', action: 'maintenance.ticket.created', entityType: 'maintenance_ticket', entityId: res.rows[0].id, afterData: res.rows[0] });
  return res.rows[0];
}

async function assignTicket(id, technicianId, actor) {
  const ticket = await getTicket(id);
  if (!['open', 'in_progress'].includes(ticket.status)) throw new AppError('Only open tickets can be assigned.', 400);
  const tech = await query("SELECT u.id FROM users u JOIN roles r ON r.id=u.role_id WHERE u.id=$1 AND r.code='technician' AND u.deleted_at IS NULL", [technicianId]);
  if (tech.rowCount === 0) throw new AppError('Technician not found.', 400);

  const res = await query(
    `UPDATE maintenance_tickets SET assigned_to=$2, status='in_progress', started_at=COALESCE(started_at, now()), updated_at=now() WHERE id=$1 RETURNING *`,
    [id, technicianId]
  );
  await query(
    `INSERT INTO maintenance_updates (ticket_id, author_id, note, status_from, status_to) VALUES ($1,$2,$3,$4,$5)`,
    [id, actor.id, `Assigned to technician.`, ticket.status, 'in_progress']
  );
  await createNotification({
    user_id: technicianId, type: 'info', title: 'Maintenance assigned to you',
    message: ticket.title, link: `/maintenance/${id}`, data: { ticketId: id },
  });
  await audit({ actorId: actor?.id, actorEmail: actor?.email, category: 'maintenance', action: 'maintenance.assigned', entityType: 'maintenance_ticket', entityId: id, afterData: { assignedTo: technicianId } });
  return res.rows[0];
}

async function updateProgress(id, data, actor) {
  const ticket = await getTicket(id);
  const statusTo = data.status;
  const res = await query(
    `UPDATE maintenance_tickets
     SET status=$2::maintenance_status, updated_at=now(),
         started_at=CASE WHEN $2::maintenance_status = 'in_progress' THEN COALESCE(started_at, now()) ELSE started_at END,
         resolved_at=CASE WHEN $2::maintenance_status = 'resolved' THEN now() ELSE resolved_at END,
         closed_at=CASE WHEN $2::maintenance_status = 'closed' THEN now() ELSE closed_at END,
         cost = cost + COALESCE($3, 0)
     WHERE id=$1 RETURNING *`,
    [id, statusTo, data.costAddition || 0]
  );

  await query(
    `INSERT INTO maintenance_updates (ticket_id, author_id, note, status_from, status_to) VALUES ($1,$2,$3,$4,$5)`,
    [id, actor.id, data.note || `Status changed to ${statusTo}`, ticket.status, statusTo]
  );

  // Release resources when resolved/closed
  if (['resolved', 'closed'].includes(statusTo)) {
    await query(
      `UPDATE computers SET status='active', last_maintenance_at=now(), updated_at=now()
       WHERE id=$1 AND status='maintenance'`,
      [ticket.computer_id]
    );
    await query(
      `UPDATE equipment SET status='active', updated_at=now()
       WHERE id=$1 AND status='in_repair'`,
      [ticket.equipment_id]
    );
  }

  await createNotification({
    user_id: ticket.reported_by, type: 'info', title: 'Maintenance update',
    message: `Ticket ${ticket.ticket_no} is now "${statusTo}"`, link: `/maintenance/${id}`, data: { ticketId: id },
  });
  await audit({ actorId: actor?.id, actorEmail: actor?.email, category: 'maintenance', action: `maintenance.${statusTo}`, entityType: 'maintenance_ticket', entityId: id, afterData: { status: statusTo } });
  return res.rows[0];
}

async function addPart(id, data, actor) {
  await getTicket(id);
  const res = await query(
    `INSERT INTO maintenance_parts (ticket_id, part_name, quantity, unit_cost) VALUES ($1,$2,$3,$4) RETURNING *`,
    [id, data.partName, data.quantity || 1, data.unitCost || 0]
  );
  await query(
    `UPDATE maintenance_tickets SET updated_at=now() WHERE id=$1`,
    [id]
  );
  await audit({ actorId: actor?.id, actorEmail: actor?.email, category: 'maintenance', action: 'maintenance.part.added', entityType: 'maintenance_ticket', entityId: id, afterData: res.rows[0] });
  return res.rows[0];
}

async function setCost(id, cost, actor) {
  await getTicket(id);
  const res = await query(`UPDATE maintenance_tickets SET cost=$2, cost_approved=$3, updated_at=now() WHERE id=$1 RETURNING *`, [id, cost, true]);
  await audit({ actorId: actor?.id, actorEmail: actor?.email, category: 'maintenance', action: 'maintenance.cost.updated', entityType: 'maintenance_ticket', entityId: id, afterData: { cost } });
  return res.rows[0];
}

async function closeTicket(id, actor) {
  return updateProgress(id, { status: 'closed', note: 'Ticket closed.' }, actor);
}

module.exports = {
  listTickets, getTicket, listUpdates, createTicket, assignTicket,
  updateProgress, addPart, setCost, closeTicket,
};