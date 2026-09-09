const { body } = require('express-validator');
const { validate } = require('../middleware/error');

exports.create = [
  body('computerNumber').trim().isLength({ min: 2, max: 40 }).withMessage('Computer number required').escape(),
  body('serialNumber').optional({ checkFalsy: true }).isLength({ max: 120 }).escape(),
  body('brand').optional({ checkFalsy: true }).isLength({ max: 80 }).escape(),
  body('model').optional({ checkFalsy: true }).isLength({ max: 80 }).escape(),
  body('processor').optional({ checkFalsy: true }).isLength({ max: 120 }).escape(),
  body('ramGb').optional().isInt({ min: 1, max: 2048 }).withMessage('Invalid RAM'),
  body('storageGb').optional().isInt({ min: 8, max: 100000 }).withMessage('Invalid storage'),
  body('storageType').optional().isIn(['HDD', 'SSD', 'NVMe']).withMessage('Invalid storage type'),
  body('os').optional().isLength({ max: 80 }).escape(),
  body('status').optional().isIn(['active', 'maintenance', 'broken', 'retired']).withMessage('Invalid status'),
  body('laboratoryId').optional({ checkFalsy: true }).isUUID().withMessage('Invalid laboratory'),
  body('macAddress').optional({ checkFalsy: true }).isLength({ max: 17 }).escape(),
  validate,
];

exports.update = [
  body('computerNumber').optional().trim().isLength({ min: 2, max: 40 }).escape(),
  body('serialNumber').optional({ checkFalsy: true }).isLength({ max: 120 }).escape(),
  body('ramGb').optional().isInt({ min: 1, max: 2048 }),
  body('storageGb').optional().isInt({ min: 8, max: 100000 }),
  body('storageType').optional().isIn(['HDD', 'SSD', 'NVMe']),
  body('status').optional().isIn(['active', 'maintenance', 'broken', 'retired']),
  body('laboratoryId').optional({ checkFalsy: true }).isUUID(),
  body('os').optional().isLength({ max: 80 }).escape(),
  validate,
];

exports.assign = [
  body('laboratoryId').optional({ checkFalsy: true }).isUUID().withMessage('Invalid laboratory'),
  validate,
];

exports.health = [
  body('healthScore').isInt({ min: 0, max: 100 }).withMessage('Health score must be 0-100'),
  validate,
];