const router = require('express').Router();
const ctrl = require('../controllers/auth.controller');
const v = require('../validators/auth.validator');
const { authenticate } = require('../middleware/auth');
const { authLimiter, tokenLimiter } = require('../middleware/rateLimit');

router.post('/register', authLimiter, v.registerValidator, ctrl.register);
router.post('/login', authLimiter, v.loginValidator, ctrl.login);
router.post('/refresh', v.refreshValidator, ctrl.refresh);
router.post('/logout', v.logoutValidator, ctrl.logout);

router.get('/me', authenticate, ctrl.me);

router.get('/verify-email', v.verifyValidator, ctrl.verifyEmail);
router.post('/resend-verification', tokenLimiter, v.resendValidator, ctrl.resendVerification);

router.post('/forgot-password', tokenLimiter, v.forgotValidator, ctrl.forgotPassword);
router.post('/reset-password', tokenLimiter, v.resetValidator, ctrl.resetPassword);

module.exports = router;