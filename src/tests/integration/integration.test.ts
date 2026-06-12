// Phase 2 slice 4 — integration-harness (#7, Category C)
// Exercises the full RealWorld/Conduit API end-to-end: real express-jwt,
// real PrismaClient, real Postgres (ephemeral via docker-compose.test.yml).
// No mocks of express-jwt, jsonwebtoken, or Prisma.
// Documented inconsistencies (spread leak in favorite/unfavorite, "email or
// password" key, unreachable 403 on deleteComment) are asserted as-is — NOT
// normalised.  See harness/docs/api/openapi.json for contract reference.

// buffer-equal-constant-time accesses SlowBuffer (removed in Node 18+) at
// module-load time.  Mocking it with a stdlib-safe implementation preserves
// the constant-time guarantee while avoiding the crash, leaving express-jwt
// and jsonwebtoken otherwise fully functional.
jest.mock('buffer-equal-constant-time', () => {
  return function bufferEqualConstantTime(a: Buffer, b: Buffer): boolean {
    if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b) || a.length !== b.length) {
      return false;
    }
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('crypto').timingSafeEqual(a, b);
  };
});

import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import app from '../../app';

// Direct prisma client for setup/teardown only; app's singleton (prisma-client.ts)
// is the one used during request handling.
const prisma = new PrismaClient();

// Test personas — ephemeral credentials, never committed as real secrets.
const ALICE = {
  email: 'alice@int.test',
  username: 'alice_inttest',
  password: 'AlicePass1!',
};
const BOB = {
  email: 'bob@int.test',
  username: 'bob_inttest',
  password: 'BobPass1!',
};

const ALICE_ARTICLE = {
  title: 'Integration Test Article By Alice',
  description: 'A test article by alice',
  body: 'Body of alice integration test article',
  tagList: ['javascript', 'testing'],
};

const BOB_ARTICLE = {
  title: 'Integration Test Article By Bob',
  description: 'A test article by bob',
  body: 'Body of bob integration test article',
  tagList: ['typescript'],
};

// State shared across sequential tests
let tokenA: string;
let tokenB: string;
let slugA: string;
let slugB: string;
let commentIdA: number;

function authHeader(token: string) {
  return { Authorization: `Token ${token}` };
}

// ---------------------------------------------------------------------------
// Global setup / teardown — clean the test DB before and after the suite
// ---------------------------------------------------------------------------

beforeAll(async () => {
  await prisma.comment.deleteMany();
  await prisma.article.deleteMany();
  await prisma.tag.deleteMany();
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.comment.deleteMany();
  await prisma.article.deleteMany();
  await prisma.tag.deleteMany();
  await prisma.user.deleteMany();
  await prisma.$disconnect();
});

// ===========================================================================
// 1. Auth flow
// ===========================================================================

describe('Integration — auth flow', () => {
  it('POST /api/users — register alice → 201 { user: { email, username, token, bio, image } }', async () => {
    const res = await request(app)
      .post('/api/users')
      .send({ user: ALICE });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('user');
    const { user } = res.body;
    expect(user.email).toBe(ALICE.email);
    expect(user.username).toBe(ALICE.username);
    expect(typeof user.token).toBe('string');
    expect(user.token.length).toBeGreaterThan(0);
    expect(user).toHaveProperty('bio');
    expect(user).toHaveProperty('image');
    // Store token for subsequent tests
    tokenA = user.token;
  });

  it('POST /api/users — register bob → 201 { user: { email, username, token, bio, image } }', async () => {
    const res = await request(app)
      .post('/api/users')
      .send({ user: BOB });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('user');
    const { user } = res.body;
    expect(user.email).toBe(BOB.email);
    expect(user.username).toBe(BOB.username);
    expect(typeof user.token).toBe('string');
    tokenB = user.token;
  });

  it('POST /api/users/login — login as alice → 200 { user: { email, username, token, bio, image } }', async () => {
    const res = await request(app)
      .post('/api/users/login')
      .send({ user: { email: ALICE.email, password: ALICE.password } });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('user');
    const { user } = res.body;
    expect(user.email).toBe(ALICE.email);
    expect(typeof user.token).toBe('string');
    // Refresh token
    tokenA = user.token;
  });

  it('GET /api/user — current user via alice token → 200 { user: { email, username, bio, image, token } }', async () => {
    const res = await request(app)
      .get('/api/user')
      .set(authHeader(tokenA));

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('user');
    const { user } = res.body;
    expect(user.email).toBe(ALICE.email);
    expect(user.username).toBe(ALICE.username);
    expect(user).toHaveProperty('bio');
    expect(user).toHaveProperty('image');
    expect(typeof user.token).toBe('string');
  });

  it('PUT /api/user — update alice bio → 200 { user: { bio: "integration-tester" } }', async () => {
    const res = await request(app)
      .put('/api/user')
      .set(authHeader(tokenA))
      .send({ user: { bio: 'integration-tester' } });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('user');
    expect(res.body.user.bio).toBe('integration-tester');
    tokenA = res.body.user.token; // refresh token after update
  });
});

// ===========================================================================
// 2. Profiles flow (setup: alice follows bob)
// ===========================================================================

describe('Integration — profiles flow', () => {
  it('GET /api/profiles/:username — no auth → 200 { profile: { username, bio, image, following: false } }', async () => {
    const res = await request(app).get(`/api/profiles/${BOB.username}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('profile');
    const { profile } = res.body;
    expect(profile.username).toBe(BOB.username);
    expect(profile).toHaveProperty('bio');
    expect(profile).toHaveProperty('image');
    expect(profile.following).toBe(false);
  });

  it('POST /api/profiles/:username/follow — alice follows bob → 200 { profile: { following: true } }', async () => {
    const res = await request(app)
      .post(`/api/profiles/${BOB.username}/follow`)
      .set(authHeader(tokenA));

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('profile');
    expect(res.body.profile.username).toBe(BOB.username);
    expect(res.body.profile.following).toBe(true);
  });
});

// ===========================================================================
// 3. Articles flow
// ===========================================================================

describe('Integration — articles flow', () => {
  it('POST /api/articles — alice creates article with tags → 201 { article: { slug, title, tagList, author, favorited, favoritesCount } }', async () => {
    const res = await request(app)
      .post('/api/articles')
      .set(authHeader(tokenA))
      .send({ article: ALICE_ARTICLE });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('article');
    const { article } = res.body;
    expect(typeof article.slug).toBe('string');
    expect(article.title).toBe(ALICE_ARTICLE.title);
    expect(article.description).toBe(ALICE_ARTICLE.description);
    expect(article.body).toBe(ALICE_ARTICLE.body);
    expect(Array.isArray(article.tagList)).toBe(true);
    expect(article.tagList).toEqual(expect.arrayContaining(ALICE_ARTICLE.tagList));
    expect(article).toHaveProperty('createdAt');
    expect(article).toHaveProperty('updatedAt');
    expect(article.favorited).toBe(false);
    expect(typeof article.favoritesCount).toBe('number');
    expect(article.author.username).toBe(ALICE.username);
    expect(article.author.following).toBe(false);
    slugA = article.slug;
  });

  it('POST /api/articles — bob creates article → 201 { article: { slug, title } }', async () => {
    const res = await request(app)
      .post('/api/articles')
      .set(authHeader(tokenB))
      .send({ article: BOB_ARTICLE });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('article');
    expect(typeof res.body.article.slug).toBe('string');
    slugB = res.body.article.slug;
  });

  it('GET /api/articles — alice auth → 200 { articles: [...], articlesCount: N }', async () => {
    const res = await request(app)
      .get('/api/articles')
      .set(authHeader(tokenA));

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('articles');
    expect(Array.isArray(res.body.articles)).toBe(true);
    expect(typeof res.body.articlesCount).toBe('number');
    // Alice's own article must appear (demo=false filtered to auth user)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const slugs = res.body.articles.map((a: any) => a.slug);
    expect(slugs).toContain(slugA);
  });

  it('GET /api/articles/feed — alice auth, bob followed → 200 { articles: [bob article], articlesCount: 1 }', async () => {
    const res = await request(app)
      .get('/api/articles/feed')
      .set(authHeader(tokenA));

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('articles');
    expect(Array.isArray(res.body.articles)).toBe(true);
    expect(typeof res.body.articlesCount).toBe('number');
    expect(res.body.articlesCount).toBeGreaterThanOrEqual(1);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const slugs = res.body.articles.map((a: any) => a.slug);
    expect(slugs).toContain(slugB);
  });

  it('GET /api/articles/:slug — no auth → 200 { article: { slug, title, author, tagList, favorited, favoritesCount } }', async () => {
    const res = await request(app).get(`/api/articles/${slugA}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('article');
    const { article } = res.body;
    expect(article.slug).toBe(slugA);
    expect(article.title).toBe(ALICE_ARTICLE.title);
    expect(Array.isArray(article.tagList)).toBe(true);
    expect(article.author.username).toBe(ALICE.username);
    expect(typeof article.favorited).toBe('boolean');
    expect(typeof article.favoritesCount).toBe('number');
  });

  it('PUT /api/articles/:slug — alice updates article → 200 { article: { body: updated } }', async () => {
    const res = await request(app)
      .put(`/api/articles/${slugA}`)
      .set(authHeader(tokenA))
      .send({ article: { body: 'Updated body by alice' } });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('article');
    expect(res.body.article.body).toBe('Updated body by alice');
    // Slug may have changed if title was updated; capture new slug
    slugA = res.body.article.slug;
  });
});

// ===========================================================================
// 4. Comments flow
// ===========================================================================

describe('Integration — comments flow', () => {
  it('POST /api/articles/:slug/comments — alice adds comment → 200 { comment: { id, body, createdAt, updatedAt, author } }', async () => {
    const res = await request(app)
      .post(`/api/articles/${slugA}/comments`)
      .set(authHeader(tokenA))
      .send({ comment: { body: 'This is a test comment by alice' } });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('comment');
    const { comment } = res.body;
    expect(typeof comment.id).toBe('number');
    expect(comment.body).toBe('This is a test comment by alice');
    expect(comment).toHaveProperty('createdAt');
    expect(comment).toHaveProperty('updatedAt');
    expect(comment.author.username).toBe(ALICE.username);
    expect(typeof comment.author.following).toBe('boolean');
    commentIdA = comment.id;
  });

  it('GET /api/articles/:slug/comments — alice auth → 200 { comments: [{ id, body, author }] }', async () => {
    const res = await request(app)
      .get(`/api/articles/${slugA}/comments`)
      .set(authHeader(tokenA));

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('comments');
    expect(Array.isArray(res.body.comments)).toBe(true);
    expect(res.body.comments.length).toBeGreaterThanOrEqual(1);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ids = res.body.comments.map((c: any) => c.id);
    expect(ids).toContain(commentIdA);
  });

  it('DELETE /api/articles/:slug/comments/:id — alice deletes her comment → 200 {}', async () => {
    const res = await request(app)
      .delete(`/api/articles/${slugA}/comments/${commentIdA}`)
      .set(authHeader(tokenA));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({});
  });
});

// ===========================================================================
// 5. Favorites flow — documented inconsistency: spread leaks id, authorId,
//    favoritedBy (full User objects) because favoriteArticle/unfavoriteArticle
//    use manual spread instead of articleMapper.  Tests assert the ACTUAL
//    response, including the leaked fields, without normalising.
// ===========================================================================

describe('Integration — favorites flow (documented spread inconsistency)', () => {
  it('POST /api/articles/:slug/favorite — bob favorites alice\'s article → 200 { article: { ...+id, authorId, favoritedBy[] } }', async () => {
    const res = await request(app)
      .post(`/api/articles/${slugA}/favorite`)
      .set(authHeader(tokenB));

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('article');
    const { article } = res.body;

    // Standard RealWorld fields
    expect(article.slug).toBe(slugA);
    expect(typeof article.title).toBe('string');
    expect(Array.isArray(article.tagList)).toBe(true);
    expect(article.favorited).toBe(true);
    expect(article.favoritesCount).toBeGreaterThanOrEqual(1);
    expect(article.author.username).toBe(ALICE.username);

    // Documented inconsistency: manual spread leaks internal Prisma fields.
    // These fields are ABSENT in the standard RealWorld envelope returned by
    // articleMapper, but PRESENT here due to the spread.
    expect(typeof article.id).toBe('number');          // leaked
    expect(typeof article.authorId).toBe('number');    // leaked
    expect(Array.isArray(article.favoritedBy)).toBe(true); // leaked (full user array)
  });

  it('DELETE /api/articles/:slug/favorite — bob unfavorites alice\'s article → 200 { article: { ...+id, authorId, favoritedBy[] } }', async () => {
    const res = await request(app)
      .delete(`/api/articles/${slugA}/favorite`)
      .set(authHeader(tokenB));

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('article');
    const { article } = res.body;

    expect(article.slug).toBe(slugA);
    expect(article.favorited).toBe(false);

    // Documented inconsistency: same leak as favoriteArticle
    expect(typeof article.id).toBe('number');
    expect(typeof article.authorId).toBe('number');
    expect(Array.isArray(article.favoritedBy)).toBe(true);
  });
});

// ===========================================================================
// 6. Tags flow
// ===========================================================================

describe('Integration — tags flow', () => {
  it('GET /api/tags — alice auth → 200 { tags: [string] } reflecting alice\'s article tags', async () => {
    const res = await request(app)
      .get('/api/tags')
      .set(authHeader(tokenA));

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('tags');
    expect(Array.isArray(res.body.tags)).toBe(true);
    // alice's article has tags ['javascript', 'testing']; at least one should appear
    const tags: string[] = res.body.tags;
    const overlap = ALICE_ARTICLE.tagList.filter((t) => tags.includes(t));
    expect(overlap.length).toBeGreaterThanOrEqual(1);
  });
});

// ===========================================================================
// 7. Profiles — unfollow
// ===========================================================================

describe('Integration — profiles unfollow', () => {
  it('DELETE /api/profiles/:username/follow — alice unfollows bob → 200 { profile: { following: false } }', async () => {
    const res = await request(app)
      .delete(`/api/profiles/${BOB.username}/follow`)
      .set(authHeader(tokenA));

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('profile');
    expect(res.body.profile.following).toBe(false);
  });
});

// ===========================================================================
// 8. Article deletion
// ===========================================================================

describe('Integration — article deletion', () => {
  it('DELETE /api/articles/:slug — alice deletes her article → 204', async () => {
    const res = await request(app)
      .delete(`/api/articles/${slugA}`)
      .set(authHeader(tokenA));

    expect(res.status).toBe(204);
  });

  it('DELETE /api/articles/:slug — bob deletes his article → 204', async () => {
    const res = await request(app)
      .delete(`/api/articles/${slugB}`)
      .set(authHeader(tokenB));

    expect(res.status).toBe(204);
  });
});

// ===========================================================================
// 9. Negative tests — gate: negative_tests (deterministic gate for Category C)
// ===========================================================================

describe('Integration — negative tests (401 unauthorized)', () => {
  it('GET /api/user without token → 401 + UnauthorizedError envelope', async () => {
    const res = await request(app).get('/api/user');
    expect(res.status).toBe(401);
    expect(res.body).toEqual({
      status: 'error',
      message: 'missing authorization credentials',
    });
  });

  it('POST /api/articles without token → 401', async () => {
    const res = await request(app)
      .post('/api/articles')
      .send({ article: { title: 'x', description: 'x', body: 'x' } });
    expect(res.status).toBe(401);
  });

  it('POST /api/profiles/:username/follow without token → 401', async () => {
    const res = await request(app).post(`/api/profiles/${BOB.username}/follow`);
    expect(res.status).toBe(401);
  });

  it('PUT /api/user without token → 401', async () => {
    const res = await request(app).put('/api/user').send({ user: { bio: 'x' } });
    expect(res.status).toBe(401);
  });
});

describe('Integration — negative tests (403 forbidden)', () => {
  // Documented inconsistency: the 403 key is literally "email or password"
  // (with a space), NOT a standard field name.  Test asserts the exact key.
  it('POST /api/users/login with wrong password → 403 { errors: { "email or password": ["is invalid"] } }', async () => {
    const res = await request(app)
      .post('/api/users/login')
      .send({ user: { email: ALICE.email, password: 'WrongPass999!' } });

    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty('errors');
    expect(res.body.errors).toHaveProperty('email or password');
    expect(Array.isArray(res.body.errors['email or password'])).toBe(true);
  });

  it('PUT /api/articles/:slug with wrong owner — bob tries to update a fresh alice-owned article → 403', async () => {
    // Create a fresh article as alice for this test, then attempt update as bob
    const createRes = await request(app)
      .post('/api/articles')
      .set(authHeader(tokenA))
      .send({
        article: {
          title: 'Ownership Test Article',
          description: 'For 403 test',
          body: 'Body',
        },
      });
    expect(createRes.status).toBe(201);
    const ownershipSlug = createRes.body.article.slug;

    const updateRes = await request(app)
      .put(`/api/articles/${ownershipSlug}`)
      .set(authHeader(tokenB))
      .send({ article: { body: 'Bob tries to edit' } });
    expect(updateRes.status).toBe(403);

    // Cleanup: alice deletes the article
    await request(app)
      .delete(`/api/articles/${ownershipSlug}`)
      .set(authHeader(tokenA));
  });
});

describe('Integration — negative tests (422 validation)', () => {
  it('POST /api/users with blank body → 422 { errors: { ...: [...] } }', async () => {
    const res = await request(app)
      .post('/api/users')
      .send({ user: {} });

    expect(res.status).toBe(422);
    expect(res.body).toHaveProperty('errors');
    const arrays = Object.values(res.body.errors as Record<string, unknown>);
    expect(arrays.length).toBeGreaterThan(0);
    expect(Array.isArray(arrays[0])).toBe(true);
  });

  it('POST /api/articles with missing title (alice auth) → 422 { errors: { title: ["can\'t be blank"] } }', async () => {
    const res = await request(app)
      .post('/api/articles')
      .set(authHeader(tokenA))
      .send({ article: { description: 'x', body: 'y' } });

    expect(res.status).toBe(422);
    expect(res.body).toHaveProperty('errors');
    expect(res.body.errors).toHaveProperty('title');
  });

  it('POST /api/articles/:slug/comments with blank body (alice auth) → 422 { errors: { body: ["can\'t be blank"] } }', async () => {
    // Create a temporary article for this test
    const createRes = await request(app)
      .post('/api/articles')
      .set(authHeader(tokenA))
      .send({
        article: {
          title: '422 Comment Test Article',
          description: 'For 422 comment test',
          body: 'Body',
        },
      });
    expect(createRes.status).toBe(201);
    const tempSlug = createRes.body.article.slug;

    const commentRes = await request(app)
      .post(`/api/articles/${tempSlug}/comments`)
      .set(authHeader(tokenA))
      .send({ comment: { body: '' } });
    expect(commentRes.status).toBe(422);
    expect(commentRes.body).toHaveProperty('errors');
    expect(commentRes.body.errors).toHaveProperty('body');

    // Cleanup
    await request(app)
      .delete(`/api/articles/${tempSlug}`)
      .set(authHeader(tokenA));
  });
});
