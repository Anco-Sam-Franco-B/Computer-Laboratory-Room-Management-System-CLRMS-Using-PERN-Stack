const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const { asyncHandler } = require('../utils/helpers');
const { ok } = require('../utils/ApiResponse');
const settingService = require('../services/settingService');
const { query } = require('../config/db');
const { makePagination } = require('../utils/pagination');

router.use(authenticate);

// public-ish: any authed user can read settings (frontend needs some)
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const settings = await settingService.listAll();
    res.json(ok('System settings.', settings));
  })
);

router.put(
  '/',
  authorize('super_admin'),
  asyncHandler(async (req, res) => {
    const updated = await settingService.setMany(req.body, req.user);
    res.json(ok('Settings updated.', updated));
  })
);

// Audit logs (admin)
router.get(
  '/audit-logs',
  authorize('super_admin'),
  asyncHandler(async (req, res) => {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
    const offset = (page - 1) * limit;

    const where = [];
    const params = [];
    let ps = 1;
    if (req.query.category) { where.push(`category=$${ps++}`); params.push(req.query.category); }
    if (req.query.actorId) { where.push(`actor_id=$${ps++}`); params.push(req.query.actorId); }
    if (req.query.search) {
      where.push(`(action ILIKE $${ps} OR actor_email ILIKE $${ps})`); params.push(`%${req.query.search}%`); ps++;
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const count = await query(`SELECT count(*) FROM audit_logs ${whereSql}`, params);
    const logs = await query(
      `SELECT a.* FROM audit_logs a ${whereSql} ORDER BY a.created_at DESC LIMIT $${ps} OFFSET $${ps + 1}`,
      [...params, limit, offset]
    );
    res.json(ok('Audit logs.', logs.rows, makePagination({ page, limit }, parseInt(count.rows[0].count, 10))));
  })
);

module.exports = router;