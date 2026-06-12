/* eslint-disable */
// Phase 2 slice 4 — integration-harness (#7)
// Separate jest config for integration tests against a real Postgres container.
// Self-contained run: npx nx run api:integration-test --runInBand --skip-nx-cache
// Manual run (Docker already up + DATABASE_URL set):
//   npx nx test api --testPathPattern=src/tests/integration --runInBand --skip-nx-cache
export default {
  displayName: 'api-integration',
  preset: './jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  // Starts Postgres container + applies migrations BEFORE workers spawn.
  // Written as plain JS to avoid ts-jest compilation issues in globalSetup context.
  globalSetup: '<rootDir>/src/tests/integration/globalSetup.js',
  globalTeardown: '<rootDir>/src/tests/integration/globalTeardown.js',
  // Injects DATABASE_URL and JWT_SECRET into process.env BEFORE any module loads,
  // ensuring PrismaClient singleton reads the test DB URL at instantiation time.
  setupFiles: ['<rootDir>/src/tests/integration/setupFiles.ts'],
  // Coverage output to the same path as the main config; integration run
  // overwrites lcov.info with comprehensive source coverage.
  coverageDirectory: './harness/coverage/api',
  coverageReporters: ['lcov', 'text'],
  // Broader collectCoverageFrom than the contract-tests config: integration tests
  // exercise all controllers, services, mappers, and auth middleware.
  collectCoverageFrom: [
    'src/app.ts',
    'src/app/routes/**/*.ts',
    'src/prisma/prisma-client.ts',
  ],
  testMatch: ['<rootDir>/src/tests/integration/**/*.test.[jt]s?(x)'],
};
