import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './src/api',
  testMatch: '**/*.spec.ts',
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  fullyParallel: false,
  workers: 1,
  globalSetup: require.resolve('./src/support/playwright-global-setup'),
  globalTeardown: require.resolve('./src/support/playwright-global-teardown'),
  reporter: [
    ['list'],
    ['html', { outputFolder: '../reports/playwright', open: 'never' }],
  ],
  outputDir: '../reports/playwright-results',
  use: {
    baseURL: process.env['PLAYWRIGHT_API_BASE_URL'] ?? 'http://127.0.0.1:3100',
    extraHTTPHeaders: {
      'Content-Type': 'application/json',
    },
    trace: 'retain-on-failure',
  },
});
