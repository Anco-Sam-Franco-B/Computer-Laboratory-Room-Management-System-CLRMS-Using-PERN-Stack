const { app, server, initSocket } = require('./app');
const logger = require('./utils/logger');

const PORT = process.env.PORT || 5000;

initSocket(server);

server.listen(PORT, () => {
  logger.info(`🚀 CLRMS API running on port ${PORT} (${process.env.NODE_ENV})`);
  logger.info(`🔌 Socket.IO mounted on /`);
});

server.on('error', (err) => {
  logger.error(`Server error: ${err.message}`);
  process.exit(1);
});

module.exports = server;