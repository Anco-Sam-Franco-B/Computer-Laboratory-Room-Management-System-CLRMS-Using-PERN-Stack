const { body } = require('express-validator');
const { validate } = require('../middleware/error');

exports.create = [
  body('firstName').trim().isLength({ min: 2, max: 120 }).withMessage('First name required').escape(),
  body('lastName').trim().isLength({ min: 2, max: 120 }).withMessage('Last name required').escape(),
  body('email').isEmail().withMessage('Invalid email').normalizeEmail(),
  body('roleCode')
    .isIn(['super_admin', 'lab_manager', 'technician', 'lecturer', 'student'])
    .withMessage('Invalid role'),
  body('phone').optional({ checkFalsy: true }).isLength({ max: 30 }).withMessage('Phone too long'),
  body('studentId').optional({ checkFalsy: true }).isLength({ max: 40 }).withMessage('Student ID too long'),
  body('departmentId').optional({ checkFalsy: true }).isUUID().withMessage('Invalid department'),
  body('status').optional().isIn(['active', 'suspended', 'pending']).withMessage('Invalid status'),
  validate,
];

exports.update = [
  body('firstName').optional().trim().isLength({ min: 2, max: 120 }).withMessage('First name must be 2-120 chars').escape(),
  body('lastName').optional().trim().isLength({ min: 2, max: 120 }).withMessage('Last name must be 2-120 chars').escape(),
  body('email').optional().isEmail().withMessage('Invalid email').normalizeEmail(),
  body('roleCode').optional().isIn(['super_admin', 'lab_manager', 'technician', 'lecturer', 'student']).withMessage('Invalid role'),
  body('studentId').optional({ checkFalsy: true }).isLength({ max: 40 }).withMessage('Student ID too long'),
  body('departmentId').optional({ checkFalsy: true }).isUUID().withMessage('Invalid department'),
  body('status').optional().isIn(['active', 'suspended', 'pending']).withMessage('Invalid status'),
  body('password').optional().isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  validate,
];