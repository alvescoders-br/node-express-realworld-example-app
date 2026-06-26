/* eslint-disable */
export default {
  displayName: 'api',
  preset: './jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  // #20: Node >= 24 removed SlowBuffer.prototype.equal, but jsonwebtoken's
  // transitive jwa dependency still loads it. Keep the local test runner
  // aligned with the Playwright shim so the default Jest gate stays green.
  setupFiles: ['<rootDir>/src/tests/slow-buffer-shim.ts'],
  // reportPath in harness-manifest.json is relative to REPO_ROOT (harness/).
  // coverage-check.py resolves: harness/ + "coverage/api/lcov.info".
  coverageDirectory: './harness/coverage/api',
  // Collect coverage from the app files directly exercised by the contract tests:
  // the Express app entry point and the auth middleware (the two contract surfaces).
  collectCoverageFrom: [
    'src/app.ts',
    'src/app/routes/auth/auth.ts',
    'src/app/routes/routes.ts',
  ],
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.[jt]s?(x)',
    '<rootDir>/src/**/*(*.)@(spec|test).[jt]s?(x)',
  ],
  // Integration tests have their own config (jest.config.integration.ts) with
  // setupFiles that inject the test DATABASE_URL and LOGIN_RATE_LIMIT_MAX. Running
  // them under this default config (no setupFiles) makes the 429 assertion read the
  // default limit and fail. Run them via the `integration-test` target instead.
  testPathIgnorePatterns: ['<rootDir>/src/tests/integration/'],
};
