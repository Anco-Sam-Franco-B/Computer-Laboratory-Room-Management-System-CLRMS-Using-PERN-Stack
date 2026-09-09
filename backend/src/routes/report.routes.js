const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { asyncHandler } = require('../utils/helpers');
const { ok } = require('../utils/ApiResponse');
const reportService = require('../services/reportService');

router.use(authenticate);

router.get(
  '/types',
  asyncHandler(async (req, res) => {
    res.json(ok('Report types.', reportService.REPORT_TYPES.map((t) => ({ type: t, ...reportService.BUILDER_MAP[t] }))));
  })
);

// JSON
router.get(
  '/:type',
  asyncHandler(async (req, res) => {
    const report = await reportService.buildReport(req.params.type, req.query);
    res.json(ok('Report generated.', report));
  })
);

// CSV / Excel / PDF exports
router.get(
  '/:type/export',
  asyncHandler(async (req, res) => {
    const { type } = req.params;
    const format = (req.query.format || 'csv').toLowerCase();
    const report = await reportService.buildReport(type, req.query);

    const display = req.query.filename || `${type}-report-${new Date().toISOString().slice(0, 10)}`;
    const ext = reportService.FILE_EXT[format] || 'csv';
    res.setHeader('Content-Type', reportService.CONTENT_TYPES[format] || reportService.CONTENT_TYPES.csv);
    res.setHeader('Content-Disposition', `attachment; filename="${display}.${ext}"`);

    if (format === 'csv') return res.send(reportService.toCSV(report.columns, report.rows));
    if (format === 'excel' || format === 'xlsx') {
      const buf = await reportService.toExcel(report);
      return res.send(buf);
    }
    if (format === 'pdf') {
      const buf = await reportService.toPDF(report);
      return res.send(buf);
    }
    return res.json(report);
  })
);

module.exports = router;