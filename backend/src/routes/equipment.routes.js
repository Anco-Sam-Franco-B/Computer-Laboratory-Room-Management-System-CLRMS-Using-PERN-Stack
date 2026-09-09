const router = require('express').Router();
const ctrl = require('../controllers/equipment.controller');
const v = require('../validators/equipment.validator');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

router.get('/', ctrl.list);
router.get('/:id', ctrl.get);
router.get('/:id/transfers', ctrl.transfers);
router.post('/', authorize('super_admin', 'lab_manager'), v.create, ctrl.create);
router.patch('/:id', authorize('super_admin', 'lab_manager', 'technician'), v.update, ctrl.update);
router.post('/:id/transfer', authorize('super_admin', 'lab_manager'), v.transfer, ctrl.transfer);
router.delete('/:id', authorize('super_admin'), ctrl.remove);

module.exports = router;