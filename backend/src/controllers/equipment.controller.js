const equipmentService = require('../services/equipmentService');
const { asyncHandler } = require('../utils/helpers');
const { ok } = require('../utils/ApiResponse');
const { parseQuery } = require('../utils/pagination');

exports.list = asyncHandler(async (req, res) => {
  const q = parseQuery(req.query, {
    allowedSorts: ['name', 'equipment_type', 'status', 'purchase_date', 'created_at'],
    defaultSort: 'name',
    searchCols: ['e.name', 'e.brand', 'e.model', 'e.serial_number'],
  });
  const result = await equipmentService.listEquipment(q);
  res.json(ok('Equipment retrieved.', result.rows, result.pagination));
});

exports.get = asyncHandler(async (req, res) => {
  res.json(ok('Equipment retrieved.', await equipmentService.getEquipment(req.params.id)));
});

exports.create = asyncHandler(async (req, res) => {
  const item = await equipmentService.createEquipment(req.body, req.user);
  res.status(201).json(ok('Equipment registered.', item));
});

exports.update = asyncHandler(async (req, res) => {
  const item = await equipmentService.updateEquipment(req.params.id, req.body, req.user);
  res.json(ok('Equipment updated.', item));
});

exports.transfer = asyncHandler(async (req, res) => {
  const item = await equipmentService.transferEquipment(req.params.id, req.body, req.user);
  res.json(ok('Equipment transferred.', item));
});

exports.transfers = asyncHandler(async (req, res) => {
  const list = await equipmentService.listTransfers(req.params.id);
  res.json(ok('Transfer history.', list));
});

exports.remove = asyncHandler(async (req, res) => {
  await equipmentService.deleteEquipment(req.params.id, req.user);
  res.json(ok('Equipment deleted.'));
});