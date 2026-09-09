const departmentService = require('../services/departmentService');
const { asyncHandler } = require('../utils/helpers');
const { ok } = require('../utils/ApiResponse');
const { parseQuery } = require('../utils/pagination');
const { query } = require('../config/db');

exports.list = asyncHandler(async (req, res) => {
  const q = parseQuery(req.query, {
    allowedSorts: ['name', 'created_at'], defaultSort: 'name', searchCols: ['d.name', 'd.code'],
  });
  const result = await departmentService.listDepartments(q);
  res.json(ok('Departments retrieved.', result.rows, result.pagination));
});

exports.get = asyncHandler(async (req, res) => {
  res.json(ok('Department retrieved.', await departmentService.getDepartment(req.params.id)));
});

exports.create = asyncHandler(async (req, res) => {
  const dept = await departmentService.createDepartment(req.body, req.user);
  res.status(201).json(ok('Department created.', dept));
});

exports.update = asyncHandler(async (req, res) => {
  const dept = await departmentService.updateDepartment(req.params.id, req.body, req.user);
  res.json(ok('Department updated.', dept));
});

exports.remove = asyncHandler(async (req, res) => {
  await departmentService.deleteDepartment(req.params.id, req.user);
  res.json(ok('Department deleted.'));
});

exports.stats = asyncHandler(async (req, res) => {
  res.json(ok('Department statistics.', await departmentService.departmentStats(req.params.id)));
});

exports.allStats = asyncHandler(async (req, res) => {
  const r = await query(
    `SELECT d.id, d.name, d.code, d.color,
        count(DISTINCT l.id) AS laboratories,
        count(DISTINCT u.id) AS users,
        count(DISTINCT c.id) AS computers
     FROM departments d
     LEFT JOIN laboratories l ON l.department_id = d.id AND l.deleted_at IS NULL
     LEFT JOIN users u ON u.department_id = d.id AND u.deleted_at IS NULL
     LEFT JOIN computers c ON c.laboratory_id = l.id AND c.deleted_at IS NULL
     WHERE d.deleted_at IS NULL
     GROUP BY d.id ORDER BY d.name`
  );
  res.json(ok('Department statistics.', r.rows));
});