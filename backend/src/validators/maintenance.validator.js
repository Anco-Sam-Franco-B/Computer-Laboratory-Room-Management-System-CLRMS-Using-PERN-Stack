const { body } = require('express-validator');
const { validate } = require('../middleware/error');

exports.create = [
  body('title').trim().isLength({ min: 2, max: 200 }).withMessage('Title required').escape(),
  body('description').trim().isLength({ min: 5 }).withMessage('Description required').escape(),
  body('targetType').optional().isIn(['computer', 'equipment', 'lab', 'other']).withMessage('Invalid target'),
  body('computerId').optional({ checkFalsy: true }).isUUID(),
  body('equipmentId').optional({ checkFalsy: true }).isUUID(),
  body('laboratoryId').optional({ checkFalsy: true }).isUUID(),
  body('priority').optional().isIn(['low', 'medium', 'high', 'critical']).withMessage('Invalid priority'),
  validate,
];

exports.assign = [
  body('technicianId').isUUID().withMessage('Technician required'),
  validate,
];

exports.progress = [
  body('status').isIn(['open', 'in_progress', 'resolved', 'closed']).withMessage('Invalid status'),
  body('note').optional({ checkFalsy: true }).isString().escape(),
  body('costAddition').optional().isFloat({ min: 0 }).withMessage('Invalid cost'),
  validate,
];

exports.part = [
  body('partName').trim().isLength({ min: 2, max: 160 }).withMessage('Part name required').escape(),
  body('quantity').optional().isInt({ min: 1, max: 1000 }),
  body('unitCost').optional().isFloat({ min: 0 }),
  validate,
];

exports.cost = [
  body('cost').isFloat({ min: 0 }).withMessage('Invalid cost'),
  validate,
];