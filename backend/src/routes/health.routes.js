const router = require('express').Router();
const { pool } = require('../config/db');

router.get('/', async (req, res) => {
  const check = { uptime: process.uptime(), timestamp: new Date().toISOString() };
  try {
    const r = await pool.query('SELECT 1 AS ok');
    check.database = r.rows[0].ok === 1 ? 'connected' : 'error';
    res.status(200).json({ success: true, message: 'API is healthy.', data: check });
  } catch (err) {
    check.database = 'disconnected';
    res.status(503).json({ success: false, message: 'Database unreachable.', data: check });
  }
});

module.exports = router;