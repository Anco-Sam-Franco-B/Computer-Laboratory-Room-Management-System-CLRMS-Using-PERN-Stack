const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const fs = require('fs');
const { Pool } = require('pg');

/**
 * Drop & recreate all CLRMS objects. For development only.
 * Usage: npm run db:reset
 */
async function resetDatabase() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const schemaPath = path.join(__dirname, '../src/database/schema.sql');
  const seedPath = path.join(__dirname, '../src/database/seed.sql');

  console.log('⚠ Dropping all tables (CASCADE)...');
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  console.log('→ Applying schema ...');
  await pool.query(fs.readFileSync(schemaPath, 'utf8'));
  console.log('→ Seeding reference data ...');
  await pool.query(fs.readFileSync(seedPath, 'utf8'));
  console.log('✓ Database reset complete. Now run: npm run db:seed');
  await pool.end();
}

resetDatabase().catch((err) => {
  console.error('✖ Reset failed.');
  console.error(err);
  process.exit(1);
});