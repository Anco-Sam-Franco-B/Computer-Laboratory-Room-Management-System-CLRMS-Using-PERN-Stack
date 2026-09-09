const router = require('express').Router();
const ctrl = require('../controllers/visitor.controller');
const v = require('../validators/visitor.validator');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

router.get('/', ctrl.list);
router.get('/:id', ctrl.get);
router.post('/', v.create, ctrl.create);
router.post('/:id/check-in', authorize('super_admin', 'lab_manager', 'technician'), ctrl.checkIn);
router.post('/:id/check-out', authorize('super_admin', 'lab_manager', 'technician'), ctrl.checkOut);
router.post('/:id/deny', authorize('super_admin', 'lab_manager', 'technician'), ctrl.deny);

module.exports = router;