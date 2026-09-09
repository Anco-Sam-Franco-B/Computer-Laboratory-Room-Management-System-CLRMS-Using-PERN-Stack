const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { pool, query, withTransaction } = require('../config/db');
const AppError = require('../utils/AppError');
const { generateTokenBytes, hashToken } = require('../utils/helpers');
const { audit } = require('../utils/auditHelper');
const templates = require('../mailers/templates');
const logger = require('../utils/logger');

/** Look up settings values from DB. */
async function getSetting(key, fallback) {
  const res = await query('SELECT value FROM system_settings WHERE key=$1', [key]);
  if (res.rowCount === 0) return fallback;
  try { return JSON.parse(res.rows[0].value); } catch (e) { return res.rows[0].value; }
}

function signAccessToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role_code },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: process.env.ACCESS_TOKEN_TTL || '15m' }
  );
}

/** Store a fresh refresh token (rotated). Returns { rawToken, family, row }. */
async function issueRefreshToken({ userId, ipAddress, userAgent }) {
  const rawToken = crypto.randomBytes(48).toString('hex');
  const tokenHash = hashToken(rawToken);
  const family = crypto.randomUUID();
  const days = parseInt(await getSetting('security.session_days', 7), 10);
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

  const res = await query(
    `INSERT INTO refresh_tokens (user_id, token_hash, family, user_agent, ip_address, expires_at)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, family, expires_at`,
    [userId, tokenHash, family, userAgent, ipAddress || null, expiresAt]
  );
  return { rawToken, family: res.rows[0].family, row: res.rows[0] };
}

async function revokeRefreshToken(tokenHash) {
  await query('UPDATE refresh_tokens SET revoked_at = now() WHERE token_hash = $1', [tokenHash]);
}

function publicUser(row) {
  return {
    id: row.id,
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    avatarUrl: row.avatar_url,
    roleCode: row.role_code,
    roleName: row.role_name,
    departmentId: row.department_id,
    status: row.status,
  };
}

// ─────────────────────────────── REGISTER ───────────────────────────────
async function register({ email, password, firstName, lastName, phone }) {
  const role = await query('SELECT id FROM roles WHERE code=$1', ['student']);
  if (role.rowCount === 0) throw new AppError('Default role missing.', 500);

  const passwordHash = await bcrypt.hash(password, parseInt(process.env.BCRYPT_ROUNDS, 10) || 12);

  const user = await withTransaction(async (client) => {
    const res = await client.query(
      `INSERT INTO users (role_id, email, password_hash, first_name, last_name, phone, status)
       VALUES ($1,$2,$3,$4,$5,$6,'pending') RETURNING *`,
      [role.rows[0].id, email, passwordHash, firstName, lastName, phone]
    );
    const token = generateTokenBytes();
    const days = 1;
    await client.query(
      `INSERT INTO tokens (user_id, kind, token_hash, expires_at) VALUES ($1,'email_verification',$2,$3)`,
      [res.rows[0].id, hashToken(token), new Date(Date.now() + days * 24 * 60 * 60 * 1000)]
    );
    return { user: res.rows[0], token };
  });

  const verifyLink = `${process.env.CLIENT_URL}/verify-email?token=${user.token}&email=${encodeURIComponent(email)}`;
  await templates.sendVerificationEmail(user.user, verifyLink).catch((e) => logger.error(e));

  await audit({
    actorId: user.user.id,
    actorEmail: email,
    category: 'auth',
    action: 'user.registered',
    entityType: 'user',
    entityId: user.user.id,
    afterData: { email },
    metadata: { method: 'register' },
  });

  return { userId: user.user.id, message: 'Registration successful. Please verify your email.' };
}

// ─────────────────────────────── LOGIN ───────────────────────────────
async function login({ email, password, ipAddress, userAgent }) {
  const maxAttempts = parseInt(await getSetting('security.max_login_attempts', 5), 10);
  const lockMins = parseInt(await getSetting('security.lock_duration_minutes', 15), 10);

  const res = await query(
    `SELECT u.*, r.code AS role_code, r.name AS role_name
     FROM users u JOIN roles r ON r.id = u.role_id
     WHERE u.email = $1 AND u.deleted_at IS NULL`,
    [email]
  );

  if (res.rowCount === 0) {
    // Generic message; do not reveal whether the account exists.
    throw new AppError('Invalid email or password.', 401);
  }

  const user = res.rows[0];

  // Locked check
  if (user.locked_until && user.locked_until > new Date()) {
    throw new AppError(`Account temporarily locked. Try again after ${user.locked_until.toISOString()}.`, 423);
  }
  if (user.status === 'suspended') throw new AppError('Account suspended. Contact administrator.', 403);
  if (user.status === 'pending') throw new AppError('Please verify your email address first.', 403);
  if (user.status === 'locked') throw new AppError('Account locked. Contact administrator.', 403);

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    const newCount = user.failed_attempts + 1;
    let lockUntil = null;
    let newStatus = user.status;
    if (newCount >= maxAttempts) {
      lockUntil = new Date(Date.now() + lockMins * 60 * 1000);
      newStatus = 'locked';
    }
    await query(
      `UPDATE users SET failed_attempts = $1, locked_until = $2, status = $3, updated_at = now() WHERE id = $4`,
      [newCount, lockUntil, newStatus, user.id]
    );
    const remaining = maxAttempts - newCount;
    throw new AppError(
      remaining > 0 ? `Invalid email or password. ${remaining} attempt(s) remaining.` : 'Account locked due to too many failed attempts.',
      401
    );
  }

  // Success — reset counters, update timestamps
  await query(
    `UPDATE users SET failed_attempts = 0, locked_until = NULL, status = 'active', last_login_at = now(), last_login_ip = $2, updated_at = now() WHERE id = $1`,
    [user.id, ipAddress]
  );

  const { rawToken: refreshToken, family } = await issueRefreshToken({
    userId: user.id,
    ipAddress,
    userAgent,
  });

  const accessToken = signAccessToken(user);

  // Activity + audit
  await query(
    `INSERT INTO user_activity_logs (user_id, action, ip_address, user_agent) VALUES ($1,'login',$2,$3)`,
    [user.id, ipAddress, userAgent]
  );
  await audit({ actorId: user.id, actorEmail: user.email, category: 'auth', action: 'user.login', afterData: { email: user.email }, ip: ipAddress });

  return {
    user: publicUser(user),
    accessToken,
    refreshToken,
    refreshFamily: family,
  };
}

// ─────────────────────────────── REFRESH ───────────────────────────────
async function refresh({ refreshToken, ipAddress, userAgent }) {
  if (!refreshToken) throw new AppError('Refresh token required.', 401);
  const tokenHash = hashToken(refreshToken);

  const res = await query(
    `SELECT * FROM refresh_tokens WHERE token_hash = $1`,
    [tokenHash]
  );
  if (res.rowCount === 0) throw new AppError('Invalid refresh token.', 401);
  const stored = res.rows[0];

  if (stored.revoked_at) throw new AppError('Refresh token has been revoked.', 401);
  if (stored.expires_at < new Date()) throw new AppError('Refresh token has expired.', 401);

  const user = await query(
    `SELECT u.*, r.code AS role_code, r.name AS role_name
     FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = $1 AND u.deleted_at IS NULL`,
    [stored.user_id]
  );
  if (user.rowCount === 0) throw new AppError('User not found.', 401);
  if (user.rows[0].status !== 'active') throw new AppError('Account is not active.', 403);

  // Rotate: revoke old, issue new in same family
  const family = stored.family;
  await revokeRefreshToken(tokenHash);

  const newRaw = crypto.randomBytes(48).toString('hex');
  const days = parseInt(await getSetting('security.session_days', 7), 10);
  await query(
    `INSERT INTO refresh_tokens (user_id, token_hash, family, user_agent, ip_address, expires_at)
     VALUES ($1,$2,$3,$4,$5, now() + ($6 || ' days')::interval)`,
    [stored.user_id, hashToken(newRaw), family, userAgent, ipAddress, days]
  );

  const accessToken = signAccessToken(user.rows[0]);
  return { user: publicUser(user.rows[0]), accessToken, refreshToken: newRaw };
}

// ─────────────────────────────── LOGOUT ───────────────────────────────
async function logout({ refreshToken }) {
  if (!refreshToken) return;
  await revokeRefreshToken(hashToken(refreshToken));
}

// ─────────────────────────── EMAIL VERIFICATION ───────────────────────────
async function verifyEmail({ token }) {
  const tokenHash = hashToken(token);
  const res = await query(
    `SELECT * FROM tokens WHERE kind='email_verification' AND token_hash=$1 AND used_at IS NULL AND expires_at > now()`,
    [tokenHash]
  );
  if (res.rowCount === 0) throw new AppError('Verification link is invalid or expired.', 400);
  const t = res.rows[0];

  await withTransaction(async (client) => {
    await client.query(`UPDATE users SET status='active', email_verified_at=now() WHERE id=$1`, [t.user_id]);
    await client.query(`UPDATE tokens SET used_at=now() WHERE id=$1`, [t.id]);
  });
  return { message: 'Email verified. You can now log in.' };
}

async function resendVerification({ email }) {
  const res = await query(`SELECT * FROM users WHERE email=$1 AND deleted_at IS NULL`, [email]);
  if (res.rowCount === 0) throw new AppError('If the account exists, a verification email has been sent.', 200);
  const user = res.rows[0];
  if (user.status === 'active') throw new AppError('Email already verified.', 400);

  const token = generateTokenBytes();
  await query(
    `INSERT INTO tokens (user_id, kind, token_hash, expires_at) VALUES ($1,'email_verification',$2, now() + interval '1 day')`,
    [user.id, hashToken(token)]
  );
  const link = `${process.env.CLIENT_URL}/verify-email?token=${token}&email=${encodeURIComponent(email)}`;
  await templates.sendVerificationEmail(user, link).catch((e) => logger.error(e));
  return { message: 'Verification email re-sent.' };
}

// ─────────────────────────── PASSWORD RESET ───────────────────────────
async function forgotPassword({ email }) {
  const res = await query(`SELECT * FROM users WHERE email=$1 AND deleted_at IS NULL`, [email]);
  if (res.rowCount === 0) return { message: 'If that email exists, a reset link has been sent.' };
  const user = res.rows[0];
  if (user.status === 'suspended') throw new AppError('Account suspended. Contact administrator.', 403);

  const token = generateTokenBytes();
  await query(
    `INSERT INTO tokens (user_id, kind, token_hash, expires_at) VALUES ($1,'password_reset',$2, now() + interval '15 minutes')`,
    [user.id, hashToken(token)]
  );
  const link = `${process.env.CLIENT_URL}/reset-password?token=${token}&email=${encodeURIComponent(email)}`;
  await templates.sendPasswordResetEmail(user, link).catch((e) => logger.error(e));
  return { message: 'If that email exists, a reset link has been sent.' };
}

async function resetPassword({ token, newPassword }) {
  const tokenHash = hashToken(token);
  const res = await query(
    `SELECT * FROM tokens WHERE kind='password_reset' AND token_hash=$1 AND used_at IS NULL AND expires_at > now()`,
    [tokenHash]
  );
  if (res.rowCount === 0) throw new AppError('Reset link is invalid or expired.', 400);
  const t = res.rows[0];
  const passwordHash = await bcrypt.hash(newPassword, parseInt(process.env.BCRYPT_ROUNDS, 10) || 12);

  await withTransaction(async (client) => {
    await client.query(`UPDATE users SET password_hash=$1, failed_attempts=0, locked_until=NULL, status='active', updated_at=now() WHERE id=$2`, [passwordHash, t.user_id]);
    await client.query(`UPDATE tokens SET used_at=now() WHERE id=$1`, [t.id]);
    // Invalidate all refresh tokens on password change
    await client.query(`UPDATE refresh_tokens SET revoked_at=now() WHERE user_id=$1 AND revoked_at IS NULL`, [t.user_id]);
  });
  return { message: 'Password reset successfully. Please log in.' };
}

module.exports = {
  register,
  login,
  refresh,
  logout,
  verifyEmail,
  resendVerification,
  forgotPassword,
  resetPassword,
  publicUser,
  signAccessToken,
};