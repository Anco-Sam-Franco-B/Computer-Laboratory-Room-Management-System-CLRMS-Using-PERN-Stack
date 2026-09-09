const jwt = require('jsonwebtoken');
const { query } = require('../config/db');
const AppError = require('../utils/AppError');

/** Verify access token from Authorization header, load fresh user+role. */
async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) throw new AppError('Authentication required. Please log in.', 401);

    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);

    const resQuery = await query(
      `SELECT u.id, u.email, u.first_name, u.last_name, u.avatar_url, u.status,
              u.department_id, r.code AS role_code, r.name AS role_name, r.permissions
       FROM users u
       JOIN roles r ON r.id = u.role_id
       WHERE u.id = $1 AND u.deleted_at IS NULL`,
      [decoded.sub]
    );

    if (resQuery.rowCount === 0) throw new AppError('User no longer exists.', 401);

    const user = resQuery.rows[0];

    if (user.status !== 'active') {
      throw new AppError(
        user.status === 'suspended' ? 'Your account has been suspended.' : 'Your account is not active.',
        403
      );
    }

    req.user = user;
    req.accessToken = token;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return next(new AppError('Session expired. Please log in again.', 401));
    }
    if (err.name === 'JsonWebTokenError') {
      return next(new AppError('Invalid session token.', 401));
    }
    next(err);
  }
}

/** Require one of the given role codes. */
function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) return next(new AppError('Unauthorized.', 401));
    if (roles.includes(req.user.role_code)) return next();
    return next(new AppError('You do not have permission to perform this action.', 403));
  };
}

module.exports = { authenticate, authorize };