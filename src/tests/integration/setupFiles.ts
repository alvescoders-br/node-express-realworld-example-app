// Phase 2 slice 4 — integration-harness (#7)
// Injected by jest.config.integration.ts setupFiles before ANY module loads.
// This ensures PrismaClient (a singleton initialized at import time) reads
// the test DATABASE_URL and NOT the production one.
// SECRET_RULE: these credentials are ephemeral test-only values; never commit real creds.

process.env['DATABASE_URL'] =
  'postgresql://conduit_test:conduit_test_pass@localhost:5433/conduit_test';
process.env['JWT_SECRET'] = 'superSecret'; // matches default in token.utils.ts
process.env['NODE_ENV'] = 'test';
