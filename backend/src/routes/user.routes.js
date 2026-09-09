const router = require('express').Router();
const ctrl = require('../controllers/user.controller');
const v = require('../validators/user.validator');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

router.get('/roles', ctrl.roles);
router.get('/', authorize('super_admin', 'lab_manager'), ctrl.list);
router.get('/:id/activity', authorize('super_admin'), ctrl.activity);
router.get('/:id', authorize('super_admin', 'lab_manager'), ctrl.get);
router.post('/', authorize('super_admin'), v.create, ctrl.create);
router.patch('/:id', authorize('super_admin'), v.update, ctrl.update);
router.patch('/:id/activate', authorize('super_admin'), ctrl.activate);
router.patch('/:id/suspend', authorize('super_admin'), ctrl.suspend);
router.delete('/:id', authorize('super_admin'), ctrl.remove);

module.exports = router;