const app = require('./app');
const env = require('./config/env');
const { connectDB, disconnectDB } = require('./config/db');
const logger = require('./utils/logger');

let server;

async function startServer(initialPort = env.PORT) {
  try {
    // 1. Connect to MongoDB (with embedded fallback)
    await connectDB(env.MONGO_URI);

    // 2. Start HTTP Server with automatic port collision fallback
    const tryListen = (port) => {
      return new Promise((resolve, reject) => {
        const s = app.listen(port, () => {
          console.log(`[Server] Intelligent API Monitoring Backend running on port ${port} (${env.NODE_ENV})`);
          resolve(s);
        });

        s.once('error', (err) => {
          if (err.code === 'EADDRINUSE' && port === 5000) {
            console.warn(`[Server] Port 5000 is in use (e.g. macOS AirPlay Receiver). Retrying on port 5001...`);
            resolve(tryListen(5001));
          } else {
            reject(err);
          }
        });
      });
    };

    server = await tryListen(initialPort);
  } catch (error) {
    console.error(`[Server] Fatal startup error: ${error.message}`);
    process.exit(1);
  }
}

// Graceful Shutdown Handler
async function gracefulShutdown(signal) {
  console.log(`\n[Server] Received ${signal}. Initiating graceful shutdown...`);

  if (server) {
    server.close(async () => {
      console.log('[Server] HTTP server closed.');
      try {
        await disconnectDB();
        console.log('[Server] Graceful shutdown complete. Exiting process.');
        process.exit(0);
      } catch (err) {
        console.error('[Server] Error during database disconnect:', err.message);
        process.exit(1);
      }
    });

    // Force exit if close takes too long (e.g. 10s)
    setTimeout(() => {
      console.error('[Server] Shutdown timed out. Forcing process exit.');
      process.exit(1);
    }, 10000).unref();
  } else {
    process.exit(0);
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error('[Process] Unhandled Promise Rejection:', {
    reason: reason instanceof Error ? reason.message : reason,
    stack: reason instanceof Error ? reason.stack : undefined
  });
});

process.on('uncaughtException', (error) => {
  logger.error('[Process] Uncaught Exception:', {
    error: error.message,
    stack: error.stack
  });
  gracefulShutdown('uncaughtException');
});

// Start if executed directly
if (require.main === module) {
  startServer();
}

module.exports = { startServer, gracefulShutdown };
