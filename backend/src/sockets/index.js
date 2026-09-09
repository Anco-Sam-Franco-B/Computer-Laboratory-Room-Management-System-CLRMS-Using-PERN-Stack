const jwt = require('jsonwebtoken');
const { query } = require('../config/db');
const logger = require('../utils/logger');

/** Attach Socket.IO to the HTTP server and wire up authentication + events. */
function initSocket(httpServer) {
  const { Server } = require('socket.io');

  const io = new Server(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : ['http://localhost:5173'],
      credentials: true,
    },
    pingTimeout: 60000,
  });

  // ---- authentication middleware ----
  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth.token ||
        socket.handshake.headers.authorization?.replace('Bearer ', '');

      if (!token) return next(new Error('Unauthorised socket connection'));

      const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
      const res = await query('SELECT id, email, first_name, last_name, status FROM users WHERE id=$1', [decoded.sub]);
      if (res.rowCount === 0 || res.rows[0].status !== 'active') {
        return next(new Error('Unauthorised socket connection'));
      }
      socket.user = res.rows[0];
      next();
    } catch (err) {
      next(new Error('Unauthorised socket connection'));
    }
  });

  io.on('connection', (socket) => {
    const { id: userId } = socket.user;

    // Join a per-user room so targeted broadcasts work.
    socket.join(`user:${userId}`);

    logger.info(`[ws] connected user=${userId} id=${socket.id}`);

    // Broadcasts of specific notifications / events
    socket.on('notification:read', async (notificationId) => {
      await query('UPDATE notifications SET read_at = now() WHERE id = $1 AND user_id = $2', [notificationId, userId]);
    });

    socket.on('notification:read_all', async () => {
      await query('UPDATE notifications SET read_at = now() WHERE user_id = $1 AND read_at IS NULL', [userId]);
    });

    socket.on('disconnect', (reason) => {
      logger.info(`[ws] disconnected user=${userId} reason=${reason}`);
    });
  });

  /** Broadcast a notification to one or many users by UUID. */
  function notifyUser(userIds, payload) {
    const ids = Array.isArray(userIds) ? userIds : [userIds];
    ids.forEach((id) => io.to(`user:${id}`).emit('notification:new', payload));
  }

  return { io, notifyUser };
}

module.exports = { initSocket };