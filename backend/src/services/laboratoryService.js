const { query } = require('../config/db');
const AppError = require('../utils/AppError');
const { parseQuery, makePagination } = require('../utils/pagination');
const { audit } = require('../utils/auditHelper');

async function listLabs({ page, limit, offset, sort, order, where, params, role }) {
  const base = `FROM laboratories l
    LEFT JOIN departments d ON d.id = l.department_id
    LEFT JOIN users u ON u.id = l.lab_manager_id
    WHERE l.deleted_at IS NULL`;
  const count = await query(`SELECT count(*) ${base} ${where}`, params);
  const data = await query(
    `SELECT l.id, l.name, l.code, l.location, l.capacity, l.status, l.department_id, l.lab_manager_id,
            l.opens_at, l.closes_at, l.notes, l.created_at,
            d.name AS department_name, u.first_name || ' ' || u.last_name AS lab_manager_name,
            (SELECT count(*) FROM computers c WHERE c.laboratory_id=l.id AND c.deleted_at IS NULL) AS computer_count,
            (SELECT count(*) FROM computers c WHERE c.laboratory_id=l.id AND c.deleted_at IS NULL AND c.status='active') AS active_computers,
            (SELECT count(*) FROM equipment e WHERE e.laboratory_id=l.id AND e.deleted_at IS NULL) AS equipment_count
     ${base}
     ${where}
     ORDER BY ${sort} ${order}
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset]
  );
  return { rows: data.rows, pagination: makePagination({ page, limit }, parseInt(count.rows[0].count, 10)) };
}

async function getLab(id) {
  const res = await query(
    `SELECT l.*, d.name AS department_name, u.first_name || ' ' || u.last_name AS lab_manager_name,
       (SELECT count(*) FROM computers c WHERE c.laboratory_id=l.id AND c.deleted_at IS NULL) AS computer_count,
       (SELECT count(*) FROM equipment e WHERE e.laboratory_id=l.id AND e.deleted_at IS NULL) AS equipment_count
     FROM laboratories l
     LEFT JOIN departments d ON d.id = l.department_id
     LEFT JOIN users u ON u.id = l.lab_manager_id
     WHERE l.id=$1 AND l.deleted_at IS NULL`,
    [id]
  );
  if (res.rowCount === 0) throw new AppError('Laboratory not found.', 404);
  return res.rows[0];
}

async function createLab(data, actor) {
  try {
    const res = await query(
      `INSERT INTO laboratories (name, code, location, capacity, status, department_id, lab_manager_id, opens_at, closes_at, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [data.name, data.code, data.location || null, data.capacity || 0, data.status || 'active',
       data.departmentId || null, data.labManagerId || null, data.opensAt || null, data.closesAt || null, data.notes || null]
    );
    await audit({
      actorId: actor?.id, actorEmail: actor?.email, category: 'laboratory',
      action: 'laboratory.created', entityType: 'laboratory', entityId: res.rows[0].id, afterData: res.rows[0],
    });
    return res.rows[0];
  } catch (err) {
    if (err.code === '23505') throw new AppError('A laboratory with that name or code already exists.', 409);
    throw err;
  }
}

async function updateLab(id, data, actor) {
  const existing = await getLab(id);
  const fields = []; const params = []; let ps = 1;
  const map = {
    name: 'name', code: 'code', location: 'location', capacity: 'capacity', status: 'status',
    departmentId: 'department_id', labManagerId: 'lab_manager_id', opensAt: 'opens_at',
    closesAt: 'closes_at', notes: 'notes',
  };
  for (const [k, col] of Object.entries(map)) {
    if (data[k] !== undefined) { fields.push(`${col}=$${ps++}`); params.push(data[k]); }
  }
  if (!fields.length) return existing;
  params.push(id);
  const res = await query(`UPDATE laboratories SET ${fields.join(', ')}, updated_at=now() WHERE id=$${ps} RETURNING *`, params);
  await audit({
    actorId: actor?.id, actorEmail: actor?.email, category: 'laboratory',
    action: 'laboratory.updated', entityType: 'laboratory', entityId: id, beforeData: existing, afterData: res.rows[0],
  });
  return res.rows[0];
}

async function setStatus(id, status, actor) {
  return updateLab(id, { status }, actor);
}

async function deleteLab(id, actor) {
  await getLab(id);
  await query('UPDATE laboratories SET deleted_at=now(), updated_at=now() WHERE id=$1', [id]);
  await audit({ actorId: actor?.id, actorEmail: actor?.email, category: 'laboratory', action: 'laboratory.deleted', entityType: 'laboratory', entityId: id });
  return { id };
}

/** Availability of a lab for a date/time window (conflict check vs bookings+timetable). */
async function checkAvailability(id, { date, startTime, endTime }) {
  const bookingConflict = await query(
    `SELECT count(*)::int AS count FROM bookings
     WHERE laboratory_id=$1 AND date=$2 AND deleted_at IS NULL AND status IN ('approved','pending')
       AND start_time < $4 AND end_time > $3`,
    [id, date, startTime, endTime]
  );
  const dayName = await query(`SELECT to_char($1::date, 'FMDay') AS day`, [date]);
  const slotConflict = await query(
    `SELECT count(*)::int AS count FROM timetable_slots ts
     JOIN semesters s ON s.id = ts.semester_id
     WHERE ts.laboratory_id=$1 AND ts.day=$2 AND ts.deleted_at IS NULL AND s.is_active = true
       AND ts.start_time < $4 AND ts.end_time > $3`,
    [id, dayName.rows[0].day, startTime, endTime]
  );
  return {
    available: bookingConflict.rows[0].count === 0 && slotConflict.rows[0].count === 0,
    bookingConflict: bookingConflict.rows[0].count,
    timetableConflict: slotConflict.rows[0].count,
  };
}

module.exports = { listLabs, getLab, createLab, updateLab, setStatus, deleteLab, checkAvailability };