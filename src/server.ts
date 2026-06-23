import './observability/bootstrap';
import app from './app';
import { logStartup, shutdownTelemetry } from './observability/telemetry';

const port = process.env.PORT || 3000;
let shuttingDown = false;

const server = app.listen(port, () => {
  console.info(`server up on port ${port}`);
  logStartup();
});

const shutdown = (signal: string): void => {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  console.info(`received ${signal}; shutting down server`);

  server.close(() => {
    shutdownTelemetry()
      .then(() => process.exit(0))
      .catch((error: Error) => {
        console.error(`telemetry shutdown failed: ${error.message}`);
        process.exit(1);
      });
  });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
