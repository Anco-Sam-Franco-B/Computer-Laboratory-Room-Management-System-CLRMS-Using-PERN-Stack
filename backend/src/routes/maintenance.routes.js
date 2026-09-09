const router = require('express').Router();
const ctrl = require('../controllers/maintenance.controller');
const v = require('../validators/maintenance.validator');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

router.get('/', ctrl.list);
router.get('/:id', ctrl.get);
router.get('/:id/updates', ctrl.updates);
router.post('/', v.create, ctrl.create);
router.post('/:id/assign', authorize('super_admin', 'lab_manager', 'technician'), v.assign, ctrl.assign);
router.patch('/:id/progress', authorize('super_admin', 'lab_manager', 'technician'), v.progress, ctrl.progress);
router.post('/:id/parts', authorize('super_admin', 'lab_manager', 'technician'), v.part, ctrl.addPart);
router.patch('/:id/cost', authorize('super_admin', 'lab_manager'), v.cost, ctrl.setCost);
router.post('/:id/close', authorize('super_admin', 'lab_manager', 'technician'), ctrl.close);

module.exports = router;