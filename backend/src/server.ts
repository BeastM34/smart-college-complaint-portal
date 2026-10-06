import app from './app';
import { env } from './config/env';

const server = app.listen(env.PORT, () => {
  console.log('================================================================');
  console.log(' SMART COLLEGE COMPLAINT PORTAL - BACKEND API');
  console.log('================================================================');
  console.log(` Server Status  : Running`);
  console.log(` Port           : ${env.PORT}`);
  console.log(` Environment    : ${env.NODE_ENV}`);
  console.log(` Health Check   : http://localhost:${env.PORT}/api/health`);
  console.log(` Allowed Origin : ${env.FRONTEND_URL}`);
  console.log('================================================================');
});

// Graceful Shutdown Handling (Essential for Render and container environments)
const gracefulShutdown = (signal: string): void => {
  console.log(`\n[Server] Received ${signal}. Gracefully shutting down...`);
  server.close(() => {
    console.log('[Server] HTTP server closed cleanly. Exiting process.');
    process.exit(0);
  });

  // Force shutdown after timeout if connections remain open
  setTimeout(() => {
    console.error('[Server] Could not close connections in time, forcefully shutting down.');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

export default server;
