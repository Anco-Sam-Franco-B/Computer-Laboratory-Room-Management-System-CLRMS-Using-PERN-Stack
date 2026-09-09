// ---------------------------------------------------------------------------
// Report definitions — each { title, columns, sql, params }
// ---------------------------------------------------------------------------

const BUILDER_MAP = {
  attendance: {
    title: 'Attendance Report',
    columns: ['Student', 'Email', 'Department', 'Session', 'Date', 'Status', 'Method', 'Check-in time'],
    sql: `
      SELECT u.first_name || ' ' || u.last_name AS student, u.email, d.name AS department,
             s.topic AS session_topic, s.session_date::text AS session_date,
             r.status, r.method, r.check_in_time::text AS check_in_time
      FROM attendance_records r
      JOIN users u ON u.id = r.user_id
      LEFT JOIN departments d ON d.id = u.department_id
      JOIN attendance_sessions s ON s.id = r.attendance_session_id
      WHERE ($1::text IS NULL OR r.status::text = $1)
        AND ($2::date IS NULL OR s.session_date >= $2::date)
        AND ($3::date IS NULL OR s.session_date <= $3::date)
      ORDER BY s.session_date DESC`,
    params: (q) => [q.status || null, q.from || null, q.to || null],
  },
  utilization: {
    title: 'Laboratory Utilization Report',
    columns: ['Laboratory', 'Code', 'Capacity', 'Bookings', 'Approved', 'Utilization %'],
    sql: `
      SELECT l.name AS laboratory, l.code, l.capacity,
             count(b.id) AS bookings,
             count(b.id) FILTER (WHERE b.status='approved') AS approved,
             CASE WHEN count(b.id)=0 THEN 0
                  ELSE round((count(b.id) FILTER (WHERE b.status='approved')::numeric / count(b.id) * 100)::numeric)
             END AS utilization
      FROM laboratories l
      LEFT JOIN bookings b ON b.laboratory_id = l.id AND b.deleted_at IS NULL
        AND ($1::date IS NULL OR b.date >= $1::date) AND ($2::date IS NULL OR b.date <= $2::date)
      WHERE l.deleted_at IS NULL
      GROUP BY l.id ORDER BY l.name`,
    params: (q) => [q.from || null, q.to || null],
  },
  bookings: {
    title: 'Booking Report',
    columns: ['Lab', 'Requester', 'Title', 'Date', 'Start', 'End', 'Status', 'Approver'],
    sql: `
      SELECT l.name AS laboratory, rq.first_name || ' ' || rq.last_name AS requester,
             b.title, b.date::text, b.start_time::text, b.end_time::text, b.status,
             ap.first_name || ' ' || ap.last_name AS approver
      FROM bookings b
      JOIN laboratories l ON l.id = b.laboratory_id
      JOIN users rq ON rq.id = b.requester_id
      LEFT JOIN users ap ON ap.id = b.approved_by
      WHERE b.deleted_at IS NULL
        AND ($1::text IS NULL OR b.status::text = $1)
        AND ($2::date IS NULL OR b.date >= $2::date)
        AND ($3::date IS NULL OR b.date <= $3::date)
      ORDER BY b.date DESC`,
    params: (q) => [q.status || null, q.from || null, q.to || null],
  },
  maintenance: {
    title: 'Maintenance Report',
    columns: ['Ticket No', 'Title', 'Priority', 'Status', 'Laboratory', 'Assigned To', 'Cost', 'Created At'],
    sql: `
      SELECT mt.ticket_no, mt.title, mt.priority, mt.status, l.name AS laboratory,
             asg.first_name || ' ' || asg.last_name AS assigned_to,
             mt.cost, mt.created_at::text
      FROM maintenance_tickets mt
      LEFT JOIN laboratories l ON l.id = mt.laboratory_id
      LEFT JOIN users asg ON asg.id = mt.assigned_to
      WHERE mt.deleted_at IS NULL
        AND ($1::text IS NULL OR mt.status::text = $1)
        AND ($2::timestamptz IS NULL OR mt.created_at >= $2::timestamptz)
        AND ($3::timestamptz IS NULL OR mt.created_at <= $3::timestamptz)
      ORDER BY mt.created_at DESC`,
    params: (q) => [q.status || null, q.from || null, q.to || null],
  },
  equipment: {
    title: 'Equipment Report',
    columns: ['Type', 'Name', 'Brand', 'Model', 'Serial', 'Status', 'Laboratory', 'Purchased'],
    sql: `
      SELECT e.equipment_type, e.name, e.brand, e.model, e.serial_number, e.status,
             l.name AS laboratory, e.purchase_date::text
      FROM equipment e
      LEFT JOIN laboratories l ON l.id = e.laboratory_id
      WHERE e.deleted_at IS NULL
        AND ($1::text IS NULL OR e.status::text = $1)
        AND ($2::text IS NULL OR e.equipment_type::text = $2)
      ORDER BY e.name`,
    params: (q) => [q.status || null, q.equipmentType || null],
  },
  assets: {
    title: 'Assets Report',
    columns: ['Asset', 'Category', 'Location', 'Brand', 'Model', 'Serial', 'Status', 'Acquired'],
    sql: `
      SELECT 'Computer'::text AS asset, 'computer'::text AS category, l.name AS location, c.brand, c.model, c.serial_number, c.status::text, c.purchase_date::text
      FROM computers c LEFT JOIN laboratories l ON l.id = c.laboratory_id WHERE c.deleted_at IS NULL
      UNION ALL
      SELECT 'Equipment'::text AS asset, e.equipment_type::text, l.name AS location, e.brand, e.model, e.serial_number, e.status::text, e.purchase_date::text
      FROM equipment e LEFT JOIN laboratories l ON l.id = e.laboratory_id WHERE e.deleted_at IS NULL
      ORDER BY category, brand`,
    params: () => [],
  },
  incidents: {
    title: 'Incident Report',
    columns: ['No', 'Type', 'Priority', 'Title', 'Status', 'Reporter', 'Lab', 'Created'],
    sql: `
      SELECT i.incident_no, i.type, i.priority, i.title, i.status,
             rep.first_name || ' ' || rep.last_name AS reporter, l.name AS laboratory, i.created_at::text
      FROM incidents i
      LEFT JOIN laboratories l ON l.id = i.laboratory_id
      LEFT JOIN users rep ON rep.id = i.reported_by
      WHERE i.deleted_at IS NULL
        AND ($1::text IS NULL OR i.status::text = $1)
        AND ($2::text IS NULL OR i.type::text = $2)
      ORDER BY i.created_at DESC`,
    params: (q) => [q.status || null, q.type || null],
  },
  visitors: {
    title: 'Visitor Log Report',
    columns: ['Name', 'Organization', 'Purpose', 'Host', 'Lab', 'Check-in', 'Check-out', 'Status'],
    sql: `
      SELECT v.full_name, v.organization, v.purpose,
             host.first_name || ' ' || host.last_name AS host, l.name AS laboratory,
             v.check_in_at::text, v.check_out_at::text, v.status
      FROM visitors v
      LEFT JOIN users host ON host.id = v.host_user_id
      LEFT JOIN laboratories l ON l.id = v.laboratory_id
      WHERE v.deleted_at IS NULL
        AND ($1::text IS NULL OR v.status::text = $1)
      ORDER BY v.created_at DESC`,
    params: (q) => [q.status || null],
  },
};

const REPORT_TYPES = Object.keys(BUILDER_MAP);

module.exports = { BUILDER_MAP, REPORT_TYPES };