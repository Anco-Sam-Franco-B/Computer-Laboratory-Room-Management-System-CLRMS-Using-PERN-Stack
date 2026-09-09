const authService = require('../services/authService');
const { asyncHandler } = require('../utils/helpers');
const { ok } = require('../utils/ApiResponse');

const clientIp = (req) => req.ip || req.connection?.remoteAddress || null;

exports.register = asyncHandler(async (req, res) => {
  const result = await authService.register(req.body);
  res.status(201).json(ok(result.message, { userId: result.userId }));
});

exports.login = asyncHandler(async (req, res) => {
  const result = await authService.login({
    ...req.body,
    ipAddress: clientIp(req),
    userAgent: req.headers['user-agent'],
  });
  res.json(ok('Login successful.', result));
});

exports.refresh = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  const result = await authService.refresh({
    refreshToken,
    ipAddress: clientIp(req),
    userAgent: req.headers['user-agent'],
  });
  res.json(ok('Token refreshed.', result));
});

exports.logout = asyncHandler(async (req, res) => {
  await authService.logout({ refreshToken: req.body.refreshToken });
  res.json(ok('Logged out successfully.'));
});

exports.me = asyncHandler(async (req, res) => {
  const user = await authService.publicUser(req.user);
  res.json(ok('Current user.', user));
});

exports.verifyEmail = asyncHandler(async (req, res) => {
  const result = await authService.verifyEmail({ token: req.query.token });
  res.json(ok(result.message));
});

exports.resendVerification = asyncHandler(async (req, res) => {
  const result = await authService.resendVerification(req.body);
  res.json(ok(result.message));
});

exports.forgotPassword = asyncHandler(async (req, res) => {
  const result = await authService.forgotPassword(req.body);
  res.json(ok(result.message));
});

exports.resetPassword = asyncHandler(async (req, res) => {
  const result = await authService.resetPassword(req.body);
  res.json(ok(result.message));
});