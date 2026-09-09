const router = require('express').Router();
const ctrl = require('../controllers/computer.controller');
const v = require('../validators/computer.validator');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

router.get('/', ctrl.list);
router.get('/stats', ctrl.stats);
router.get('/:id', ctrl.get);
router.post('/', authorize('super_admin', 'lab_manager'), v.create, ctrl.create);
router.patch('/:id', authorize('super_admin', 'lab_manager', 'technician'), v.update, ctrl.update);
router.patch('/:id/assign', authorize('super_admin', 'lab_manager'), v.assign, ctrl.assign);
router.patch('/:id/health', authorize('super_admin', 'lab_manager', 'technician'), v.health, ctrl.health);
router.delete('/:id', authorize('super_admin'), ctrl.remove);

module.exports = router;