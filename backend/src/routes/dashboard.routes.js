const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { asyncHandler } = require('../utils/helpers');
const { ok } = require('../utils/ApiResponse');
const dashboardService = require('../services/dashboardService');

router.get('/', authenticate, asyncHandler(async (req, res) => {
  const data = await dashboardService.getDashboard(req.user);
  res.json(ok('Dashboard data.', data));
}));

module.exports = router;