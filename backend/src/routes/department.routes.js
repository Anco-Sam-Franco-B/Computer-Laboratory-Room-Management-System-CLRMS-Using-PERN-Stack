const router = require('express').Router();
const ctrl = require('../controllers/department.controller');
const v = require('../validators/department.validator');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

router.get('/', ctrl.list);
router.get('/stats', ctrl.allStats); // aggregate stats for all departments
router.get('/:id', ctrl.get);
router.get('/:id/stats', ctrl.stats);
router.post('/', authorize('super_admin'), v.create, ctrl.create);
router.patch('/:id', authorize('super_admin'), v.update, ctrl.update);
router.delete('/:id', authorize('super_admin'), ctrl.remove);

module.exports = router;