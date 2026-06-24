// Contract tests — Phase 2 slice 3, issue #6 (spec versioned in-repo: #17)
// Asserts the live API against src/docs/openapi.json (21 operations).
// No real database required; no OpenAPI/Swagger validator dependencies.
// Scope: route existence, auth-per-route, 401/422 structural error shapes.
// Do NOT normalise the documented inconsistencies (see openapi.json notes).

// jest.mock calls in THIS file are hoisted by ts-jest before any import runs.
// express-jwt and jsonwebtoken access SlowBuffer (removed in Node 18+) at
// module load time and crash without mocking.
// The expressjwt mock is auth-aware: when credentialsRequired !== false it
// returns an UnauthorizedError when no token is found, so auth.required
// routes produce the 401 envelope without a real token.
jest.mock('express-jwt', () => ({
  expressjwt:
    (opts: {
      credentialsRequired?: boolean;
      getToken?: (req: any) => string | null;
    }) =>
    (req: any, _res: any, next: (err?: any) => void) => {
      const required = opts.credentialsRequired !== false;
      const token = opts.getToken ? opts.getToken(req) : null;
      if (!token && required) {
        const err: any = new Error('missing authorization credentials');
        err.name = 'UnauthorizedError';
        return next(err);
      }
      next();
    },
}));

jest.mock('jsonwebtoken', () => ({
  sign: () => 'mock-token',
  verify: () => ({ user: { id: 1 } }),
  decode: () => ({ user: { id: 1 } }),
}));

import * as fs from 'fs';
import * as path from 'path';
import request from 'supertest';

// prismaMock registers jest.mock('../prisma/prisma-client') as a side-effect
// when this module loads. It must be imported BEFORE app so the mock is
// registered before app's transitive requires resolve prisma-client.
import prismaMock from '../prisma-mock';

import app from '../../app';

// ---------------------------------------------------------------------------
// Contract fixture
// ---------------------------------------------------------------------------

const spec = JSON.parse(
  fs.readFileSync(
    path.resolve(__dirname, '../../docs/openapi.json'),
    'utf8',
  ),
) as {
  openapi: string;
  paths: Record<string, Record<string, { operationId: string }>>;
};

function countOperations(s: typeof spec): number {
  return Object.values(s.paths).reduce(
    (n, methods) => n + Object.keys(methods).length,
    0,
  );
}

// ---------------------------------------------------------------------------
// 1. Spec sanity — structural guard on the fixture itself
// ---------------------------------------------------------------------------

describe('Contract — OpenAPI spec sanity', () => {
  it('spec is OpenAPI 3.0.3', () => {
    expect(spec.openapi).toBe('3.0.3');
  });

  it('spec has exactly 21 operations', () => {
    expect(countOperations(spec)).toBe(21);
  });
});

// ---------------------------------------------------------------------------
// 2. auth.required — 13 operations must return 401 + UnauthorizedError envelope
//    Regression: if a route is removed/renamed the mock never fires and the
//    test receives an Express text/html 404 → status ≠ 401 → FAIL.
//    If auth.required changes to optional the handler proceeds past the
//    middleware and returns a different status → FAIL.
// ---------------------------------------------------------------------------

const AUTH_REQUIRED_ROUTES = [
  { id: 'createArticle',     method: 'post',   url: '/api/articles' },
  { id: 'getFeed',           method: 'get',    url: '/api/articles/feed' },
  { id: 'updateArticle',     method: 'put',    url: '/api/articles/x' },
  { id: 'deleteArticle',     method: 'delete', url: '/api/articles/x' },
  { id: 'addComment',        method: 'post',   url: '/api/articles/x/comments' },
  { id: 'deleteComment',     method: 'delete', url: '/api/articles/x/comments/1' },
  { id: 'favoriteArticle',   method: 'post',   url: '/api/articles/x/favorite' },
  { id: 'unfavoriteArticle', method: 'delete', url: '/api/articles/x/favorite' },
  { id: 'bookmarkArticle',   method: 'post',   url: '/api/articles/x/bookmark' },
  { id: 'unbookmarkArticle', method: 'delete', url: '/api/articles/x/bookmark' },
  { id: 'followUser',        method: 'post',   url: '/api/profiles/x/follow' },
  { id: 'unfollowUser',      method: 'delete', url: '/api/profiles/x/follow' },
  { id: 'getCurrentUser',    method: 'get',    url: '/api/user' },
  { id: 'updateUser',        method: 'put',    url: '/api/user' },
] as const;

describe('Contract — auth.required: 401 without token', () => {
  test.each(AUTH_REQUIRED_ROUTES)(
    '$method $url ($id)',
    async ({ method, url }) => {
      const res = await (request(app) as any)[method](url);
      expect(res.status).toBe(401);
      // UnauthorizedError envelope produced by src/app.ts global error handler
      expect(res.body).toEqual({
        status: 'error',
        message: 'missing authorization credentials',
      });
    },
  );
});

// ---------------------------------------------------------------------------
// 3. auth.optional — 5 operations must NOT return 401, route must resolve
//    with JSON (not Express "Cannot METHOD /path" text/html 404).
//    Regression: if a route is removed → Express text/html 404 → content-type
//    check fails. If auth changes to required → 401 → status check fails.
// ---------------------------------------------------------------------------

const AUTH_OPTIONAL_ROUTES = [
  { id: 'getTags',              method: 'get', url: '/api/tags' },
  { id: 'getArticles',          method: 'get', url: '/api/articles' },
  { id: 'getArticle',           method: 'get', url: '/api/articles/x' },
  { id: 'getCommentsByArticle', method: 'get', url: '/api/articles/x/comments' },
  { id: 'getProfile',           method: 'get', url: '/api/profiles/x' },
] as const;

describe('Contract — auth.optional: route exists, no 401 without token', () => {
  beforeEach(() => {
    // prisma-mock.ts resets all mocks before each test (global beforeEach).
    // These overrides run after the reset, within this describe's scope.
    // @ts-ignore
    prismaMock.tag.findMany.mockResolvedValue([]);
    // @ts-ignore
    prismaMock.article.count.mockResolvedValue(0);
    // @ts-ignore
    prismaMock.article.findMany.mockResolvedValue([]);
    // null → service-level "not found" responses (JSON 404/500).
    // Distinguishable from Express text/html 404 via Content-Type header.
    // @ts-ignore
    prismaMock.article.findUnique.mockResolvedValue(null);
    // @ts-ignore
    prismaMock.user.findUnique.mockResolvedValue(null);
  });

  test.each(AUTH_OPTIONAL_ROUTES)(
    '$method $url ($id) — no token → NOT 401, JSON content-type',
    async ({ method, url }) => {
      const res = await (request(app) as any)[method](url);

      // Auth is optional — unauthenticated requests must not be rejected.
      expect(res.status).not.toBe(401);

      // All app error/success responses use res.json() → application/json.
      // Express "Cannot METHOD /path" route-not-found returns text/html.
      expect(res.headers['content-type']).toMatch(/application\/json/i);
    },
  );
});

// ---------------------------------------------------------------------------
// 4. auth.none — 2 operations: 422 ValidationErrorResponse on blank fields
//    Validation fires before any Prisma call so no DB mock is needed.
//    Regression: removed route → Express 404 (not 422) → FAIL.
// ---------------------------------------------------------------------------

describe('Contract — auth.none: 422 ValidationErrorResponse on blank fields', () => {
  it('POST /api/users (createUser) — blank fields → 422 { errors: {...arrays} }', async () => {
    const res = await request(app).post('/api/users').send({ user: {} });

    expect(res.status).toBe(422);
    expect(res.body).toHaveProperty('errors');
    const arrays = Object.values(res.body.errors as Record<string, unknown>);
    expect(arrays.length).toBeGreaterThan(0);
    expect(Array.isArray(arrays[0])).toBe(true);
  });

  it('POST /api/users/login (login) — blank fields → 422 { errors: {...arrays} }', async () => {
    const res = await request(app).post('/api/users/login').send({ user: {} });

    expect(res.status).toBe(422);
    expect(res.body).toHaveProperty('errors');
    const arrays = Object.values(res.body.errors as Record<string, unknown>);
    expect(arrays.length).toBeGreaterThan(0);
    expect(Array.isArray(arrays[0])).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 5. Regression guard — table sizes must agree with spec operation count.
//    Any table drift (missed route, duplicate, stale entry) is caught here.
// ---------------------------------------------------------------------------

describe('Contract — regression guard: route table sizes vs spec', () => {
  it('auth.required table has 14 entries', () => {
    expect(AUTH_REQUIRED_ROUTES).toHaveLength(14);
  });

  it('auth.optional table has 5 entries', () => {
    expect(AUTH_OPTIONAL_ROUTES).toHaveLength(5);
  });

  it('14 (required) + 5 (optional) + 2 (none) = 21 spec operations', () => {
    expect(AUTH_REQUIRED_ROUTES.length + AUTH_OPTIONAL_ROUTES.length + 2).toBe(
      countOperations(spec),
    );
  });
});
