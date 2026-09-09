const { body } = require('express-validator');
const { validate } = require('../middleware/error');

exports.create = [
  body('name').trim().isLength({ min: 2, max: 120 }).withMessage('Name required').escape(),
  body('code').trim().isLength({ min: 2, max: 20 }).withMessage('Code required').toUpperCase().escape(),
  body('location').optional({ checkFalsy: true }).isLength({ max: 200 }).withMessage('Location too long').escape(),
  body('capacity').optional().isInt({ min: 0, max: 10000 }).withMessage('Invalid capacity'),
  body('status').optional().isIn(['active', 'maintenance', 'closed']).withMessage('Invalid status'),
  body('departmentId').optional({ checkFalsy: true }).isUUID().withMessage('Invalid department'),
  body('labManagerId').optional({ checkFalsy: true }).isUUID().withMessage('Invalid manager'),
  validate,
];

exports.update = [
  body('name').optional().trim().isLength({ min: 2, max: 120 }).escape(),
  body('code').optional().trim().isLength({ min: 2, max: 20 }).toUpperCase().escape(),
  body('location').optional({ checkFalsy: true }).isLength({ max: 200 }).escape(),
  body('capacity').optional().isInt({ min: 0, max: 10000 }),
  body('status').optional().isIn(['active', 'maintenance', 'closed']),
  body('departmentId').optional({ checkFalsy: true }).isUUID(),
  body('labManagerId').optional({ checkFalsy: true }).isUUID(),
  validate,
];

exports.status = [
  body('status').isIn(['active', 'maintenance', 'closed']).withMessage('Invalid status'),
  validate,
];