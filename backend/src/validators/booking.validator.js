const { body, query } = require('express-validator');
const { validate } = require('../middleware/error');

const timeChecks = [
  body('date').isDate().withMessage('Valid date required'),
  body('startTime').matches(/^([01]\d|2[0-3]):[0-5]\d$/).withMessage('Start time must be HH:MM 24h'),
  body('endTime').matches(/^([01]\d|2[0-3]):[0-5]\d$/).withMessage('End time must be HH:MM 24h').custom((v, { req }) => {
    if (v <= req.body.startTime) throw new Error('End time must be after start time');
    return true;
  }),
];

exports.create = [
  body('laboratoryId').isUUID().withMessage('Invalid laboratory'),
  body('title').trim().isLength({ min: 2, max: 200 }).withMessage('Title required').escape(),
  body('purpose').optional({ checkFalsy: true }).isString().escape(),
  body('sessionKind').optional().isIn(['class', 'lab', 'exam', 'workshop', 'other']),
  body('attendeeCount').optional().isInt({ min: 0, max: 100000 }),
  ...timeChecks,
  validate,
];

exports.approve = [body('note').optional({ checkFalsy: true }).isString().escape(), validate];
exports.reject = [body('reason').optional({ checkFalsy: true }).isString().escape(), validate];

exports.conflicts = [
  query('laboratoryId').isUUID().withMessage('Invalid laboratory'),
  query('date').isDate().withMessage('Valid date required'),
  query('startTime').matches(/^([01]\d|2[0-3]):[0-5]\d$/).withMessage('Invalid start time'),
  query('endTime').matches(/^([01]\d|2[0-3]):[0-5]\d$/).withMessage('Invalid end time'),
  validate,
];