const { body } = require('express-validator');
const { validate } = require('../middleware/error');

exports.create = [
  body('equipmentType').isIn(['printer', 'projector', 'ups', 'router', 'switch', 'scanner', 'other']).withMessage('Invalid equipment type'),
  body('name').trim().isLength({ min: 2, max: 160 }).withMessage('Name required').escape(),
  body('brand').optional({ checkFalsy: true }).isLength({ max: 80 }).escape(),
  body('model').optional({ checkFalsy: true }).isLength({ max: 80 }).escape(),
  body('serialNumber').optional({ checkFalsy: true }).isLength({ max: 120 }).escape(),
  body('status').optional().isIn(['active', 'in_repair', 'retired']).withMessage('Invalid status'),
  body('laboratoryId').optional({ checkFalsy: true }).isUUID().withMessage('Invalid laboratory'),
  body('assignedTo').optional({ checkFalsy: true }).isUUID().withMessage('Invalid assignee'),
  validate,
];

exports.update = [
  body('equipmentType').optional().isIn(['printer', 'projector', 'ups', 'router', 'switch', 'scanner', 'other']),
  body('name').optional().trim().isLength({ min: 2, max: 160 }).escape(),
  body('status').optional().isIn(['active', 'in_repair', 'retired']),
  body('laboratoryId').optional({ checkFalsy: true }).isUUID(),
  validate,
];

exports.transfer = [
  body('toLabId').notEmpty().isUUID().withMessage('Destination laboratory required'),
  body('reason').optional({ checkFalsy: true }).isString().escape(),
  validate,
];