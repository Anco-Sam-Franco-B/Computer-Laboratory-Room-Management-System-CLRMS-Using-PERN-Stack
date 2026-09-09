const maintenanceService = require('../services/maintenanceService');
const { asyncHandler } = require('../utils/helpers');
const { ok } = require('../utils/ApiResponse');
const { parseQuery } = require('../utils/pagination');

exports.list = asyncHandler(async (req, res) => {
  const q = parseQuery(req.query, {
    allowedSorts: ['created_at', 'status', 'priority', 'updated_at'],
    defaultSort: 'created_at',
    searchCols: ['mt.title', 'mt.ticket_no', 'l.name'],
  });
  const result = await maintenanceService.listTickets(q);
  res.json(ok('Maintenance tickets.', result.rows, result.pagination));
});

exports.get = asyncHandler(async (req, res) => {
  res.json(ok('Maintenance ticket.', await maintenanceService.getTicket(req.params.id)));
});

exports.updates = asyncHandler(async (req, res) => {
  res.json(ok('Maintenance updates.', await maintenanceService.listUpdates(req.params.id)));
});

exports.create = asyncHandler(async (req, res) => {
  const ticket = await maintenanceService.createTicket(req.body, req.user);
  res.status(201).json(ok('Maintenance ticket created.', ticket));
});

exports.assign = asyncHandler(async (req, res) => {
  const ticket = await maintenanceService.assignTicket(req.params.id, req.body.technicianId, req.user);
  res.json(ok('Ticket assigned.', ticket));
});

exports.progress = asyncHandler(async (req, res) => {
  const ticket = await maintenanceService.updateProgress(req.params.id, req.body, req.user);
  res.json(ok('Ticket updated.', ticket));
});

exports.addPart = asyncHandler(async (req, res) => {
  const part = await maintenanceService.addPart(req.params.id, req.body, req.user);
  res.status(201).json(ok('Part added.', part));
});

exports.setCost = asyncHandler(async (req, res) => {
  const ticket = await maintenanceService.setCost(req.params.id, req.body.cost, req.user);
  res.json(ok('Cost updated.', ticket));
});

exports.close = asyncHandler(async (req, res) => {
  const ticket = await maintenanceService.closeTicket(req.params.id, req.user);
  res.json(ok('Ticket closed.', ticket));
});