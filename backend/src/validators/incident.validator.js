const { body } = require('express-validator');
const { validate } = require('../middleware/error');

exports.create = [
  body('type').isIn(['hardware', 'network', 'software', 'security', 'other']).withMessage('Invalid type'),
  body('title').trim().isLength({ min: 2, max: 200 }).withMessage('Title required').escape(),
  body('description').trim().isLength({ min: 5 }).withMessage('Description required').escape(),
  body('priority').optional().isIn(['low', 'medium', 'high', 'critical']).withMessage('Invalid priority'),
  body('laboratoryId').optional({ checkFalsy: true }).isUUID(),
  body('computerId').optional({ checkFalsy: true }).isUUID(),
  validate,
];

exports.update = [
  body('type').optional().isIn(['hardware', 'network', 'software', 'security', 'other']),
  body('title').optional().trim().isLength({ min: 2, max: 200 }).escape(),
  body('description').optional().trim().isLength({ min: 5 }).escape(),
  body('priority').optional().isIn(['low', 'medium', 'high', 'critical']),
  body('status').optional().isIn(['open', 'assigned', 'in_progress', 'resolved', 'closed']),
  body('assignedTo').optional({ checkFalsy: true }).isUUID(),
  body('resolution').optional({ checkFalsy: true }).isString().escape(),
  validate,
];