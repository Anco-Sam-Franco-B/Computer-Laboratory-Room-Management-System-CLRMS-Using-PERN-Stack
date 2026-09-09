const attendanceService = require('../services/attendanceService');
const { asyncHandler } = require('../utils/helpers');
const { ok } = require('../utils/ApiResponse');

exports.my = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = Math.min(parseInt(req.query.limit, 10) || 30, 100);
  const result = await attendanceService.myAttendance(req.user.id, { page, limit });
  res.json(ok('My attendance.', result.rows, result.pagination));
});

exports.listSessions = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
  const result = await attendanceService.listSessions({ page, limit });
  res.json(ok('Attendance sessions.', result.rows, result.pagination));
});

exports.getSession = asyncHandler(async (req, res) => {
  res.json(ok('Attendance session.', await attendanceService.getSession(req.params.id)));
});

exports.records = asyncHandler(async (req, res) => {
  const records = await attendanceService.listRecords(req.params.id);
  res.json(ok('Attendance records.', records));
});

exports.allStudents = asyncHandler(async (req, res) => {
  const students = await attendanceService.allStudents();
  res.json(ok('Students.', students));
});

exports.createSession = asyncHandler(async (req, res) => {
  const session = await attendanceService.createSession(req.body, req.user);
  res.status(201).json(ok('Attendance session created.', session));
});

exports.generateQR = asyncHandler(async (req, res) => {
  const minutes = parseInt(req.query.minutes, 10) || 60;
  const result = await attendanceService.generateQR(req.params.id, req.user, minutes);
  res.json(ok('QR code generated.', result));
});

exports.checkInQR = asyncHandler(async (req, res) => {
  const result = await attendanceService.checkInQR(req.params.id, req.body, req.user);
  res.json(ok('Checked in successfully.', result));
});

exports.checkInByToken = asyncHandler(async (req, res) => {
  const result = await attendanceService.checkInByToken(req.body, req.user);
  res.json(ok('Checked in successfully.', result));
});

exports.markManual = asyncHandler(async (req, res) => {
  const result = await attendanceService.markManual(req.params.id, req.body, req.user);
  res.json(ok('Attendance recorded.', result));
});

exports.markAll = asyncHandler(async (req, res) => {
  const result = await attendanceService.markAll(req.params.id, req.body, req.user);
  res.json(ok('Bulk attendance updated.', result));
});

exports.deleteSession = asyncHandler(async (req, res) => {
  await attendanceService.deleteSession(req.params.id, req.user);
  res.json(ok('Attendance session deleted.'));
});