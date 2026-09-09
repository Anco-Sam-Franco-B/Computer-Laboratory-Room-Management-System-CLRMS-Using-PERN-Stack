const { validationResult } = require('express-validator');
const AppError = require('../utils/AppError');

/** Runs validation; collects all errors and surfaces the first one nicely. */
function validate(req, res, next) {
  const errors = validationResult(req);
  if (errors.isEmpty()) return next();

  const first = errors.array({ onlyFirstError: true })[0];
  const details = errors.array().map((e) => ({ field: e.path, message: e.msg }));
  return next(new AppError(first.msg, 422, details));
}

/** Not-found fallback → 404, not a 500. */
function notFound(req, res, next) {
  next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404));
}

/** Package validation error from failed JSON body. */
function bodyParserError(err, req, res, next) {
  if (err.type === 'entity.parse.failed') {
    return next(new AppError('Invalid JSON in request body.', 400));
  }
  next(err);
}

/** Global error handler — always returns the standard envelope. */
function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || 500;
  const message = statusCode === 500 ? 'Internal server error' : err.message;

  if (err.code === '23505') {
    // unique_violation → friendly message
    return res.status(409).json({
      success: false,
      message: `A record with that value already exists (${err.constraint || 'unique constraint'}).`,
    });
  }
  if (err.code === '23503') {
    return res.status(409).json({ success: false, message: 'This record is referenced by other data and cannot be updated/deleted.' });
  }
  if (err.code === '22P02' || err.code === '23514') {
    return res.status(422).json({ success: false, message: 'Invalid value provided.', details: err.message });
  }

  console.error(`[${statusCode}]`, err);

  res.status(statusCode).json({
    success: false,
    message,
    details: err.details || null,
    ...(statusCode === 500 ? { error: process.env.NODE_ENV === 'development' ? err.message : undefined } : {}),
  });
}

module.exports = { validate, notFound, bodyParserError, errorHandler };