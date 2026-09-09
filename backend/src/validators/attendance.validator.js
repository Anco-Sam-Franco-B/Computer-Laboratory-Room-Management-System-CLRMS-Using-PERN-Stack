const { body } = require('express-validator');
const { validate } = require('../middleware/error');

exports.createSession = [
  body('laboratoryId').isUUID().withMessage('Invalid laboratory'),
  body('bookingId').optional({ checkFalsy: true }).isUUID(),
  body('topic').trim().isLength({ min: 2, max: 200 }).withMessage('Topic required').escape(),
  body('sessionDate').optional().isDate(),
  body('startsAt').optional().matches(/^([01]\d|2[0-3]):[0-5]\d$/),
  body('endsAt').optional().matches(/^([01]\d|2[0-3]):[0-5]\d$/),
  validate,
];

exports.mark = [
  body('records').isArray({ min: 1 }).withMessage('records array required'),
  body('records.*.userId').isUUID().withMessage('Invalid user'),
  body('records.*.status').optional().isIn(['present', 'absent', 'late', 'excused']).withMessage('Invalid status'),
  validate,
];

exports.markAll = [
  body('status').isIn(['absent', 'excused']).withMessage('Invalid bulk status'),
  validate,
];

exports.checkIn = [
  body('qrToken').notEmpty().withMessage('qrToken required'),
  validate,
];