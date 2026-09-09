const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { asyncHandler } = require('../utils/helpers');
const { ok } = require('../utils/ApiResponse');
const notificationService = require('../services/notificationService');

router.use(authenticate);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
    const unreadOnly = req.query.unread === 'true';
    const result = await notificationService.listNotifications(req.user.id, { page, limit, unreadOnly });
    res.json(ok('Notifications.', result.rows, result.pagination));
  })
);

router.get(
  '/unread-count',
  asyncHandler(async (req, res) => {
    const count = await notificationService.unreadCount(req.user.id);
    res.json(ok('Unread count.', { count }));
  })
);

router.patch(
  '/read-all',
  asyncHandler(async (req, res) => {
    const rows = await notificationService.markAllRead(req.user.id);
    res.json(ok('All notifications marked as read.', { updated: rows.length }));
  })
);

router.patch(
  '/:id/read',
  asyncHandler(async (req, res) => {
    const n = await notificationService.markRead(req.user.id, req.params.id);
    res.json(ok('Notification marked as read.', n));
  })
);

module.exports = router;