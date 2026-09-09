const router = require('express').Router();
const ctrl = require('../controllers/laboratory.controller');
const v = require('../validators/laboratory.validator');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

router.get('/', ctrl.list);
router.get('/:id', ctrl.get);
router.get('/:id/availability', ctrl.availability);
router.post('/', authorize('super_admin', 'lab_manager'), v.create, ctrl.create);
router.patch('/:id', authorize('super_admin', 'lab_manager'), v.update, ctrl.update);
router.patch('/:id/status', authorize('super_admin', 'lab_manager'), v.status, ctrl.setStatus);
router.delete('/:id', authorize('super_admin'), ctrl.remove);

module.exports = router;