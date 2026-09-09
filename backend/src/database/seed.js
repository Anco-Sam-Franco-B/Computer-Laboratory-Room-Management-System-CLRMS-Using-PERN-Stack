const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const bcrypt = require('bcryptjs');
const { pool, runFile, query } = require('../config/db');

const DEMO_PASSWORD = 'CLRMS@1234';

const DEMO_USERS = [
  { email: 'admin@clrms.edu',   first: 'Alex',  last: 'Morgan',  roleCode: 'super_admin',    dept: 'CS',  phone: '+10000000001' },
  { email: 'manager@clrms.edu', first: 'Sara',  last: 'Chen',    roleCode: 'lab_manager',    dept: 'CS',  phone: '+10000000002' },
  { email: 'manager.it@clrms.edu', first: 'David', last: 'Kim',  roleCode: 'lab_manager',    dept: 'IT',  phone: '+10000000003' },
  { email: 'tech@clrms.edu',    first: 'Jose',  last: 'Rivera',  roleCode: 'technician',     dept: 'IT',  phone: '+10000000004' },
  { email: 'lecturer@clrms.edu', first: 'Maya', last: 'Patel',   roleCode: 'lecturer',       dept: 'CS',  phone: '+10000000005' },
  { email: 'student@clrms.edu', first: 'Omar',  last: 'Hassan',  roleCode: 'student',        dept: 'CS',  phone: '+10000000006', studentId: 'STU-2026-001' },
  { email: 'student2@clrms.edu', first: 'Lena', last: 'Graves',  roleCode: 'student',        dept: 'IT',  phone: '+10000000007', studentId: 'STU-2026-002' },
];

async function seed() {
  // 1. Static reference data
  const seedPath = path.join(__dirname, 'seed.sql');
  await runFile(seedPath);
  console.log('✓ Reference data seeded (roles, departments, labs, computers, equipment).');

  // 2. Users (bcrypt hashes)
  const hash = await bcrypt.hash(DEMO_PASSWORD, 12);
  const created = [];

  for (const u of DEMO_USERS) {
    const role = await query('SELECT id FROM roles WHERE code = $1', [u.roleCode]);
    const dept = await query('SELECT id FROM departments WHERE code = $1', [u.dept]);
    const exists = await query('SELECT id FROM users WHERE email = $1', [u.email]);
    if (exists.rowCount > 0) {
      console.log(`  - ${u.email} already exists, skipping.`);
      continue;
    }
    const res = await query(
      `INSERT INTO users (role_id, email, password_hash, first_name, last_name, phone, student_id, department_id, status, email_verified_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'active', now())
       RETURNING id, email`,
      [role.rows[0].id, u.email, hash, u.first, u.last, u.phone, u.studentId || null,
       dept.rows[0] ? dept.rows[0].id : null]
    );
    console.log(`  + created ${res.rows[0].email}`);
    created.push(res.rows[0]);
  }

  // 3. Link department managers for the seeded manager users
  const manager = await query(`SELECT u.id, d.id AS dept_id FROM users u JOIN departments d ON d.code='CS' WHERE u.email='manager@clrms.edu'`);
  if (manager.rowCount) {
    await query(`UPDATE departments SET manager_id=$1 WHERE id=$2`, [manager.rows[0].id, manager.rows[0].dept_id]);
  }

  // 4. Link lab managers
  const lm = await query(`SELECT id FROM users WHERE email='manager@clrms.edu'`);
  if (lm.rowCount) {
    await query(`UPDATE laboratories SET lab_manager_id=$1 WHERE code IN ('LAB-CS-01','LAB-CS-02')`, [lm.rows[0].id]);
  }
  const lmIt = await query(`SELECT id FROM users WHERE email='manager.it@clrms.edu'`);
  if (lmIt.rowCount) {
    await query(`UPDATE laboratories SET lab_manager_id=$1 WHERE code='LAB-IT-01'`, [lmIt.rows[0].id]);
  }

  console.log('\n✓ Seed complete.');
  console.log('────────────────────────────────────────────────');
  console.log(`  Demo password for all seed users: ${DEMO_PASSWORD}`);
  console.log('  admin@clrms.edu     → Super Admin');
  console.log('  manager@clrms.edu   → Laboratory Manager (CS)');
  console.log('  tech@clrms.edu      → Technician');
  console.log('  lecturer@clrms.edu  → Lecturer');
  console.log('  student@clrms.edu   → Student');
  console.log('────────────────────────────────────────────────');
  await pool.end();
  process.exit(0);
}

seed().catch(async (err) => {
  console.error('✖ Seed failed.');
  console.error(err);
  await pool.end();
  process.exit(1);
});