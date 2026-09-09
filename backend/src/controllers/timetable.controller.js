const timetableService = require('../services/timetableService');
const { asyncHandler } = require('../utils/helpers');
const { ok } = require('../utils/ApiResponse');

exports.weekly = asyncHandler(async (req, res) => {
  const schedule = await timetableService.weeklySchedule({
    laboratoryId: req.query.laboratoryId || null,
    semesterId: req.query.semesterId || null,
  });
  res.json(ok('Weekly schedule.', schedule));
});

exports.listSlots = asyncHandler(async (req, res) => {
  const result = await timetableService.listSlots({ where: '', params: [] });
  res.json(ok('Timetable slots.', result.rows, result.pagination));
});

exports.listSemesters = asyncHandler(async (req, res) => {
  res.json(ok('Semesters.', await timetableService.listSemesters()));
});

exports.getSemester = asyncHandler(async (req, res) => {
  res.json(ok('Semester.', await timetableService.getSemester(req.params.id)));
});

exports.createSemester = asyncHandler(async (req, res) => {
  const s = await timetableService.createSemester(req.body, req.user);
  res.status(201).json(ok('Semester created.', s));
});

exports.deleteSemester = asyncHandler(async (req, res) => {
  await timetableService.deleteSemester(req.params.id, req.user);
  res.json(ok('Semester deleted.'));
});

exports.createSlot = asyncHandler(async (req, res) => {
  const s = await timetableService.createSlot(req.body, req.user);
  res.status(201).json(ok('Timetable slot created.', s));
});

exports.updateSlot = asyncHandler(async (req, res) => {
  const s = await timetableService.updateSlot(req.params.id, req.body, req.user);
  res.json(ok('Timetable slot updated.', s));
});

exports.deleteSlot = asyncHandler(async (req, res) => {
  await timetableService.deleteSlot(req.params.id, req.user);
  res.json(ok('Timetable slot deleted.'));
});