const computerService = require('../services/computerService');
const { asyncHandler } = require('../utils/helpers');
const { ok } = require('../utils/ApiResponse');
const { parseQuery } = require('../utils/pagination');

exports.list = asyncHandler(async (req, res) => {
  const q = parseQuery(req.query, {
    allowedSorts: ['computer_number', 'serial_number', 'status', 'health_score', 'created_at'],
    defaultSort: 'computer_number',
    searchCols: ['c.computer_number', 'c.serial_number', 'c.model', 'c.brand'],
  });
  const result = await computerService.listComputers(q);
  res.json(ok('Computers retrieved.', result.rows, result.pagination));
});

exports.get = asyncHandler(async (req, res) => {
  res.json(ok('Computer retrieved.', await computerService.getComputer(req.params.id)));
});

exports.create = asyncHandler(async (req, res) => {
  const comp = await computerService.createComputer(req.body, req.user);
  res.status(201).json(ok('Computer registered.', comp));
});

exports.update = asyncHandler(async (req, res) => {
  const comp = await computerService.updateComputer(req.params.id, req.body, req.user);
  res.json(ok('Computer updated.', comp));
});

exports.assign = asyncHandler(async (req, res) => {
  const comp = await computerService.assignToLab(req.params.id, req.body.laboratoryId, req.user);
  res.json(ok('Computer assigned to laboratory.', comp));
});

exports.health = asyncHandler(async (req, res) => {
  const comp = await computerService.updateHealth(req.params.id, req.body.healthScore, req.user);
  res.json(ok('Computer health updated.', comp));
});

exports.remove = asyncHandler(async (req, res) => {
  await computerService.deleteComputer(req.params.id, req.user);
  res.json(ok('Computer deleted.'));
});

exports.stats = asyncHandler(async (req, res) => {
  res.json(ok('Computer statistics.', await computerService.stats()));
});