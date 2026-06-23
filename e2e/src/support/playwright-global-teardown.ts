import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const STATE_PATH = path.resolve(process.cwd(), 'tmp', 'playwright-api-server.json');

interface ServerState {
  pid: number;
  baseURL: string;
  logPath: string;
}

function readServerState(): ServerState | null {
  if (!fs.existsSync(STATE_PATH)) {
    return null;
  }

  const rawState = fs.readFileSync(STATE_PATH, 'utf8');
  return JSON.parse(rawState) as ServerState;
}

async function globalTeardown(): Promise<void> {
  const serverState = readServerState();

  if (serverState) {
    console.log(`\n[playwright globalTeardown] Stopping API server pid ${serverState.pid}...`);

    try {
      process.kill(serverState.pid);
    } catch (error) {
      console.warn(
        `[playwright globalTeardown] API server pid ${serverState.pid} was already stopped: ${String(error)}`,
      );
    }

    fs.rmSync(STATE_PATH, { force: true });
  }

  console.log('[playwright globalTeardown] Stopping test Postgres container...');
  execSync('docker compose -f docker-compose.test.yml down -v', {
    cwd: process.cwd(),
    stdio: 'inherit',
  });
  console.log('[playwright globalTeardown] Container removed.\n');
}

export default globalTeardown;
