const { query, withTransaction } = require('../config/db');
const AppError = require('../utils/AppError');
const { parseQuery, makePagination } = require('../utils/pagination');
const { audit } = require('../utils/auditHelper');
const { createNotification, createNotificationForMany, userIdsForRole } = require('../utils/notificationHelper');
const { generateRef } = require('../utils/helpers');

async function getSetting(key, fallback) {
  const res = await query('SELECT value FROM system_settings WHERE key=$1', [key]);
  if (res.rowCount === 0) return fallback;
  try { return JSON.parse(res.rows[0].value); } catch (e) { return res.rows[0].value; }
}

async function listBookings({ page, limit, offset, sort, order, where, params }) {
  const base = `FROM bookings b
    LEFT JOIN laboratories l ON l.id = b.laboratory_id
    LEFT JOIN users rq ON rq.id = b.requester_id
    LEFT JOIN users ap ON ap.id = b.approved_by
    WHERE b.deleted_at IS NULL`;
  const count = await query(`SELECT count(*) ${base} ${where}`, params);
  const data = await query(
    `SELECT b.*, l.name AS laboratory_name, l.code AS laboratory_code,
            rq.first_name || ' ' || rq.last_name AS requester_name,
            ap.first_name || ' ' || ap.last_name AS approver_name
     ${base}
     ${where}
     ORDER BY ${sort} ${order}
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset]
  );
  return { rows: data.rows, pagination: makePagination({ page, limit }, parseInt(count.rows[0].count, 10)) };
}

async function getBooking(id) {
  const res = await query(
    `SELECT b.*, l.name AS laboratory_name, l.code AS laboratory_code,
            rq.first_name || ' ' || rq.last_name AS requester_name,
            ap.first_name || ' ' || ap.last_name AS approver_name
     FROM bookings b
     LEFT JOIN laboratories l ON l.id=b.laboratory_id
     LEFT JOIN users rq ON rq.id=b.requester_id
     LEFT JOIN users ap ON ap.id=b.approved_by
     WHERE b.id=$1 AND b.deleted_at IS NULL`,
    [id]
  );
  if (res.rowCount === 0) throw new AppError('Booking not found.', 404);
  return res.rows[0];
}

/** Detect conflicts (approved+pending bookings & active timetable slots). */
async function detectConflicts({ laboratoryId, date, startTime, endTime, excludeId = null }) {
  const b2 = await query(
    `SELECT id, title, start_time, end_time, status FROM bookings
     WHERE laboratory_id=$1 AND date=$2 AND deleted_at IS NULL AND status IN ('pending','approved')
     AND start_time < $4 AND end_time > $3
     ${excludeId ? 'AND id <> $5' : ''}`,
    excludeId ? [laboratoryId, date, startTime, endTime, excludeId] : [laboratoryId, date, startTime, endTime]
  );

  const dayRes = await query(`SELECT to_char($1::date, 'FMDay') AS day`, [date]);
  const slotRes = await query(
    `SELECT ts.id, ts.course_code, ts.course_name, ts.start_time, ts.end_time
     FROM timetable_slots ts JOIN semesters s ON s.id=ts.semester_id
     WHERE ts.laboratory_id=$1 AND ts.day=$2 AND ts.deleted_at IS NULL AND s.is_active=true
       AND ts.start_time < $4 AND ts.end_time > $3`,
    [laboratoryId, dayRes.rows[0].day, startTime, endTime]
  );
  return { bookings: b2.rows, timetableSlots: slotRes.rows };
}

/** Create a booking request. */
async function createBooking(data, actor) {
  const lab = await query('SELECT * FROM laboratories WHERE id=$1 AND deleted_at IS NULL', [data.laboratoryId]);
  if (lab.rowCount === 0) throw new AppError('Laboratory not found.', 404);
  if (lab.rows[0].status === 'closed') throw new AppError('Laboratory is closed.', 400);
  if (lab.rows[0].status === 'maintenance') throw new AppError('Laboratory is under maintenance.', 400);

  const conflicts = await detectConflicts({
    laboratoryId: data.laboratoryId, date: data.date,
    startTime: data.startTime, endTime: data.endTime,
  });
  const hasConflict = conflicts.bookings.length > 0 || conflicts.timetableSlots.length > 0;

  let status = 'pending';
  if (await getSetting('booking.auto_approve', false) === true) status = 'approved';
  if (hasConflict) {
    throw new AppError(
      'Time conflict detected. The laboratory is already scheduled during this period.',
      409
    );
  }

  const res = await query(
    `INSERT INTO bookings (laboratory_id, requester_id, title, purpose, session_kind, date, start_time, end_time, attendee_count, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [data.laboratoryId, actor.id, data.title, data.purpose || null, data.sessionKind || 'class',
     data.date, data.startTime, data.endTime, data.attendeeCount || 0, status]
  );

  // Notify lab manager + super admins of new booking
  const managers = await userIdsForRole('lab_manager');
  await createNotificationForMany({
    user_ids: managers,
    type: 'info',
    title: 'New booking request',
    message: `${actor.first_name} ${actor.last_name} requested ${lab.rows[0].name} on ${data.date}`,
    link: `/bookings/${res.rows[0].id}`,
    data: { bookingId: res.rows[0].id },
  });

  await audit({
    actorId: actor?.id, actorEmail: actor?.email, category: 'booking',
    action: 'booking.created', entityType: 'booking', entityId: res.rows[0].id, afterData: res.rows[0],
  });
  return { ...res.rows[0], conflictFree: !hasConflict };
}

async function approveBooking(id, actor, note = null) {
  const existing = await getBooking(id);
  if (existing.status !== 'pending') throw new AppError('Only pending bookings can be approved.', 400);

  const conflicts = await detectConflicts({
    laboratoryId: existing.laboratory_id, date: existing.date,
    startTime: existing.start_time, endTime: existing.end_time, excludeId: id,
  });
  if (conflicts.bookings.length || conflicts.timetableSlots.length) {
    throw new AppError('Cannot approve: time conflict detected with another schedule.', 409);
  }

  const res = await query(
    `UPDATE bookings SET status='approved', approved_by=$2, approval_note=$3, updated_at=now() WHERE id=$1 RETURNING *`,
    [id, actor.id, note]
  );
  const b = res.rows[0];

  await createNotification({
    user_id: b.requester_id, type: 'success', title: 'Booking approved',
    message: `Your booking "${b.title}" for ${existing.laboratory_name} was approved.`,
    link: `/bookings/${b.id}`, data: { bookingId: b.id },
  });
  await audit({
    actorId: actor?.id, actorEmail: actor?.email, category: 'booking',
    action: 'booking.approved', entityType: 'booking', entityId: id,
    beforeData: existing, afterData: b,
  });
  return b;
}

async function rejectBooking(id, actor, reason) {
  const existing = await getBooking(id);
  if (existing.status !== 'pending') throw new AppError('Only pending bookings can be rejected.', 400);
  const res = await query(
    `UPDATE bookings SET status='rejected', approved_by=$2, approval_note=$3, updated_at=now() WHERE id=$1 RETURNING *`,
    [id, actor.id, reason || null]
  );
  const b = res.rows[0];
  await createNotification({
    user_id: b.requester_id, type: 'error', title: 'Booking rejected',
    message: `Your booking "${b.title}" was rejected${reason ? `: ${reason}` : ''}.`,
    link: `/bookings/${b.id}`, data: { bookingId: b.id },
  });
  await audit({
    actorId: actor?.id, actorEmail: actor?.email, category: 'booking',
    action: 'booking.rejected', entityType: 'booking', entityId: id, beforeData: existing, afterData: b,
  });
  return b;
}

async function cancelBooking(id, actor) {
  const existing = await getBooking(id);
  if (!['pending', 'approved'].includes(existing.status)) throw new AppError('Booking cannot be cancelled.', 400);
  if (existing.requester_id !== actor.id && actor.role_code !== 'super_admin' && actor.role_code !== 'lab_manager') {
    throw new AppError('You can only cancel your own bookings.', 403);
  }
  const res = await query(`UPDATE bookings SET status='cancelled', updated_at=now() WHERE id=$1 RETURNING *`, [id]);
  await audit({
    actorId: actor?.id, actorEmail: actor?.email, category: 'booking',
    action: 'booking.cancelled', entityType: 'booking', entityId: id, beforeData: existing, afterData: res.rows[0],
  });
  return res.rows[0];
}

async function completeBooking(id, actor) {
  const existing = await getBooking(id);
  if (existing.status !== 'approved') throw new AppError('Only approved bookings can be completed.', 400);
  const res = await query(`UPDATE bookings SET status='completed', checked_out_at=now(), updated_at=now() WHERE id=$1 RETURNING *`, [id]);
  await audit({
    actorId: actor?.id, actorEmail: actor?.email, category: 'booking',
    action: 'booking.completed', entityType: 'booking', entityId: id, beforeData: existing, afterData: res.rows[0],
  });
  return res.rows[0];
}

async function checkIn(id, actor) {
  const existing = await getBooking(id);
  if (existing.status !== 'approved') throw new AppError('Only approved bookings can be checked-in.', 400);
  const res = await query(`UPDATE bookings SET checked_in_at=COALESCE(checked_in_at, now()), updated_at=now() WHERE id=$1 RETURNING *`, [id]);
  await audit({ actorId: actor?.id, actorEmail: actor?.email, category: 'booking', action: 'booking.checked_in', entityType: 'booking', entityId: id });
  return res.rows[0];
}

async function deleteBooking(id, actor) {
  const existing = await getBooking(id);
  await query('UPDATE bookings SET deleted_at=now(), updated_at=now() WHERE id=$1', [id]);
  await audit({ actorId: actor?.id, actorEmail: actor?.email, category: 'booking', action: 'booking.deleted', entityType: 'booking', entityId: id, beforeData: existing });
  return { id };
}

module.exports = {
  listBookings, getBooking, createBooking, approveBooking, rejectBooking,
  cancelBooking, completeBooking, checkIn, deleteBooking, detectConflicts,
};