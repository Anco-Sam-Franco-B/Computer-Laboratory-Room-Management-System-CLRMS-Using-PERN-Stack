const router = require('express').Router();
const ctrl = require('../controllers/incident.controller');
const v = require('../validators/incident.validator');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

router.get('/', ctrl.list);
router.get('/:id', ctrl.get);
router.post('/', v.create, ctrl.create);
router.patch('/:id', authorize('super_admin', 'lab_manager', 'technician'), v.update, ctrl.update);
router.delete('/:id', authorize('super_admin', 'lab_manager'), ctrl.remove);

module.exports = router;