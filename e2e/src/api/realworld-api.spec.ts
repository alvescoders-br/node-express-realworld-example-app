import { expect, test } from '@playwright/test';

type UserResponse = {
  user: {
    email: string;
    username: string;
    token: string;
    bio: string | null;
    image: string | null;
  };
};

type ArticleResponse = {
  article: {
    slug: string;
    title: string;
    description: string;
    body: string;
    tagList: string[];
    favorited: boolean;
    favoritesCount: number;
    bookmarked?: boolean;
    bookmarksCount?: number;
    id?: number;
    authorId?: number;
    bookmarkedBy?: unknown[];
    author: {
      username: string;
      bio: string | null;
      image: string | null;
      following: boolean;
    };
  };
};

type ErrorResponse = {
  status: string;
  message: string;
};

const uniqueSuffix = `${Date.now()}${Math.random().toString(36).slice(2, 8)}`;
const e2eUser = {
  email: `playwright-${uniqueSuffix}@e2e.test`,
  username: `playwright_${uniqueSuffix}`,
  password: 'PlaywrightPass1!',
};
const e2eArticle = {
  title: `Playwright API Article ${uniqueSuffix}`,
  description: 'Created by the Phase 5 Playwright API E2E flow',
  body: 'This article validates the running RealWorld API over HTTP.',
  tagList: ['playwright', 'e2e'],
};

function authHeader(token: string): Record<string, string> {
  return { Authorization: `Token ${token}` };
}

test.describe.serial('RealWorld API — Playwright E2E flow', () => {
  let token = '';
  let articleSlug = '';

  test('GET / reports the API status', async ({ request }) => {
    const response = await request.get('/');
    const body = (await response.json()) as { status: string };

    expect(response.status()).toBe(200);
    expect(body).toEqual({ status: 'API is running on /api' });
  });

  test('registers a user and returns an auth token', async ({ request }) => {
    const response = await request.post('/api/users', {
      data: { user: e2eUser },
    });
    const body = (await response.json()) as UserResponse;

    expect(response.status()).toBe(201);
    expect(body.user.email).toBe(e2eUser.email);
    expect(body.user.username).toBe(e2eUser.username);
    expect(body.user.token).toEqual(expect.any(String));
    expect(body.user.token.length).toBeGreaterThan(0);

    token = body.user.token;
  });

  test('logs in and reads the current user over authenticated HTTP', async ({ request }) => {
    const loginResponse = await request.post('/api/users/login', {
      data: {
        user: {
          email: e2eUser.email,
          password: e2eUser.password,
        },
      },
    });
    const loginBody = (await loginResponse.json()) as UserResponse;

    expect(loginResponse.status()).toBe(200);
    expect(loginBody.user.email).toBe(e2eUser.email);
    expect(loginBody.user.token).toEqual(expect.any(String));

    token = loginBody.user.token;

    const currentUserResponse = await request.get('/api/user', {
      headers: authHeader(token),
    });
    const currentUserBody = (await currentUserResponse.json()) as UserResponse;

    expect(currentUserResponse.status()).toBe(200);
    expect(currentUserBody.user.email).toBe(e2eUser.email);
    expect(currentUserBody.user.username).toBe(e2eUser.username);
  });

  test('creates and reads an article through the public API contract', async ({ request }) => {
    const createResponse = await request.post('/api/articles', {
      headers: authHeader(token),
      data: { article: e2eArticle },
    });
    const createBody = (await createResponse.json()) as ArticleResponse;

    expect(createResponse.status()).toBe(201);
    expect(createBody.article.title).toBe(e2eArticle.title);
    expect(createBody.article.description).toBe(e2eArticle.description);
    expect(createBody.article.body).toBe(e2eArticle.body);
    expect(createBody.article.tagList).toEqual(expect.arrayContaining(e2eArticle.tagList));
    expect(createBody.article.author.username).toBe(e2eUser.username);
    expect(createBody.article.favorited).toBe(false);
    expect(createBody.article.favoritesCount).toBe(0);

    articleSlug = createBody.article.slug;

    const readResponse = await request.get(`/api/articles/${articleSlug}`);
    const readBody = (await readResponse.json()) as ArticleResponse;

    expect(readResponse.status()).toBe(200);
    expect(readBody.article.slug).toBe(articleSlug);
    expect(readBody.article.title).toBe(e2eArticle.title);
    expect(readBody.article.author.username).toBe(e2eUser.username);
  });

  test('rejects unauthenticated bookmark and allows authenticated POST bookmark only', async ({ request }) => {
    const unauthenticatedResponse = await request.post(`/api/articles/${articleSlug}/bookmark`);
    const unauthenticatedBody = (await unauthenticatedResponse.json()) as ErrorResponse;

    expect(unauthenticatedResponse.status()).toBe(401);
    expect(unauthenticatedBody).toEqual({
      status: 'error',
      message: 'missing authorization credentials',
    });

    const bookmarkResponse = await request.post(`/api/articles/${articleSlug}/bookmark`, {
      headers: authHeader(token),
    });
    const bookmarkBody = (await bookmarkResponse.json()) as ArticleResponse;

    expect(bookmarkResponse.status()).toBe(200);
    expect(bookmarkBody.article.slug).toBe(articleSlug);
    expect(bookmarkBody.article.bookmarked).toBe(true);
    expect(bookmarkBody.article.bookmarksCount).toBeGreaterThanOrEqual(1);
    expect(bookmarkBody.article.id).toBeUndefined();
    expect(bookmarkBody.article.authorId).toBeUndefined();
    expect(bookmarkBody.article.bookmarkedBy).toBeUndefined();
  });
});
