import { spawn, execSync } from 'child_process';
import * as fs from 'fs';
import * as http from 'http';
import * as path from 'path';

const DATABASE_URL = 'postgresql://conduit_test:conduit_test_pass@localhost:5433/conduit_test';
const SERVER_PORT = process.env['PLAYWRIGHT_API_PORT'] ?? '3100';
const BASE_URL = process.env['PLAYWRIGHT_API_BASE_URL'] ?? `http://127.0.0.1:${SERVER_PORT}`;
const STATE_DIR = path.resolve(process.cwd(), 'tmp');
const STATE_PATH = path.join(STATE_DIR, 'playwright-api-server.json');
const LOG_PATH = path.join(STATE_DIR, 'playwright-api-server.log');

interface ServerState {
  pid: number;
  baseURL: string;
  logPath: string;
}

function runCommand(command: string, env: NodeJS.ProcessEnv = process.env): void {
  execSync(command, {
    cwd: process.cwd(),
    env,
    stdio: 'inherit',
  });
}

function waitForServer(url: string): Promise<void> {
  const deadline = Date.now() + 30_000;

  return new Promise((resolve, reject) => {
    const poll = () => {
      const request = http.get(url, (response) => {
        response.resume();

        if (response.statusCode && response.statusCode < 500) {
          resolve();
          return;
        }

        scheduleRetry();
      });

      request.on('error', scheduleRetry);
      request.setTimeout(1_000, () => {
        request.destroy();
        scheduleRetry();
      });
    };

    const scheduleRetry = () => {
      if (Date.now() >= deadline) {
        reject(new Error(`Timed out waiting for API server at ${url}`));
        return;
      }

      setTimeout(poll, 500);
    };

    poll();
  });
}

async function globalSetup(): Promise<void> {
  fs.mkdirSync(STATE_DIR, { recursive: true });
  fs.rmSync(STATE_PATH, { force: true });

  console.log('\n[playwright globalSetup] Starting test Postgres container...');
  runCommand('docker compose -f docker-compose.test.yml up -d --wait');

  console.log('[playwright globalSetup] Applying Prisma migrations...');
  runCommand('npx prisma migrate deploy --schema=src/prisma/schema.prisma', {
    ...process.env,
    DATABASE_URL,
  });

  const logFile = fs.openSync(LOG_PATH, 'w');
  const serverProcess = spawn(
    process.execPath,
    [
      '-r',
      './e2e/src/support/slow-buffer-shim.js',
      'node_modules/ts-node/dist/bin.js',
      '--transpile-only',
      '--compiler-options',
      '{"module":"CommonJS"}',
      'src/server.ts',
    ],
    {
      cwd: process.cwd(),
      detached: true,
      env: {
        ...process.env,
        DATABASE_URL,
        JWT_SECRET: 'superSecret',
        NODE_ENV: 'test',
        PORT: SERVER_PORT,
        LOGIN_RATE_LIMIT_MAX: '3',
        LOGIN_RATE_LIMIT_WINDOW_MS: '60000',
      },
      stdio: ['ignore', logFile, logFile],
    },
  );

  fs.closeSync(logFile);

  if (!serverProcess.pid) {
    throw new Error('Unable to start API server for Playwright E2E tests');
  }

  serverProcess.unref();

  const serverState: ServerState = {
    pid: serverProcess.pid,
    baseURL: BASE_URL,
    logPath: LOG_PATH,
  };
  fs.writeFileSync(STATE_PATH, JSON.stringify(serverState, null, 2));

  console.log(`[playwright globalSetup] Waiting for API server at ${BASE_URL}...`);
  await waitForServer(`${BASE_URL}/`);
  console.log('[playwright globalSetup] API server ready.\n');
}

export default globalSetup;
