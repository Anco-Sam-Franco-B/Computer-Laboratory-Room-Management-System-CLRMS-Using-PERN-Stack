const router = require('express').Router();
const { body } = require('express-validator');
const { validate } = require('../middleware/error');
const { authenticate } = require('../middleware/auth');
const { asyncHandler } = require('../utils/helpers');
const { ok } = require('../utils/ApiResponse');
const profileService = require('../services/profileService');

router.use(authenticate);

router.put(
  '/',
  [
    body('firstName').optional().trim().isLength({ min: 2, max: 120 }).withMessage('First name must be 2-120 chars').escape(),
    body('lastName').optional().trim().isLength({ min: 2, max: 120 }).withMessage('Last name must be 2-120 chars').escape(),
    body('phone').optional({ checkFalsy: true }).isLength({ max: 30 }).withMessage('Phone too long'),
    body('avatarUrl').optional().isURL().withMessage('Invalid avatar URL'),
    validate,
  ],
  asyncHandler(async (req, res) => {
    const user = await profileService.updateProfile(req.user.id, req.body, req.user);
    res.json(ok('Profile updated.', { id: user.id, email: user.email, firstName: user.first_name, lastName: user.last_name, phone: user.phone, avatarUrl: user.avatar_url }));
  })
);

router.post(
  '/change-password',
  [
    body('currentPassword').notEmpty().withMessage('Current password required'),
    body('newPassword')
      .isLength({ min: 8 }).withMessage('Password must be at least 8 chars')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).withMessage('Password must contain upper, lower and number'),
    validate,
  ],
  asyncHandler(async (req, res) => {
    const user = await profileService.changePassword(req.user.id, req.body, req.user);
    res.json(ok('Password changed. Please log in again.', user));
  })
);

module.exports = router;