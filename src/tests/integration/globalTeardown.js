'use strict';
// Phase 2 slice 4 — integration-harness (#7)
// Stops and removes the ephemeral Postgres container after the test run.

const { execSync } = require('child_process');

module.exports = async function globalTeardown() {
  console.log('\n[integration globalTeardown] Stopping test Postgres container...');
  execSync('docker compose -f docker-compose.test.yml down -v', {
    stdio: 'inherit',
    cwd: process.cwd(),
  });
  console.log('[integration globalTeardown] Container removed.\n');
};
