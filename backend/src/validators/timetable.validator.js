const { body } = require('express-validator');
const { validate } = require('../middleware/error');

const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

exports.createSemester = [
  body('name').trim().isLength({ min: 2, max: 120 }).withMessage('Name required').escape(),
  body('season').isIn(['spring', 'summer', 'fall', 'winter']).withMessage('Invalid season'),
  body('year').isInt({ min: 2000, max: 2100 }).withMessage('Invalid year'),
  body('startDate').isDate().withMessage('Valid start date'),
  body('endDate').isDate().withMessage('Valid end date').custom((v, { req }) => v > req.body.startDate),
  body('isActive').optional().isBoolean(),
  validate,
];

exports.createSlot = [
  body('semesterId').isUUID().withMessage('Invalid semester'),
  body('laboratoryId').isUUID().withMessage('Invalid laboratory'),
  body('lecturerId').isUUID().withMessage('Invalid lecturer'),
  body('courseCode').trim().isLength({ min: 1, max: 40 }).withMessage('Course code required').escape(),
  body('courseName').trim().isLength({ min: 2, max: 160 }).withMessage('Course name required').escape(),
  body('day').isIn(days).withMessage('Invalid day'),
  body('startTime').matches(/^([01]\d|2[0-3]):[0-5]\d$/).withMessage('Invalid start time'),
  body('endTime').matches(/^([01]\d|2[0-3]):[0-5]\d$/).withMessage('Invalid end time').custom((v, { req }) => v > req.body.startTime),
  body('sessionKind').optional().isIn(['class', 'lab', 'exam', 'workshop', 'other']),
  validate,
];

exports.updateSlot = [
  body('semesterId').optional().isUUID(),
  body('laboratoryId').optional().isUUID(),
  body('lecturerId').optional().isUUID(),
  body('courseCode').optional().trim().isLength({ max: 40 }).escape(),
  body('courseName').optional().trim().isLength({ min: 2, max: 160 }).escape(),
  body('day').optional().isIn(days),
  body('startTime').optional().matches(/^([01]\d|2[0-3]):[0-5]\d$/),
  body('endTime').optional().matches(/^([01]\d|2[0-3]):[0-5]\d$/),
  validate,
];