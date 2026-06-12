'use strict';
// Phase 2 slice 4 — integration-harness (#7)
// Starts the ephemeral Postgres container and applies Prisma migrations.
// Runs in Jest's main process (before workers spawn), so env changes here
// do NOT propagate to workers; DATABASE_URL is injected via setupFiles.ts.

const { execSync } = require('child_process');

const DB_URL =
  'postgresql://conduit_test:conduit_test_pass@localhost:5433/conduit_test';

module.exports = async function globalSetup() {
  console.log('\n[integration globalSetup] Starting test Postgres container...');
  execSync('docker compose -f docker-compose.test.yml up -d --wait', {
    stdio: 'inherit',
    cwd: process.cwd(),
  });

  console.log('[integration globalSetup] Applying Prisma migrations...');
  execSync('npx prisma migrate deploy --schema=src/prisma/schema.prisma', {
    env: { ...process.env, DATABASE_URL: DB_URL },
    stdio: 'inherit',
    cwd: process.cwd(),
  });

  console.log('[integration globalSetup] Database ready.\n');
};
