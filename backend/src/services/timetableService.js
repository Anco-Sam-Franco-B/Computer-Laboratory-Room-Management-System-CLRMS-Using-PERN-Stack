const { query } = require('../config/db');
const AppError = require('../utils/AppError');
const { parseQuery, makePagination } = require('../utils/pagination');
const { audit } = require('../utils/auditHelper');

// ------------ Semesters ------------
async function listSemesters() {
  const res = await query(
    `SELECT s.*,
       (SELECT count(*) FROM timetable_slots ts WHERE ts.semester_id=s.id AND ts.deleted_at IS NULL) AS slot_count
     FROM semesters s ORDER BY s.start_date DESC`
  );
  return res.rows;
}

async function getSemester(id) {
  const res = await query('SELECT * FROM semesters WHERE id=$1', [id]);
  if (res.rowCount === 0) throw new AppError('Semester not found.', 404);
  return res.rows[0];
}

async function createSemester(data, actor) {
  try {
    if (data.isActive) {
      await query(`UPDATE semesters SET is_active=false WHERE is_active=true`);
    }
    const res = await query(
      `INSERT INTO semesters (name, season, year, start_date, end_date, is_active)
       VALUES ($1,$2,$3,$4,$5,COALESCE($6,false)) RETURNING *`,
      [data.name, data.season, data.year, data.startDate, data.endDate, data.isActive || false]
    );
    await audit({ actorId: actor?.id, actorEmail: actor?.email, category: 'administrative', action: 'semester.created', entityType: 'semester', entityId: res.rows[0].id, afterData: res.rows[0] });
    return res.rows[0];
  } catch (err) {
    if (err.code === '23505') throw new AppError('A semester with that name exists.', 409);
    throw err;
  }
}

async function deleteSemester(id, actor) {
  await getSemester(id);
  await query('DELETE FROM semesters WHERE id=$1', [id]);
  await audit({ actorId: actor?.id, actorEmail: actor?.email, category: 'administrative', action: 'semester.deleted', entityType: 'semester', entityId: id });
  return { id };
}

// ------------ Timetable slots ------------
async function listSlots({ where, params }) {
  const base = `FROM timetable_slots ts
    LEFT JOIN laboratories l ON l.id = ts.laboratory_id
    LEFT JOIN users le ON le.id = ts.lecturer_id
    LEFT JOIN semesters s ON s.id = ts.semester_id
    WHERE ts.deleted_at IS NULL`;
  const count = await query(`SELECT count(*) ${base} ${where}`, params);
  const data = await query(
    `SELECT ts.*, l.name AS laboratory_name, l.code AS laboratory_code,
            le.first_name || ' ' || le.last_name AS lecturer_name, s.name AS semester_name
     ${base}
     ${where}
     ORDER BY ts.day, ts.start_time
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, 1000, 0] // timetable views return full weekly grid; pagination applied at route level minimally
  );
  return { rows: data.rows, pagination: makePagination({ page: 1, limit: 1000 }, parseInt(count.rows[0].count, 10)) };
}

async function createSlot(data, actor) {
  // Conflict check within same semester/lab/day
  const conflict = await query(
    `SELECT id FROM timetable_slots
     WHERE semester_id=$1 AND laboratory_id=$2 AND day=$3 AND deleted_at IS NULL
       AND start_time < $5 AND end_time > $4`,
    [data.semesterId, data.laboratoryId, data.day, data.startTime, data.endTime]
  );
  if (conflict.rowCount > 0) {
    throw new AppError('Timetable conflict: the laboratory already has a slot at this time.', 409);
  }
  const res = await query(
    `INSERT INTO timetable_slots (semester_id, laboratory_id, lecturer_id, course_code, course_name, day, start_time, end_time, session_kind, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [data.semesterId, data.laboratoryId, data.lecturerId, data.courseCode, data.courseName,
     data.day, data.startTime, data.endTime, data.sessionKind || 'class', data.notes || null]
  );
  await audit({ actorId: actor?.id, actorEmail: actor?.email, category: 'administrative', action: 'timetable.slot.created', entityType: 'timetable_slot', entityId: res.rows[0].id, afterData: res.rows[0] });
  return res.rows[0];
}

async function updateSlot(id, data, actor) {
  const existing = await query('SELECT * FROM timetable_slots WHERE id=$1 AND deleted_at IS NULL', [id]);
  if (existing.rowCount === 0) throw new AppError('Slot not found.', 404);
  const fields = []; const params = []; let ps = 1;
  const map = {
    semesterId: 'semester_id', laboratoryId: 'laboratory_id', lecturerId: 'lecturer_id',
    courseCode: 'course_code', courseName: 'course_name', day: 'day',
    startTime: 'start_time', endTime: 'end_time', sessionKind: 'session_kind', notes: 'notes',
  };
  for (const [k, col] of Object.entries(map)) {
    if (data[k] !== undefined) { fields.push(`${col}=$${ps++}`); params.push(data[k]); }
  }
  if (!fields.length) return existing.rows[0];
  params.push(id);
  const res = await query(`UPDATE timetable_slots SET ${fields.join(', ')}, updated_at=now() WHERE id=$${ps} RETURNING *`, params);
  await audit({ actorId: actor?.id, actorEmail: actor?.email, category: 'administrative', action: 'timetable.slot.updated', entityType: 'timetable_slot', entityId: id, beforeData: existing.rows[0], afterData: res.rows[0] });
  return res.rows[0];
}

async function deleteSlot(id, actor) {
  await query('UPDATE timetable_slots SET deleted_at=now(), updated_at=now() WHERE id=$1', [id]);
  await audit({ actorId: actor?.id, actorEmail: actor?.email, category: 'administrative', action: 'timetable.slot.deleted', entityType: 'timetable_slot', entityId: id });
  return { id };
}

async function weeklySchedule({ laboratoryId, semesterId }) {
  const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const params = [];
  const clauses = ['ts.deleted_at IS NULL'];
  let ps = 1;
  if (laboratoryId) { clauses.push(`ts.laboratory_id=$${ps++}`); params.push(laboratoryId); }
  if (semesterId) { clauses.push(`ts.semester_id=$${ps++}`); params.push(semesterId); }
  const where = `WHERE ${clauses.join(' AND ')}`;

  const base = `SELECT ts.*, l.name AS laboratory_name, l.code AS laboratory_code,
            le.first_name || ' ' || le.last_name AS lecturer_name, s.name AS semester_name
     FROM timetable_slots ts
     LEFT JOIN laboratories l ON l.id=ts.laboratory_id
     LEFT JOIN users le ON le.id=ts.lecturer_id
     LEFT JOIN semesters s ON s.id=ts.semester_id
     ${where}`;

  const [activeSem, slots] = await Promise.all([
    query(`SELECT * FROM semesters WHERE is_active=true LIMIT 1`),
    query(`${base} ORDER BY ts.day, ts.start_time`, params),
  ]);

  const semester = activeSem.rowCount ? activeSem.rows[0] : null;

  // Utilization metric: % of slots filled vs max possible
  const totalSlots = dayNames.length * 10; // assume 10 usable hours per day (8:00-18:00)
  const filled = slots.rows.length;

  return {
    semester,
    days: dayNames.map((day) => ({ day, slots: slots.rows.filter((s) => s.day === day) })),
    utilization: semester ? Math.min(Math.round((filled / totalSlots) * 100), 100) : 0,
    slotCount: filled,
  };
}

module.exports = {
  listSemesters, getSemester, createSemester, deleteSemester,
  listSlots, createSlot, updateSlot, deleteSlot, weeklySchedule,
};