const crypto = require('crypto');
const QRCode = require('qrcode');
const { query } = require('../config/db');
const AppError = require('../utils/AppError');
const { audit } = require('../utils/auditHelper');

/** Sign a QR payload with HMAC so students can't forge check-ins. */
function signQR({ sessionId, expiresAt }) {
  const payload = `${sessionId}.${expiresAt.toISOString()}`;
  const sig = crypto
    .createHmac('sha256', process.env.QR_SECRET || 'qr-signing-secret')
    .update(payload)
    .digest('hex');
  return `${payload}.${sig}`;
}

function verifyQR(token) {
  const parts = String(token).split('.');
  if (parts.length !== 3) throw new AppError('Invalid QR code.', 400);
  const [sessionId, expiresISO, sig] = parts;
  const expected = crypto
    .createHmac('sha256', process.env.QR_SECRET || 'qr-signing-secret')
    .update(`${sessionId}.${expiresISO}`)
    .digest('hex');
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) throw new AppError('Invalid QR code.', 400);
  const expiresAt = new Date(expiresISO);
  if (expiresAt < new Date()) throw new AppError('QR code has expired.', 400);
  return { sessionId, expiresAt };
}

async function getSetting(key, fallback) {
  const res = await query('SELECT value FROM system_settings WHERE key=$1', [key]);
  if (res.rowCount === 0) return fallback;
  try { return JSON.parse(res.rows[0].value); } catch (e) { return res.rows[0].value; }
}

// ------------ Sessions ------------
async function createSession(data, actor) {
  const lab = await query('SELECT id, name FROM laboratories WHERE id=$1', [data.laboratoryId]);
  if (lab.rowCount === 0) throw new AppError('Laboratory not found.', 404);

  const res = await query(
    `INSERT INTO attendance_sessions (booking_id, laboratory_id, lecturer_id, topic, session_date, starts_at, ends_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [data.bookingId || null, data.laboratoryId, actor.id, data.topic, data.sessionDate || new Date()
      .toISOString().slice(0, 10), data.startsAt || null, data.endsAt || null]
  );

  // Register all students of the requester's department? — instead seed from department users
  const students = await query(
    `SELECT u.id FROM users u
     JOIN roles r ON r.id=u.role_id
     WHERE r.code='student' AND u.status='active' AND u.deleted_at IS NULL
     UNION
     SELECT u2.id FROM users u2 JOIN departments d ON d.id=u2.department_id WHERE d.manager_id=$1`,
    [actor.id]
  );
  for (const s of students.rows) {
    await query(
      `INSERT INTO attendance_records (attendance_session_id, user_id, status) VALUES ($1,$2,'absent') ON CONFLICT DO NOTHING`,
      [res.rows[0].id, s.id]
    );
  }

  await audit({ actorId: actor?.id, actorEmail: actor?.email, category: 'attendance', action: 'attendance.session.created', entityType: 'attendance_session', entityId: res.rows[0].id, afterData: res.rows[0] });
  return res.rows[0];
}

async function listSessions({ page, limit }) {
  const offset = (page - 1) * limit;
  const count = await query('SELECT count(*) FROM attendance_sessions WHERE deleted_at IS NULL');
  const data = await query(
    `SELECT s.*, l.name AS laboratory_name, l.code AS laboratory_code,
            u.first_name || ' ' || u.last_name AS lecturer_name,
            (SELECT count(*) FROM attendance_records r WHERE r.attendance_session_id=s.id) AS total_students,
            (SELECT count(*) FROM attendance_records r WHERE r.attendance_session_id=s.id AND r.status='present') AS present,
            (SELECT count(*) FROM attendance_records r WHERE r.attendance_session_id=s.id AND r.status='late') AS late,
            (SELECT count(*) FROM attendance_records r WHERE r.attendance_session_id=s.id AND r.status='excused') AS excused
     FROM attendance_sessions s
     LEFT JOIN laboratories l ON l.id=s.laboratory_id
     LEFT JOIN users u ON u.id=s.lecturer_id
     WHERE s.deleted_at IS NULL
     ORDER BY s.session_date DESC, s.created_at DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  return {
    rows: data.rows,
    pagination: { page, limit, total: parseInt(count.rows[0].count, 10), pageCount: Math.ceil(count.rows[0].count / limit) },
  };
}

async function getSession(id) {
  const res = await query(
    `SELECT s.*, l.name AS laboratory_name, l.code AS laboratory_code,
            u.first_name || ' ' || u.last_name AS lecturer_name
     FROM attendance_sessions s
     LEFT JOIN laboratories l ON l.id=s.laboratory_id
     LEFT JOIN users u ON u.id=s.lecturer_id
     WHERE s.id=$1 AND s.deleted_at IS NULL`,
    [id]
  );
  if (res.rowCount === 0) throw new AppError('Attendance session not found.', 404);
  return res.rows[0];
}

async function deleteSession(id, actor) {
  await getSession(id);
  await query(`UPDATE attendance_sessions SET deleted_at=now() WHERE id=$1`, [id]);
  await audit({ actorId: actor?.id, actorEmail: actor?.email, category: 'attendance', action: 'attendance.session.deleted', entityType: 'attendance_session', entityId: id });
  return { id };
}

// ------------ QR ------------
async function generateQR(sessionId, actor, minutes = 60) {
  const session = await getSession(sessionId);
  if (session.lecturer_id !== actor.id && !['super_admin', 'lab_manager'].includes(actor.role_code)) {
    throw new AppError('You cannot generate a QR for this session.', 403);
  }
  const expiresAt = new Date(Date.now() + minutes * 60 * 1000);
  const token = signQR({ sessionId, expiresAt });
  const dataUrl = await QRCode.toDataURL(token);
  await query(`UPDATE attendance_sessions SET qr_code=$1, qr_expires_at=$2 WHERE id=$3`, [token, expiresAt, sessionId]);
  return { qrDataUrl: dataUrl, qrToken: token, expiresAt, session };
}

// ------------ Records ------------
async function listRecords(sessionId) {
  const res = await query(
    `SELECT r.*, u.first_name, u.last_name, u.email, u.student_id,
            d.name AS department_name
     FROM attendance_records r
     JOIN users u ON u.id=r.user_id
     LEFT JOIN departments d ON d.id=u.department_id
     WHERE r.attendance_session_id=$1
     ORDER BY CASE r.status WHEN 'present' THEN 0 WHEN 'late' THEN 1 WHEN 'excused' THEN 2 ELSE 3 END, u.last_name`,
    [sessionId]
  );
  return res.rows;
}

async function markManual(sessionId, data, actor) {
  const session = await getSession(sessionId);
  const canManage = ['super_admin', 'lab_manager'].includes(actor.role_code) || session.lecturer_id === actor.id;
  if (!canManage) throw new AppError('Only the lecturer or a manager can record attendance.', 403);

  const lateAfter = parseInt(await getSetting('attendance.late_after_minutes', 15), 10);
  const records = Array.isArray(data.records) ? data.records : [];
  const results = [];

  for (const rec of records) {
    const student = await query('SELECT id FROM users WHERE id=$1 AND deleted_at IS NULL', [rec.userId]);
    if (student.rowCount === 0) continue;
    let status = rec.status || 'present';
    if (status === 'present' && session.starts_at) {
      // If check-in recorded later than starts_at+lateAfter → late
      const entered = rec.checkInTime ? new Date(rec.checkInTime) : new Date();
      const start = new Date(`${session.session_date.toISOString().slice(0, 10)}T${session.starts_at}`);
      if (entered > new Date(start.getTime() + lateAfter * 60000)) status = 'late';
    }
    const res = await query(
      `INSERT INTO attendance_records (attendance_session_id, user_id, status, check_in_time, method, verified_by)
       VALUES ($1,$2,$3,COALESCE($4, now()),'manual',$5)
       ON CONFLICT (attendance_session_id, user_id)
       DO UPDATE SET status=EXCLUDED.status, check_in_time=COALESCE(attendance_records.check_in_time, EXCLUDED.check_in_time), method='manual', verified_by=EXCLUDED.verified_by, updated_at=now()
       RETURNING *`,
      [sessionId, rec.userId, status, rec.checkInTime || null, actor.id]
    );
    results.push(res.rows[0]);
  }

  await audit({ actorId: actor?.id, actorEmail: actor?.email, category: 'attendance', action: 'attendance.recorded', entityType: 'attendance_session', entityId: sessionId, afterData: { count: results.length } });
  return results;
}

async function markAll(sessionId, { status }, actor) {
  const session = await getSession(sessionId);
  const canManage = ['super_admin', 'lab_manager'].includes(actor.role_code) || session.lecturer_id === actor.id;
  if (!canManage) throw new AppError('Only the lecturer or a manager can record attendance.', 403);

  const res = await query(
    `UPDATE attendance_records SET status=$2, updated_at=now()
     WHERE attendance_session_id=$1 AND user_id NOT IN (
       SELECT user_id FROM attendance_records WHERE attendance_session_id=$1 AND status IN ('present','late')
     ) RETURNING *`,
    [sessionId, status]
  );
  await audit({ actorId: actor?.id, actorEmail: actor?.email, category: 'attendance', action: 'attendance.bulk_marked', entityType: 'attendance_session', entityId: sessionId, metadata: { status } });
  return res.rows;
}

/** Student self check-in via QR. */
async function checkInQR(sessionId, data, actor) {
  const { sessionId: sid } = verifyQR(data.qrToken);
  if (sid !== sessionId) throw new AppError('QR code is for a different session.', 400);
  return (await checkInByToken(data, actor));
}

/** Student self check-in from the signed token alone (session id derived). */
async function checkInByToken(data, actor) {
  const { sessionId } = verifyQR(data.qrToken);
  const session = await getSession(sessionId);

  const lateAfter = parseInt(await getSetting('attendance.late_after_minutes', 15), 10);
  let status = 'present';
  if (session.starts_at) {
    const start = new Date(`${session.session_date.toISOString().slice(0, 10)}T${session.starts_at}`);
    if (new Date() > new Date(start.getTime() + lateAfter * 60000)) status = 'late';
  }

  const res = await query(
    `INSERT INTO attendance_records (attendance_session_id, user_id, status, check_in_time, method)
     VALUES ($1,$2,$3,now(),'qr')
     ON CONFLICT (attendance_session_id, user_id)
     DO UPDATE SET status=CASE WHEN attendance_records.status IN ('present','late') THEN attendance_records.status ELSE EXCLUDED.status END,
                   check_in_time=COALESCE(attendance_records.check_in_time, EXCLUDED.check_in_time),
                   method='qr',
                   updated_at=now()
     RETURNING *`,
    [sessionId, actor.id, status]
  );
  await audit({ actorId: actor?.id, actorEmail: actor?.email, category: 'attendance', action: 'attendance.qr_check_in', entityType: 'attendance_session', entityId: sessionId, metadata: { status } });
  return { ...res.rows[0], laboratory_name: session.laboratory_name, topic: session.topic };
}

/** My attendance (student/lecturer). */
async function myAttendance(userId, { page = 1, limit = 30 }) {
  const offset = (page - 1) * limit;
  const count = await query(
    `SELECT count(*) FROM attendance_records r JOIN attendance_sessions s ON s.id=r.attendance_session_id WHERE r.user_id=$1 AND s.deleted_at IS NULL`,
    [userId]
  );
  const data = await query(
    `SELECT r.*, s.topic, s.session_date, s.laboratory_id, l.name AS laboratory_name, l.code AS laboratory_code
     FROM attendance_records r
     JOIN attendance_sessions s ON s.id=r.attendance_session_id
     LEFT JOIN laboratories l ON l.id=s.laboratory_id
     WHERE r.user_id=$1 AND s.deleted_at IS NULL
     ORDER BY s.session_date DESC
     LIMIT $2 OFFSET $3`,
    [userId, limit, offset]
  );
  return {
    rows: data.rows,
    pagination: { page, limit, total: parseInt(count.rows[0].count, 10), pageCount: Math.ceil(count.rows[0].count / limit) },
    summary: await attendanceSummary(userId),
  };
}

async function attendanceSummary(userId) {
  const res = await query(
    `SELECT
       count(*) FILTER (WHERE r.status='present') AS present,
       count(*) FILTER (WHERE r.status='late') AS late,
       count(*) FILTER (WHERE r.status='absent') AS absent,
       count(*) FILTER (WHERE r.status='excused') AS excused,
       count(*) AS total
     FROM attendance_records r WHERE r.user_id=$1`,
    [userId]
  );
  return res.rows[0];
}

/** All active students for attendance-session pickers. */
async function allStudents() {
  const res = await query(
    `SELECT u.id, u.first_name, u.last_name, u.email, u.student_id, d.name AS department_name
     FROM users u
     JOIN roles r ON r.id=u.role_id
     LEFT JOIN departments d ON d.id=u.department_id
     WHERE r.code='student' AND u.status='active' AND u.deleted_at IS NULL
     ORDER BY u.last_name`
  );
  return res.rows;
}

module.exports = {
  createSession, listSessions, getSession, deleteSession,
  generateQR, listRecords, markManual, markAll, checkInQR, checkInByToken, myAttendance, attendanceSummary, allStudents,
};