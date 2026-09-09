const { body } = require('express-validator');
const { validate } = require('../middleware/error');

exports.create = [
  body('fullName').trim().isLength({ min: 2, max: 160 }).withMessage('Full name required').escape(),
  body('email').optional({ checkFalsy: true }).isEmail().normalizeEmail(),
  body('phone').optional({ checkFalsy: true }).isLength({ max: 30 }).escape(),
  body('idNumber').optional({ checkFalsy: true }).isLength({ max: 60 }).escape(),
  body('organization').optional({ checkFalsy: true }).isLength({ max: 160 }).escape(),
  body('purpose').trim().isLength({ min: 3 }).withMessage('Purpose required').escape(),
  body('hostUserId').optional({ checkFalsy: true }).isUUID(),
  body('laboratoryId').optional({ checkFalsy: true }).isUUID(),
  validate,
];