const laboratoryService = require('../services/laboratoryService');
const { asyncHandler } = require('../utils/helpers');
const { ok } = require('../utils/ApiResponse');
const { parseQuery } = require('../utils/pagination');

exports.list = asyncHandler(async (req, res) => {
  const q = parseQuery(req.query, {
    allowedSorts: ['name', 'code', 'capacity', 'created_at'],
    defaultSort: 'name',
    searchCols: ['l.name', 'l.code', 'l.location'],
  });
  const result = await laboratoryService.listLabs({ ...q, role: req.user.role_code });
  res.json(ok('Laboratories retrieved.', result.rows, result.pagination));
});

exports.get = asyncHandler(async (req, res) => {
  res.json(ok('Laboratory retrieved.', await laboratoryService.getLab(req.params.id)));
});

exports.create = asyncHandler(async (req, res) => {
  const lab = await laboratoryService.createLab(req.body, req.user);
  res.status(201).json(ok('Laboratory created.', lab));
});

exports.update = asyncHandler(async (req, res) => {
  const lab = await laboratoryService.updateLab(req.params.id, req.body, req.user);
  res.json(ok('Laboratory updated.', lab));
});

exports.setStatus = asyncHandler(async (req, res) => {
  const lab = await laboratoryService.setStatus(req.params.id, req.body.status, req.user);
  res.json(ok('Laboratory status updated.', lab));
});

exports.remove = asyncHandler(async (req, res) => {
  await laboratoryService.deleteLab(req.params.id, req.user);
  res.json(ok('Laboratory deleted.'));
});

exports.availability = asyncHandler(async (req, res) => {
  const result = await laboratoryService.checkAvailability(req.params.id, req.query);
  res.json(ok('Availability check.', result));
});