const visitorService = require('../services/visitorService');
const { asyncHandler } = require('../utils/helpers');
const { ok } = require('../utils/ApiResponse');
const { parseQuery } = require('../utils/pagination');

exports.list = asyncHandler(async (req, res) => {
  const q = parseQuery(req.query, {
    allowedSorts: ['created_at', 'check_in_at', 'status', 'full_name'],
    defaultSort: 'created_at',
    searchCols: ['v.full_name', 'v.email', 'v.organization', 'v.id_number'],
  });
  const result = await visitorService.listVisitors(q);
  res.json(ok('Visitors.', result.rows, result.pagination));
});

exports.get = asyncHandler(async (req, res) => {
  res.json(ok('Visitor.', await visitorService.getVisitor(req.params.id)));
});

exports.create = asyncHandler(async (req, res) => {
  const visitor = await visitorService.registerVisitor(req.body, req.user);
  res.status(201).json(ok('Visitor registered.', visitor));
});

exports.checkIn = asyncHandler(async (req, res) => {
  res.json(ok('Visitor checked in.', await visitorService.checkInVisitor(req.params.id, req.user)));
});

exports.checkOut = asyncHandler(async (req, res) => {
  res.json(ok('Visitor checked out.', await visitorService.checkOutVisitor(req.params.id, req.user)));
});

exports.deny = asyncHandler(async (req, res) => {
  res.json(ok('Visitor access denied.', await visitorService.denyVisitor(req.params.id, req.user)));
});