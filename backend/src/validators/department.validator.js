const { body } = require('express-validator');
const { validate } = require('../middleware/error');

exports.create = [
  body('name').trim().isLength({ min: 2, max: 120 }).withMessage('Name required').escape(),
  body('code').trim().isLength({ min: 2, max: 20 }).withMessage('Code required').toUpperCase().escape(),
  body('description').optional({ checkFalsy: true }).isString().escape(),
  body('managerId').optional({ checkFalsy: true }).isUUID().withMessage('Invalid manager'),
  body('color').optional().matches(/^#[0-9a-fA-F]{6}$/).withMessage('Invalid color'),
  validate,
];

exports.update = [
  body('name').optional().trim().isLength({ min: 2, max: 120 }).withMessage('Name required').escape(),
  body('code').optional().trim().isLength({ min: 2, max: 20 }).withMessage('Code required').toUpperCase().escape(),
  body('managerId').optional({ checkFalsy: true }).isUUID().withMessage('Invalid manager'),
  body('description').optional({ checkFalsy: true }).isString().escape(),
  body('color').optional().matches(/^#[0-9a-fA-F]{6}$/).withMessage('Invalid color'),
  validate,
];