const incidentService = require('../services/incidentService');
const { asyncHandler } = require('../utils/helpers');
const { ok } = require('../utils/ApiResponse');
const { parseQuery } = require('../utils/pagination');

exports.list = asyncHandler(async (req, res) => {
  const q = parseQuery(req.query, {
    allowedSorts: ['created_at', 'status', 'priority', 'type', 'updated_at'],
    defaultSort: 'created_at',
    searchCols: ['i.title', 'i.incident_no', 'l.name'],
  });
  const result = await incidentService.listIncidents(q);
  res.json(ok('Incidents.', result.rows, result.pagination));
});

exports.get = asyncHandler(async (req, res) => {
  res.json(ok('Incident.', await incidentService.getIncident(req.params.id)));
});

exports.create = asyncHandler(async (req, res) => {
  const incident = await incidentService.createIncident(req.body, req.user);
  res.status(201).json(ok('Incident reported.', incident));
});

exports.update = asyncHandler(async (req, res) => {
  const incident = await incidentService.updateIncident(req.params.id, req.body, req.user);
  res.json(ok('Incident updated.', incident));
});

exports.remove = asyncHandler(async (req, res) => {
  await incidentService.deleteIncident(req.params.id, req.user);
  res.json(ok('Incident deleted.'));
});