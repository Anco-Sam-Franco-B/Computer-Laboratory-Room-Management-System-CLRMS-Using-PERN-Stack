const router = require('express').Router();
const ctrl = require('../controllers/attendance.controller');
const v = require('../validators/attendance.validator');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

router.get('/my', ctrl.my);
router.get('/', ctrl.listSessions);
router.post('/scan', v.checkIn, ctrl.checkInByToken);
router.get('/:id', ctrl.getSession);
router.get('/:id/records', ctrl.records);
router.get('/:id/all-students', authorize('super_admin', 'lab_manager', 'lecturer'), ctrl.allStudents);
router.post('/', authorize('super_admin', 'lab_manager', 'lecturer'), v.createSession, ctrl.createSession);
router.post('/:id/qr', authorize('super_admin', 'lab_manager', 'lecturer'), ctrl.generateQR);
router.post('/:id/check-in', v.checkIn, ctrl.checkInQR);
router.post('/:id/mark', authorize('super_admin', 'lab_manager', 'lecturer'), v.mark, ctrl.markManual);
router.post('/:id/mark-all', authorize('super_admin', 'lab_manager', 'lecturer'), v.markAll, ctrl.markAll);
router.delete('/:id', authorize('super_admin', 'lab_manager'), ctrl.deleteSession);

module.exports = router;