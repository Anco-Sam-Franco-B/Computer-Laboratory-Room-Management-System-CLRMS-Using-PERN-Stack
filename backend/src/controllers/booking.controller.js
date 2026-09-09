const bookingService = require('../services/bookingService');
const { asyncHandler } = require('../utils/helpers');
const { ok } = require('../utils/ApiResponse');
const { parseQuery } = require('../utils/pagination');
const AppError = require('../utils/AppError');

exports.list = asyncHandler(async (req, res) => {
  const q = parseQuery(req.query, {
    allowedSorts: ['date', 'created_at', 'status', 'start_time'],
    defaultSort: 'date',
    searchCols: ['b.title', 'l.name', 'l.code'],
  });
  const result = await bookingService.listBookings({ ...q });
  res.json(ok('Bookings retrieved.', result.rows, result.pagination));
});

exports.get = asyncHandler(async (req, res) => {
  res.json(ok('Booking retrieved.', await bookingService.getBooking(req.params.id)));
});

exports.create = asyncHandler(async (req, res) => {
  const booking = await bookingService.createBooking(req.body, req.user);
  res.status(201).json(ok('Booking requested.', booking));
});

exports.approve = asyncHandler(async (req, res) => {
  const booking = await bookingService.approveBooking(req.params.id, req.user, req.body.note);
  res.json(ok('Booking approved.', booking));
});

exports.reject = asyncHandler(async (req, res) => {
  const booking = await bookingService.rejectBooking(req.params.id, req.user, req.body.reason);
  res.json(ok('Booking rejected.', booking));
});

exports.cancel = asyncHandler(async (req, res) => {
  const booking = await bookingService.cancelBooking(req.params.id, req.user);
  res.json(ok('Booking cancelled.', booking));
});

exports.complete = asyncHandler(async (req, res) => {
  const booking = await bookingService.completeBooking(req.params.id, req.user);
  res.json(ok('Booking completed.', booking));
});

exports.checkIn = asyncHandler(async (req, res) => {
  const booking = await bookingService.checkIn(req.params.id, req.user);
  res.json(ok('Checked in.', booking));
});

exports.conflicts = asyncHandler(async (req, res) => {
  const conflicts = await bookingService.detectConflicts(req.query);
  res.json(ok('Conflict check.', conflicts));
});

exports.remove = asyncHandler(async (req, res) => {
  await bookingService.deleteBooking(req.params.id, req.user);
  res.json(ok('Booking deleted.'));
});