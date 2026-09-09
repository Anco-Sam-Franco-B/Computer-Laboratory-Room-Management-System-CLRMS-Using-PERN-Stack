const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const { runFile } = require('../config/db');

/**
 * Apply the full schema. Safe to run repeatedly (uses IF NOT EXISTS + DO blocks).
 * Usage: npm run db:migrate
 */
async function migrate() {
  const schemaPath = path.join(__dirname, 'schema.sql');
  console.log('→ Applying schema ...');
  await runFile(schemaPath);
  console.log('✓ Schema applied successfully.');
  process.exit(0);
}

migrate().catch((err) => {
  console.error('✖ Migration failed.');
  console.error(err);
  process.exit(1);
});