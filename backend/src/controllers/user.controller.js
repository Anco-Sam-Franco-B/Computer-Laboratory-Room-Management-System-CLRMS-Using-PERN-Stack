const userService = require('../services/userService');
const { asyncHandler } = require('../utils/helpers');
const { ok } = require('../utils/ApiResponse');
const { parseQuery } = require('../utils/pagination');
const AppError = require('../utils/AppError');

exports.list = asyncHandler(async (req, res) => {
  const { page, limit, offset, sort, order, where, params, pagination } = parseQuery(req.query, {
    allowedSorts: ['created_at', 'first_name', 'email', 'last_login_at', 'status'],
    defaultSort: 'created_at',
    searchCols: ['u.email', 'u.first_name', 'u.last_name', 'u.student_id'],
  });
  const result = await userService.listUsers({
    page, limit, offset, sort, order, where, params,
  });
  // Recompute pageCount from service pagination
  res.json(ok('Users retrieved.', result.rows, result.pagination));
});

exports.get = asyncHandler(async (req, res) => {
  const user = await userService.getUser(req.params.id);
  res.json(ok('User retrieved.', user));
});

exports.create = asyncHandler(async (req, res) => {
  const user = await userService.createUser(req.body, req.user);
  res.status(201).json(ok('User created.', user));
});

exports.update = asyncHandler(async (req, res) => {
  const user = await userService.updateUser(req.params.id, req.body, req.user);
  res.json(ok('User updated.', user));
});

exports.activate = asyncHandler(async (req, res) => {
  const user = await userService.setStatus(req.params.id, 'active', req.user);
  res.json(ok('User activated.', user));
});

exports.suspend = asyncHandler(async (req, res) => {
  const user = await userService.setStatus(req.params.id, 'suspended', req.user);
  res.json(ok('User suspended.', user));
});

exports.remove = asyncHandler(async (req, res) => {
  await userService.deleteUser(req.params.id, req.user);
  res.json(ok('User deleted.'));
});

exports.activity = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
  const result = await userService.getUserLogs(req.params.id, { page, limit });
  res.json(ok('Activity logs retrieved.', result.rows, result.pagination));
});

exports.roles = asyncHandler(async (req, res) => {
  const roles = await userService.listRoles();
  res.json(ok('Roles retrieved.', roles));
});