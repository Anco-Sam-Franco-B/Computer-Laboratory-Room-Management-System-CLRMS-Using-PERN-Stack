const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const express = require('express');
const http = require('http');

const { pool } = require('./config/db');
const logger = require('./utils/logger');
const { initSocket } = require('./sockets');
const { apiLimiter } = require('./middleware/rateLimit');
const { errorHandler, notFound, bodyParserError } = require('./middleware/error');

// Routes
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const departmentRoutes = require('./routes/department.routes');
const labRoutes = require('./routes/laboratory.routes');
const computerRoutes = require('./routes/computer.routes');
const equipmentRoutes = require('./routes/equipment.routes');
const bookingRoutes = require('./routes/booking.routes');
const timetableRoutes = require('./routes/timetable.routes');
const attendanceRoutes = require('./routes/attendance.routes');
const maintenanceRoutes = require('./routes/maintenance.routes');
const incidentRoutes = require('./routes/incident.routes');
const visitorRoutes = require('./routes/visitor.routes');
const notificationRoutes = require('./routes/notification.routes');
const reportRoutes = require('./routes/report.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const settingRoutes = require('./routes/setting.routes');
const profileRoutes = require('./routes/profile.routes');
const healthRoutes = require('./routes/health.routes');

const app = express();
const server = http.createServer(app);

// Global middleware
app.set('trust proxy', 1);
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(
  cors({
    origin: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : ['https://clrms.onrender.com'],
    credentials: true,
  })
);
app.use(compression());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(bodyParserError);
app.use('/api/uploads', express.static(path.join(__dirname, '../uploads')));
app.use('/api', apiLimiter); // global rate limiting

// Health check
app.use('/api/health', healthRoutes);

// Test mail route (dev convenience) - removed

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/laboratories', labRoutes);
app.use('/api/computers', computerRoutes);
app.use('/api/equipment', equipmentRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/timetable', timetableRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/maintenance', maintenanceRoutes);
app.use('/api/incidents', incidentRoutes);
app.use('/api/visitors', visitorRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/settings', settingRoutes);
app.use('/api/profile', profileRoutes);

// 404 + error handling LAST (must come after all route mounting)
app.use(notFound);
app.use(errorHandler);

// Graceful shutdown
async function shutdown(signal) {
  logger.info(`${signal} received, shutting down...`);
  server.close(async () => {
    try { await pool.end(); } catch (e) {}
    process.exit(0);
  });
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

module.exports = { app, server, initSocket }; // initSocket used in server.js
