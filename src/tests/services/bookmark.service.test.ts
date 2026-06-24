import prismaMock from '../prisma-mock';
import { bookmarkArticle, unbookmarkArticle } from '../../app/routes/article/bookmark.service';

const articleMock = prismaMock.article as unknown as {
  update: jest.Mock;
};

const buildArticleResponse = (overrides = {}) => ({
  id: 123,
  slug: 'How-to-train-your-dragon',
  title: 'How to train your dragon',
  description: '',
  body: '',
  createdAt: new Date(),
  updatedAt: new Date(),
  authorId: 456,
  tagList: [{ name: 'dragons' }],
  favoritedBy: [],
  bookmarkedBy: [{ id: 789 }],
  author: {
    username: 'RealWorld',
    bio: null,
    image: null,
    followedBy: [],
  },
  _count: {
    bookmarkedBy: 1,
  },
  ...overrides,
});

describe('BookmarkService', () => {
  describe('bookmarkArticle', () => {
    test('should return the bookmarked article', async () => {
      // Given
      const slug = 'How-to-train-your-dragon';
      const userId = 789;
      articleMock.update.mockResolvedValue(
        buildArticleResponse({
          bookmarkedBy: [{ id: 111 }, { id: userId }],
          _count: { bookmarkedBy: 2 },
        }),
      );

      // Then
      await expect(bookmarkArticle(slug, userId)).resolves.toMatchObject({
        bookmarked: true,
        bookmarksCount: 2,
        tagList: ['dragons'],
      });
      expect(articleMock.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { slug },
          data: {
            bookmarkedBy: {
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

    test('should return false when the response is not bookmarked by the user', async () => {
      // Given
      const slug = 'How-to-train-your-dragon';
      const userId = 789;
      articleMock.update.mockResolvedValue(
        buildArticleResponse({
          bookmarkedBy: [{ id: 111 }],
          _count: { bookmarkedBy: 1 },
        }),
      );

      // Then
      await expect(bookmarkArticle(slug, userId)).resolves.toMatchObject({
        bookmarked: false,
        bookmarksCount: 1,
      });
    });
  });

  describe('unbookmarkArticle', () => {
    test('should disconnect the user and return bookmarked=false', async () => {
      // Given
      const slug = 'How-to-train-your-dragon';
      const userId = 789;
      articleMock.update.mockResolvedValue(
        buildArticleResponse({
          bookmarkedBy: [{ id: 111 }],
          _count: { bookmarkedBy: 1 },
        }),
      );

      // Then
      await expect(unbookmarkArticle(slug, userId)).resolves.toMatchObject({
        bookmarked: false,
        bookmarksCount: 1,
        tagList: ['dragons'],
      });
      expect(articleMock.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { slug },
          data: {
            bookmarkedBy: {
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
  });
});
