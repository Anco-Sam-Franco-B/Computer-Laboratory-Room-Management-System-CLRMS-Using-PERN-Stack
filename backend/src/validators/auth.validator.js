const { body, query } = require('express-validator');
const { validate } = require('../middleware/error');

exports.registerValidator = [
  body('firstName').trim().isLength({ min: 2, max: 120 }).withMessage('First name must be 2-120 characters').escape(),
  body('lastName').trim().isLength({ min: 2, max: 120 }).withMessage('Last name must be 2-120 characters').escape(),
  body('email').isEmail().withMessage('Invalid email address').normalizeEmail(),
  body('phone').optional({ checkFalsy: true }).isLength({ max: 30 }).withMessage('Phone too long'),
  body('password')
    .isLength({ min: 8, max: 72 }).withMessage('Password must be 8-72 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).withMessage('Password must contain upper, lower and number'),
  validate,
];

exports.loginValidator = [
  body('email').isEmail().withMessage('Invalid email address').normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required'),
  validate,
];

exports.refreshValidator = [
  body('refreshToken').notEmpty().withMessage('refreshToken is required'),
  validate,
];

exports.logoutValidator = [
  body('refreshToken').optional({ checkFalsy: true }).isString(),
  validate,
];

exports.resendValidator = [
  body('email').isEmail().withMessage('Invalid email address').normalizeEmail(),
  validate,
];

exports.forgotValidator = [
  body('email').isEmail().withMessage('Invalid email address').normalizeEmail(),
  validate,
];

exports.resetValidator = [
  body('token').notEmpty().withMessage('Token is required'),
  body('newPassword')
    .isLength({ min: 8, max: 72 }).withMessage('Password must be 8-72 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).withMessage('Password must contain upper, lower and number'),
  validate,
];

exports.verifyValidator = [
  query('token').notEmpty().withMessage('Token is required'),
  validate,
];