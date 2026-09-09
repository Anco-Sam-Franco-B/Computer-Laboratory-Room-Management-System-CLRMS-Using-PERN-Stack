const router = require('express').Router();
const ctrl = require('../controllers/timetable.controller');
const v = require('../validators/timetable.validator');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

// weekly schedule grid
router.get('/weekly', ctrl.weekly);

// semesters
router.get('/semesters', ctrl.listSemesters);
router.get('/semesters/:id', ctrl.getSemester);
router.post('/semesters', authorize('super_admin'), v.createSemester, ctrl.createSemester);
router.delete('/semesters/:id', authorize('super_admin'), ctrl.deleteSemester);

// slots
router.get('/slots', ctrl.listSlots);
router.post('/slots', authorize('super_admin', 'lab_manager'), v.createSlot, ctrl.createSlot);
router.patch('/slots/:id', authorize('super_admin', 'lab_manager'), v.updateSlot, ctrl.updateSlot);
router.delete('/slots/:id', authorize('super_admin', 'lab_manager'), ctrl.deleteSlot);

module.exports = router;