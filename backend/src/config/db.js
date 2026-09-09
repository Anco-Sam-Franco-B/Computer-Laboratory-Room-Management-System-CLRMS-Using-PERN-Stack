const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const { DATABASE_URL } = process.env;

if (!DATABASE_URL) {
  console.error('✖ DATABASE_URL is not set. Copy backend/.env.example to backend/.env and configure it.');
  process.exit(1);
}

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: DATABASE_URL,
  max: process.env.DB_POOL_MAX ? parseInt(process.env.DB_POOL_MAX, 10) : 10,
  idleTimeoutMillis: 30000,
});

pool.on('error', (err) => {
  console.error('⚠ Unexpected error on idle PostgreSQL client', err);
});

/** Run a single query with parameters. */
async function query(text, params) {
  const start = Date.now();
  const res = await pool.query(text, params);
  if (process.env.DB_QUERY_LOG === 'true') {
    const dur = Date.now() - start;
    console.log(`  [sql] ${dur}ms  ${text.slice(0, 120)}`);
  }
  return res;
}

/** Run a query inside a transaction. `fn(pgClient)` must return a value. */
async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/** Execute the full contents of a .sql file. */
async function runFile(filePath) {
  const sql = fs.readFileSync(path.resolve(filePath), 'utf8');
  return pool.query(sql);
}

module.exports = { pool, query, withTransaction, runFile };