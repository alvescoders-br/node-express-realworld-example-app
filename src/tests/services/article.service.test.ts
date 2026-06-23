import prismaMock from '../prisma-mock';
import {
  createArticle,
  deleteArticle,
  getArticle,
  getArticles,
  getFeed,
  updateArticle,
} from '../../app/routes/article/article.service';
import {
  addComment,
  deleteComment,
  getCommentsByArticle,
} from '../../app/routes/article/comment.service';
import {
  favoriteArticle,
  unfavoriteArticle,
} from '../../app/routes/article/favorite.service';

const articleMock = prismaMock.article as unknown as {
  count: jest.Mock;
  create: jest.Mock;
  delete: jest.Mock;
  findFirst: jest.Mock;
  findMany: jest.Mock;
  findUnique: jest.Mock;
  update: jest.Mock;
};

const commentMock = prismaMock.comment as unknown as {
  create: jest.Mock;
  delete: jest.Mock;
  findFirst: jest.Mock;
};

const createdAt = new Date('2026-01-01T00:00:00.000Z');
const updatedAt = new Date('2026-01-02T00:00:00.000Z');

const buildArticleResponse = (overrides = {}) => ({
  id: 123,
  slug: 'How-to-train-your-dragon',
  title: 'How to train your dragon',
  description: 'Dragon training basics',
  body: 'Always bring fish.',
  createdAt,
  updatedAt,
  authorId: 456,
  tagList: [{ name: 'dragons' }],
  favoritedBy: [{ id: 789 }],
  author: {
    username: 'RealWorld',
    bio: null,
    image: null,
    followedBy: [{ id: 789 }],
  },
  _count: {
    favoritedBy: 1,
  },
  ...overrides,
});

const buildCommentResponse = (overrides = {}) => ({
  id: 321,
  createdAt,
  updatedAt,
  body: 'Great article!',
  author: {
    username: 'RealWorld',
    bio: null,
    image: null,
    followedBy: [{ id: 789 }],
  },
  ...overrides,
});

describe('ArticleService', () => {
  describe('getArticles', () => {
    test('should return mapped articles and count', async () => {
      // Given
      const article = buildArticleResponse();
      articleMock.count.mockResolvedValue(1);
      articleMock.findMany.mockResolvedValue([article]);

      // Then
      await expect(getArticles({ tag: 'dragons' }, 789)).resolves.toMatchObject({
        articlesCount: 1,
        articles: [
          {
            slug: article.slug,
            tagList: ['dragons'],
            favorited: true,
            favoritesCount: 1,
            author: {
              username: 'RealWorld',
              following: true,
            },
          },
        ],
      });
      expect(articleMock.count).toHaveBeenCalledWith({
        where: {
          AND: expect.any(Array),
        },
      });
      expect(articleMock.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,
          take: 10,
        }),
      );
    });

    test('should build author, tag, favorited, limit, and offset filters', async () => {
      // Given
      const article = buildArticleResponse();
      articleMock.count.mockResolvedValue(1);
      articleMock.findMany.mockResolvedValue([article]);

      // When
      await getArticles(
        {
          author: 'RealWorld',
          favorited: 'FanUser',
          limit: '20',
          offset: '5',
          tag: 'dragons',
        },
        789,
      );

      // Then
      expect(articleMock.count).toHaveBeenCalledWith({
        where: {
          AND: [
            {
              author: {
                OR: [
                  { demo: { equals: true } },
                  { id: { equals: 789 } },
                ],
                AND: [
                  {
                    username: {
                      equals: 'RealWorld',
                    },
                  },
                ],
              },
            },
            {
              tagList: {
                some: {
                  name: 'dragons',
                },
              },
            },
            {
              favoritedBy: {
                some: {
                  username: {
                    equals: 'FanUser',
                  },
                },
              },
            },
          ],
        },
      });
      expect(articleMock.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            AND: expect.any(Array),
          },
          orderBy: {
            createdAt: 'desc',
          },
          skip: 5,
          take: 20,
          include: expect.objectContaining({
            tagList: { select: { name: true } },
            _count: { select: { favoritedBy: true } },
          }),
        }),
      );
    });

    test('should build only demo author filter when query and user id are omitted', async () => {
      // Given
      articleMock.count.mockResolvedValue(0);
      articleMock.findMany.mockResolvedValue([]);

      // When
      await getArticles({});

      // Then
      expect(articleMock.count).toHaveBeenCalledWith({
        where: {
          AND: [
            {
              author: {
                OR: [{ demo: { equals: true } }],
                AND: [],
              },
            },
          ],
        },
      });
      expect(articleMock.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,
          take: 10,
        }),
      );
    });
  });

  describe('getFeed', () => {
    test('should return mapped feed articles and count', async () => {
      // Given
      const article = buildArticleResponse();
      articleMock.count.mockResolvedValue(1);
      articleMock.findMany.mockResolvedValue([article]);

      // Then
      await expect(getFeed(0, 10, 789)).resolves.toMatchObject({
        articlesCount: 1,
        articles: [
          {
            slug: article.slug,
            favorited: true,
            favoritesCount: 1,
          },
        ],
      });
      expect(articleMock.count).toHaveBeenCalledWith({
        where: {
          author: {
            followedBy: { some: { id: 789 } },
          },
        },
      });
      expect(articleMock.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            author: {
              followedBy: { some: { id: 789 } },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
          skip: 0,
          take: 10,
          include: expect.objectContaining({
            tagList: { select: { name: true } },
            _count: { select: { favoritedBy: true } },
          }),
        }),
      );
    });

    test('should preserve non-zero feed offset and limit', async () => {
      // Given
      articleMock.count.mockResolvedValue(0);
      articleMock.findMany.mockResolvedValue([]);

      // When
      await getFeed(5, 20, 789);

      // Then
      expect(articleMock.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 5,
          take: 20,
        }),
      );
    });
  });

  describe('createArticle', () => {
    test('should create and map an article with tags', async () => {
      // Given
      const articlePayload = {
        title: 'How to train your dragon',
        description: 'Dragon training basics',
        body: 'Always bring fish.',
        tagList: ['dragons'],
      };
      const article = buildArticleResponse();
      articleMock.findUnique.mockResolvedValue(null);
      articleMock.create.mockResolvedValue(article);

      // Then
      await expect(createArticle(articlePayload, 789)).resolves.toMatchObject({
        slug: article.slug,
        tagList: ['dragons'],
        favorited: true,
      });
      expect(articleMock.findUnique).toHaveBeenCalledWith({
        where: {
          slug: 'How-to-train-your-dragon-789',
        },
        select: {
          slug: true,
        },
      });
      expect(articleMock.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            slug: 'How-to-train-your-dragon-789',
            author: {
              connect: {
                id: 789,
              },
            },
            tagList: {
              connectOrCreate: [
                {
                  create: { name: 'dragons' },
                  where: { name: 'dragons' },
                },
              ],
            },
          }),
          include: expect.objectContaining({
            tagList: { select: { name: true } },
            _count: { select: { favoritedBy: true } },
          }),
        }),
      );
    });

    test('should create an article with no tags when tagList is omitted', async () => {
      // Given
      const articlePayload = {
        title: 'How to train your dragon',
        description: 'Dragon training basics',
        body: 'Always bring fish.',
      };
      articleMock.findUnique.mockResolvedValue(null);
      articleMock.create.mockResolvedValue(buildArticleResponse({ tagList: [] }));

      // When
      await createArticle(articlePayload, 789);

      // Then
      expect(articleMock.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tagList: {
              connectOrCreate: [],
            },
          }),
        }),
      );
    });

    test('should throw an error when title is blank', async () => {
      // Then
      await expect(
        createArticle(
          {
            description: 'Dragon training basics',
            body: 'Always bring fish.',
          },
          789,
        ),
      ).rejects.toMatchObject({
        errorCode: 422,
        response: { errors: { title: ["can't be blank"] } },
      });
    });

    test('should throw an error when description is blank', async () => {
      // Then
      await expect(
        createArticle(
          {
            title: 'How to train your dragon',
            body: 'Always bring fish.',
          },
          789,
        ),
      ).rejects.toMatchObject({
        errorCode: 422,
        response: { errors: { description: ["can't be blank"] } },
      });
    });

    test('should throw an error when body is blank', async () => {
      // Then
      await expect(
        createArticle(
          {
            title: 'How to train your dragon',
            description: 'Dragon training basics',
          },
          789,
        ),
      ).rejects.toMatchObject({
        errorCode: 422,
        response: { errors: { body: ["can't be blank"] } },
      });
    });

    test('should throw an error when title slug already exists', async () => {
      // Given
      articleMock.findUnique.mockResolvedValue({ slug: 'How-to-train-your-dragon-789' });

      // Then
      await expect(
        createArticle(
          {
            title: 'How to train your dragon',
            description: 'Dragon training basics',
            body: 'Always bring fish.',
          },
          789,
        ),
      ).rejects.toMatchObject({
        errorCode: 422,
        response: { errors: { title: ['must be unique'] } },
      });
    });
  });

  describe('getArticle', () => {
    test('should return a mapped article', async () => {
      // Given
      const article = buildArticleResponse();
      articleMock.findUnique.mockResolvedValue(article);

      // Then
      await expect(getArticle(article.slug, 789)).resolves.toMatchObject({
        slug: article.slug,
        tagList: ['dragons'],
        favorited: true,
      });
      expect(articleMock.findUnique).toHaveBeenCalledWith({
        where: {
          slug: article.slug,
        },
        include: expect.objectContaining({
          tagList: { select: { name: true } },
          _count: { select: { favoritedBy: true } },
        }),
      });
    });

    test('should throw an error if no article is found', async () => {
      // Given
      articleMock.findUnique.mockResolvedValue(null);

      // Then
      await expect(getArticle('missing-article', 789)).rejects.toMatchObject({
        errorCode: 404,
        response: { errors: { article: ['not found'] } },
      });
    });
  });

  describe('updateArticle', () => {
    test('should update owned article fields and reconnect tags', async () => {
      // Given
      const updatedArticle = buildArticleResponse({
        slug: 'Updated-title-789',
        title: 'Updated title',
        tagList: [{ name: 'updated' }],
      });
      articleMock.findFirst
        .mockResolvedValueOnce({
          author: {
            id: 789,
            username: 'RealWorld',
          },
        })
        .mockResolvedValueOnce(null);
      articleMock.update
        .mockResolvedValueOnce(buildArticleResponse())
        .mockResolvedValueOnce(updatedArticle);

      // Then
      await expect(
        updateArticle(
          {
            title: 'Updated title',
            description: 'Updated description',
            body: 'Updated body',
            tagList: ['updated'],
          },
          'old-slug',
          789,
        ),
      ).resolves.toMatchObject({
        slug: 'Updated-title-789',
        title: 'Updated title',
        description: 'Dragon training basics',
        body: 'Always bring fish.',
        tagList: ['updated'],
      });
      expect(articleMock.findFirst).toHaveBeenNthCalledWith(1, {
        where: {
          slug: 'old-slug',
        },
        select: {
          author: {
            select: {
              id: true,
              username: true,
            },
          },
        },
      });
      expect(articleMock.findFirst).toHaveBeenNthCalledWith(2, {
        where: {
          slug: 'Updated-title-789',
        },
        select: {
          slug: true,
        },
      });
      expect(articleMock.update).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          where: { slug: 'old-slug' },
          data: {
            tagList: {
              set: [],
            },
          },
        }),
      );
      expect(articleMock.update).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          where: { slug: 'old-slug' },
          data: expect.objectContaining({
            title: 'Updated title',
            description: 'Updated description',
            body: 'Updated body',
            slug: 'Updated-title-789',
            tagList: {
              connectOrCreate: [
                {
                  create: { name: 'updated' },
                  where: { name: 'updated' },
                },
              ],
            },
          }),
          include: expect.objectContaining({
            tagList: { select: { name: true } },
            _count: { select: { favoritedBy: true } },
          }),
        }),
      );
    });

    test('should update body without changing slug or connecting tags', async () => {
      // Given
      articleMock.findFirst.mockResolvedValue({
        author: {
          id: 789,
          username: 'RealWorld',
        },
      });
      articleMock.update
        .mockResolvedValueOnce(buildArticleResponse())
        .mockResolvedValueOnce(buildArticleResponse({ body: 'Updated body' }));

      // When
      await updateArticle({ body: 'Updated body' }, 'old-slug', 789);

      // Then
      expect(articleMock.findFirst).toHaveBeenCalledTimes(1);
      expect(articleMock.update).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          data: expect.objectContaining({
            body: 'Updated body',
            tagList: {
              connectOrCreate: [],
            },
          }),
        }),
      );
      expect(articleMock.update.mock.calls[1][0].data).not.toHaveProperty('slug');
    });

    test('should not check title uniqueness when the generated slug is unchanged', async () => {
      // Given
      articleMock.findFirst.mockResolvedValue({
        author: {
          id: 789,
          username: 'RealWorld',
        },
      });
      articleMock.update
        .mockResolvedValueOnce(buildArticleResponse())
        .mockResolvedValueOnce(buildArticleResponse({ slug: 'Same-title-789' }));

      // When
      await updateArticle({ title: 'Same title' }, 'Same-title-789', 789);

      // Then
      expect(articleMock.findFirst).toHaveBeenCalledTimes(1);
      expect(articleMock.update.mock.calls[1][0].data).toHaveProperty('slug', 'Same-title-789');
    });

    test('should throw an error when article is not found', async () => {
      // Given
      articleMock.findFirst.mockResolvedValue(null);

      // Then
      await expect(updateArticle({ title: 'Updated title' }, 'missing-slug', 789)).rejects.toMatchObject({
        errorCode: 404,
        response: {},
      });
    });

    test('should throw an error when a different author updates the article', async () => {
      // Given
      articleMock.findFirst.mockResolvedValue({
        author: {
          id: 456,
          username: 'OtherUser',
        },
      });

      // Then
      await expect(updateArticle({ title: 'Updated title' }, 'old-slug', 789)).rejects.toMatchObject({
        errorCode: 403,
        response: {
          message: 'You are not authorized to update this article',
        },
      });
    });

    test('should throw an error when updated title already exists', async () => {
      // Given
      articleMock.findFirst
        .mockResolvedValueOnce({
          author: {
            id: 789,
            username: 'RealWorld',
          },
        })
        .mockResolvedValueOnce({ slug: 'Updated-title-789' });

      // Then
      await expect(updateArticle({ title: 'Updated title' }, 'old-slug', 789)).rejects.toMatchObject({
        errorCode: 422,
        response: { errors: { title: ['must be unique'] } },
      });
    });
  });

  describe('deleteArticle', () => {
    test('should delete an owned article', async () => {
      // Given
      articleMock.findFirst.mockResolvedValue({
        author: {
          id: 789,
          username: 'RealWorld',
        },
      });
      articleMock.delete.mockResolvedValue(buildArticleResponse());

      // Then
      await expect(deleteArticle('owned-slug', 789)).resolves.toBeUndefined();
      expect(articleMock.findFirst).toHaveBeenCalledWith({
        where: {
          slug: 'owned-slug',
        },
        select: {
          author: {
            select: {
              id: true,
              username: true,
            },
          },
        },
      });
      expect(articleMock.delete).toHaveBeenCalledWith({
        where: {
          slug: 'owned-slug',
        },
      });
    });

    test('should throw an error when deleting a missing article', async () => {
      // Given
      articleMock.findFirst.mockResolvedValue(null);

      // Then
      await expect(deleteArticle('missing-slug', 789)).rejects.toMatchObject({
        errorCode: 404,
        response: {},
      });
    });

    test('should throw an error when a different author deletes the article', async () => {
      // Given
      articleMock.findFirst.mockResolvedValue({
        author: {
          id: 456,
          username: 'OtherUser',
        },
      });

      // Then
      await expect(deleteArticle('other-slug', 789)).rejects.toMatchObject({
        errorCode: 403,
        response: {
          message: 'You are not authorized to delete this article',
        },
      });
    });
  });

  describe('getCommentsByArticle', () => {
    test('should return mapped comments filtered by demo author or current user', async () => {
      // Given
      const comment = buildCommentResponse();
      articleMock.findUnique.mockResolvedValue({ comments: [comment] });

      // Then
      await expect(getCommentsByArticle('article-slug', 789)).resolves.toEqual([
        {
          ...comment,
          author: {
            username: 'RealWorld',
            bio: null,
            image: null,
            following: true,
          },
        },
      ]);
      expect(articleMock.findUnique).toHaveBeenCalledWith({
        where: {
          slug: 'article-slug',
        },
        include: {
          comments: {
            where: {
              OR: [
                { author: { demo: true } },
                { author: { id: 789 } },
              ],
            },
            select: {
              id: true,
              createdAt: true,
              updatedAt: true,
              body: true,
              author: {
                select: {
                  username: true,
                  bio: true,
                  image: true,
                  followedBy: true,
                },
              },
            },
          },
        },
      });
    });

    test('should mark comments as not followed when the current user is absent', async () => {
      // Given
      articleMock.findUnique.mockResolvedValue({
        comments: [
          buildCommentResponse({
            author: {
              username: 'RealWorld',
              bio: null,
              image: null,
              followedBy: [{ id: 111 }],
            },
          }),
        ],
      });

      // Then
      await expect(getCommentsByArticle('article-slug', 789)).resolves.toMatchObject([
        {
          author: {
            following: false,
          },
        },
      ]);
    });

    test('should still mark comments as followed when other followers are also present', async () => {
      // Given
      articleMock.findUnique.mockResolvedValue({
        comments: [
          buildCommentResponse({
            author: {
              username: 'RealWorld',
              bio: null,
              image: null,
              followedBy: [{ id: 111 }, { id: 789 }],
            },
          }),
        ],
      });

      // Then
      await expect(getCommentsByArticle('article-slug', 789)).resolves.toMatchObject([
        {
          author: {
            following: true,
          },
        },
      ]);
    });
  });

  describe('addComment', () => {
    test('should create and map a comment', async () => {
      // Given
      const comment = buildCommentResponse();
      articleMock.findUnique.mockResolvedValue({ id: 123 });
      commentMock.create.mockResolvedValue(comment);

      // Then
      await expect(addComment('Great article!', 'article-slug', 789)).resolves.toEqual({
        id: 321,
        createdAt,
        updatedAt,
        body: 'Great article!',
        author: {
          username: 'RealWorld',
          bio: null,
          image: null,
          following: true,
        },
      });
      expect(commentMock.create).toHaveBeenCalledWith({
        data: {
          body: 'Great article!',
          article: {
            connect: {
              id: 123,
            },
          },
          author: {
            connect: {
              id: 789,
            },
          },
        },
        include: {
          author: {
            select: {
              username: true,
              bio: true,
              image: true,
              followedBy: true,
            },
          },
        },
      });
    });

    test('should map created comment as not followed when current user is absent', async () => {
      // Given
      articleMock.findUnique.mockResolvedValue({ id: 123 });
      commentMock.create.mockResolvedValue(
        buildCommentResponse({
          author: {
            username: 'RealWorld',
            bio: null,
            image: null,
            followedBy: [{ id: 111 }],
          },
        }),
      );

      // Then
      await expect(addComment('Great article!', 'article-slug', 789)).resolves.toMatchObject({
        author: {
          following: false,
        },
      });
    });

    test('should map created comment as followed when other followers are also present', async () => {
      // Given
      articleMock.findUnique.mockResolvedValue({ id: 123 });
      commentMock.create.mockResolvedValue(
        buildCommentResponse({
          author: {
            username: 'RealWorld',
            bio: null,
            image: null,
            followedBy: [{ id: 111 }, { id: 789 }],
          },
        }),
      );

      // Then
      await expect(addComment('Great article!', 'article-slug', 789)).resolves.toMatchObject({
        author: {
          following: true,
        },
      });
    });

    test('should throw an error when comment body is blank', async () => {
      // Then
      await expect(addComment('', 'article-slug', 789)).rejects.toMatchObject({
        errorCode: 422,
        response: { errors: { body: ["can't be blank"] } },
      });
    });
  });

  describe('deleteComment', () => {
    test('should delete a comment owned by the user', async () => {
      // Given
      const id = 123;
      const userId = 456;
      commentMock.findFirst.mockResolvedValue({
        author: {
          id: userId,
          username: 'RealWorld',
        },
      });
      commentMock.delete.mockResolvedValue({ id });

      // Then
      await expect(deleteComment(id, userId)).resolves.toBeUndefined();
      expect(commentMock.findFirst).toHaveBeenCalledWith({
        where: {
          id,
          author: {
            id: userId,
          },
        },
        select: {
          author: {
            select: {
              id: true,
              username: true,
            },
          },
        },
      });
      expect(commentMock.delete).toHaveBeenCalledWith({
        where: {
          id,
        },
      });
    });

    test('should throw an error when comment is not found for the user', async () => {
      // Given
      const id = 123;
      const userId = 456;
      commentMock.findFirst.mockResolvedValue(null);

      // Then
      await expect(deleteComment(id, userId)).rejects.toMatchObject({
        errorCode: 404,
        response: {},
      });
    });

    test('should throw an error when a different author deletes the comment', async () => {
      // Given
      const id = 123;
      const userId = 456;
      commentMock.findFirst.mockResolvedValue({
        author: {
          id: 789,
          username: 'OtherUser',
        },
      });

      // Then
      await expect(deleteComment(id, userId)).rejects.toMatchObject({
        errorCode: 403,
        response: {
          message: 'You are not authorized to delete this comment',
        },
      });
    });
  });

  describe('favoriteArticle', () => {
    test('should return the favorited article', async () => {
      // Given
      const slug = 'How-to-train-your-dragon';
      const userId = 789;
      const article = buildArticleResponse({
        favoritedBy: [{ id: 111 }, { id: userId }],
        _count: {
          favoritedBy: 2,
        },
      });
      articleMock.update.mockResolvedValue(article);

      // Then
      await expect(favoriteArticle(slug, userId)).resolves.toMatchObject({
        favoritesCount: 2,
        favorited: true,
        tagList: ['dragons'],
      });
      expect(articleMock.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { slug },
          data: {
            favoritedBy: {
              connect: {
                id: userId,
              },
            },
          },
          include: expect.objectContaining({
            tagList: { select: { name: true } },
          }),
        }),
      );
    });

    test('should return false when the response is not favorited by the user', async () => {
      // Given
      const slug = 'How-to-train-your-dragon';
      const userId = 789;
      articleMock.update.mockResolvedValue(
        buildArticleResponse({
          favoritedBy: [{ id: 111 }],
          _count: {
            favoritedBy: 1,
          },
        }),
      );

      // Then
      await expect(favoriteArticle(slug, userId)).resolves.toMatchObject({
        favoritesCount: 1,
        favorited: false,
      });
    });
  });

  describe('unfavoriteArticle', () => {
    test('should return the unfavorited article', async () => {
      // Given
      const slug = 'How-to-train-your-dragon';
      const userId = 789;
      const article = buildArticleResponse({
        favoritedBy: [],
        _count: {
          favoritedBy: 0,
        },
      });
      articleMock.update.mockResolvedValue(article);

      // Then
      await expect(unfavoriteArticle(slug, userId)).resolves.toMatchObject({
        favoritesCount: 0,
        favorited: false,
        tagList: ['dragons'],
      });
      expect(articleMock.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { slug },
          data: {
            favoritedBy: {
              disconnect: {
                id: userId,
              },
            },
          },
          include: expect.objectContaining({
            tagList: { select: { name: true } },
          }),
        }),
      );
    });

    test('should remain unfavorited for the user when other users still favorite it', async () => {
      // Given
      const slug = 'How-to-train-your-dragon';
      const userId = 789;
      articleMock.update.mockResolvedValue(
        buildArticleResponse({
          favoritedBy: [{ id: 111 }],
          _count: {
            favoritedBy: 1,
          },
        }),
      );

      // Then
      await expect(unfavoriteArticle(slug, userId)).resolves.toMatchObject({
        favoritesCount: 1,
        favorited: false,
      });
    });
  });
});
