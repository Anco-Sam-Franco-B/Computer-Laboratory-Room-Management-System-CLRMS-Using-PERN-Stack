const router = require('express').Router();
const ctrl = require('../controllers/booking.controller');
const v = require('../validators/booking.validator');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

router.get('/', ctrl.list);
router.get('/conflicts', ctrl.conflicts);
router.get('/:id', ctrl.get);
router.post('/', v.create, ctrl.create);
router.post('/:id/approve', authorize('super_admin', 'lab_manager'), v.approve, ctrl.approve);
router.post('/:id/reject', authorize('super_admin', 'lab_manager'), v.reject, ctrl.reject);
router.post('/:id/cancel', ctrl.cancel);
router.post('/:id/complete', authorize('super_admin', 'lab_manager', 'lecturer'), ctrl.complete);
router.post('/:id/check-in', authorize('super_admin', 'lab_manager', 'lecturer'), ctrl.checkIn);
router.delete('/:id', authorize('super_admin', 'lab_manager'), ctrl.remove);

module.exports = router;