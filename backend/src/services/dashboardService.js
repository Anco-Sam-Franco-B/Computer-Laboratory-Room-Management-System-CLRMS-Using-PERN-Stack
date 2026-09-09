const { query } = require('../config/db');
const AppError = require('../utils/AppError');

async function getSuperAdminDashboard() {
  const [cards, labUsage, attendanceTrend, equipmentHealth, maintenanceCosts] = await Promise.all([
    query(`
      SELECT
        (SELECT count(*) FROM laboratories WHERE deleted_at IS NULL) AS total_labs,
        (SELECT count(*) FROM computers WHERE deleted_at IS NULL) AS total_computers,
        (SELECT count(*) FROM equipment WHERE deleted_at IS NULL) AS total_equipment,
        (SELECT count(*) FROM users WHERE deleted_at IS NULL) AS total_users,
        (SELECT count(*) FROM bookings WHERE status='pending' AND deleted_at IS NULL) AS pending_bookings,
        (SELECT count(*) FROM maintenance_tickets WHERE status IN ('open','in_progress') AND deleted_at IS NULL) AS open_maintenance
    `),
    query(`
      SELECT name AS laboratory, code,
             (SELECT count(*) FROM bookings b WHERE b.laboratory_id=l.id AND b.deleted_at IS NULL AND b.status IN ('approved','completed')) AS sessions,
             CASE WHEN (SELECT count(*) FROM computers c WHERE c.laboratory_id=l.id) = 0 THEN 0
                  ELSE round((SELECT count(*) FROM computers c WHERE c.laboratory_id=l.id AND c.status='active') /
                             nullif((SELECT count(*) FROM computers c WHERE c.laboratory_id=l.id),0) * 100)
             END AS utilization
      FROM laboratories l WHERE l.deleted_at IS NULL ORDER BY l.name
    `),
    query(`
      SELECT to_char(date_trunc('month', s.session_date), 'Mon YYYY') AS month,
             count(*) FILTER (WHERE r.status='present') AS present,
             count(*) FILTER (WHERE r.status='absent') AS absent
      FROM attendance_records r
      JOIN attendance_sessions s ON s.id = r.attendance_session_id
      WHERE s.session_date >= now() - interval '6 months'
      GROUP BY 1 ORDER BY min(s.session_date)
    `),
    query(`
      SELECT status, count(*)::int AS count FROM computers GROUP BY status
    `),
    query(`
      SELECT to_char(date_trunc('month', created_at), 'Mon YYYY') AS month, round(sum(cost)::numeric)::int AS cost
      FROM maintenance_tickets
      WHERE created_at >= now() - interval '6 months'
      GROUP BY 1 ORDER BY min(created_at)
    `),
  ]);
  return {
    cards: cards.rows[0],
    charts: {
      laboratoryUsage: labUsage.rows,
      attendanceTrend: attendanceTrend.rows,
      equipmentHealth: equipmentHealth.rows,
      maintenanceCosts: maintenanceCosts.rows,
    },
  };
}

function labScope(managerId, alias = 'l') {
  return {
    where: `(${alias}.lab_manager_id = '${managerId}' OR EXISTS (SELECT 1 FROM departments d WHERE d.manager_id='${managerId}' AND d.id=${alias}.department_id))`,
    param: managerId,
  };
}

async function getLabManagerDashboard(managerId) {
  const scope = labScope(managerId);
  const [cards, todaySessions, availableComputers, activeIssues, labs] = await Promise.all([
    query(`
      SELECT
        (SELECT count(*) FROM laboratories l WHERE l.deleted_at IS NULL AND ${scope.where}) AS assigned_labs,
        (SELECT count(*) FROM computers c JOIN laboratories l ON l.id=c.laboratory_id WHERE l.deleted_at IS NULL AND ${scope.where.replaceAll('l.', 'l.')} AND c.status='active') AS available_computers,
        (SELECT count(*) FROM bookings b JOIN laboratories l ON l.id=b.laboratory_id WHERE b.deleted_at IS NULL AND b.date=CURRENT_DATE AND b.status='approved' AND ${scope.where}) AS today_sessions,
        (SELECT count(*) FROM maintenance_tickets mt JOIN laboratories l ON l.id=mt.laboratory_id WHERE mt.deleted_at IS NULL AND mt.status IN ('open','in_progress') AND ${scope.where}) AS active_issues
    `),
    query(`
      SELECT b.title, b.date, b.start_time, b.end_time, l.name AS lab
      FROM bookings b JOIN laboratories l ON l.id=b.laboratory_id
      WHERE b.date=CURRENT_DATE AND b.status='approved' AND b.deleted_at IS NULL AND ${scope.where}
      ORDER BY b.start_time
    `),
    query(`
      SELECT c.computer_number, c.status, c.health_score, l.name AS lab
      FROM computers c JOIN laboratories l ON l.id=c.laboratory_id
      WHERE c.status='active' AND c.deleted_at IS NULL AND ${scope.where}
      ORDER BY l.name, c.computer_number LIMIT 8
    `),
    query(`
      SELECT i.id, i.incident_no, i.title, i.priority, i.status, i.type
      FROM incidents i WHERE i.deleted_at IS NULL AND i.status NOT IN ('resolved','closed')
      ORDER BY CASE priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END
      LIMIT 8
    `),
    query(`SELECT id, name, code, capacity, status FROM laboratories l WHERE l.deleted_at IS NULL AND ${scope.where}`),
  ]);
  return { cards: cards.rows[0], todaySessions: todaySessions.rows, availableComputers: availableComputers.rows, activeIssues: activeIssues.rows, labs: labs.rows };
}

async function getTechnicianDashboard(userId) {
  const [cards, queued] = await Promise.all([
    query(`
      SELECT
        (SELECT count(*) FROM maintenance_tickets WHERE assigned_to=$1 AND status IN ('open','in_progress')) AS assigned_repairs,
        (SELECT count(*) FROM maintenance_tickets WHERE assigned_to=$1 AND status='resolved') AS completed_repairs,
        (SELECT count(*) FROM maintenance_tickets WHERE assigned_to=$1 AND status='open') AS pending_repairs,
        (SELECT COALESCE(round(avg(resolved_at - created_at))::int,0) FROM maintenance_tickets WHERE assigned_to=$1 AND status='resolved') AS avg_resolution_minutes
    `),
    query(`SELECT ticket_no, title, priority, status, created_at FROM maintenance_tickets WHERE assigned_to=$1 AND status IN ('open','in_progress') ORDER BY created_at LIMIT 10`, [userId]),
  ]);
  return { cards: cards.rows[0], queued: queued.rows };
}

async function getLecturerDashboard(userId) {
  const [cards, upcoming] = await Promise.all([
    query(`
      SELECT
        (SELECT count(*) FROM bookings WHERE requester_id=$1 AND status='approved') AS approved_bookings,
        (SELECT count(*) FROM bookings WHERE requester_id=$1 AND status='pending') AS pending_bookings,
        (SELECT count(*) FROM attendance_sessions WHERE lecturer_id=$1) AS sessions_held
    `, [userId]),
    query(`
      SELECT b.id, b.title, b.date, b.start_time, b.end_time, b.status, l.name AS lab
      FROM bookings b JOIN laboratories l ON l.id=b.laboratory_id
      WHERE b.requester_id=$1 AND b.deleted_at IS NULL AND b.date >= CURRENT_DATE
      ORDER BY b.date, b.start_time LIMIT 8
    `, [userId]),
  ]);
  return { cards: cards.rows[0], upcoming: upcoming.rows };
}

async function getStudentDashboard(userId) {
  const [cards, nextSessions, attendance] = await Promise.all([
    query(`
      SELECT
        (SELECT count(*) FROM attendance_records r WHERE r.user_id=$1 AND r.status='present') AS present,
        (SELECT count(*) FROM attendance_records r WHERE r.user_id=$1 AND r.status='late') AS late,
        (SELECT count(*) FROM attendance_records r WHERE r.user_id=$1 AND r.status='absent') AS absent,
        (SELECT count(*) FROM attendance_records r WHERE r.user_id=$1) AS total
    `, [userId]),
    query(`
      SELECT ts.course_code, ts.course_name, ts.day, ts.start_time, ts.end_time, l.name AS lab
      FROM timetable_slots ts JOIN laboratories l ON l.id=ts.laboratory_id JOIN semesters s ON s.id=ts.semester_id
      WHERE s.is_active=true AND ts.deleted_at IS NULL AND l.deleted_at IS NULL
      ORDER BY ts.day, ts.start_time LIMIT 8
    `),
    query(`SELECT status, count(*)::int AS count FROM attendance_records WHERE user_id=$1 GROUP BY status`, [userId]),
  ]);
  return { cards: cards.rows[0], nextSessions: nextSessions.rows, attendanceDistribution: attendance.rows };
}

function getDashboard(user) {
  switch (user.role_code) {
    case 'super_admin': return getSuperAdminDashboard();
    case 'lab_manager': return getLabManagerDashboard(user.id);
    case 'technician': return getTechnicianDashboard(user.id);
    case 'lecturer': return getLecturerDashboard(user.id);
    case 'student': return getStudentDashboard(user.id);
    default: throw new AppError('Unknown role.', 403);
  }
}

module.exports = { getDashboard };