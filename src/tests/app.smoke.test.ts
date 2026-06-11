import request from 'supertest';

// express-jwt and jsonwebtoken call into buffer-equal-constant-time at module
// load time, which accesses SlowBuffer (removed in Node 18+) and throws.
// Mock both so the routes load cleanly in the jest environment.
jest.mock('express-jwt', () => ({
  expressjwt: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));
jest.mock('jsonwebtoken', () => ({
  sign: () => 'mock-token',
  verify: () => ({ user: { id: 1 } }),
  decode: () => ({ user: { id: 1 } }),
}));

import app from '../app';

describe('GET / (smoke)', () => {
  it('returns API status without opening a real port', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'API is running on /api' });
  });
});
