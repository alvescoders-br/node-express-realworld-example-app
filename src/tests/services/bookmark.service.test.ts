import prismaMock from '../prisma-mock';
import { bookmarkArticle } from '../../app/routes/article/bookmark.service';

const mockedArticleResponse = {
  id: 123,
  slug: 'How-to-train-your-dragon',
  title: 'How to train your dragon',
  description: '',
  body: '',
  createdAt: new Date(),
  updatedAt: new Date(),
  authorId: 456,
  tagList: [],
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
};

describe('BookmarkService', () => {
  describe('bookmarkArticle', () => {
    test('should return the bookmarked article', async () => {
      // Given
      const slug = 'How-to-train-your-dragon';
      const userId = 789;

      // When
      // @ts-expect-error Prisma deep mock types recurse on article.update.
      prismaMock.article.update.mockResolvedValue(mockedArticleResponse);

      // Then
      await expect(bookmarkArticle(slug, userId)).resolves.toMatchObject({
        bookmarked: true,
        bookmarksCount: 1,
      });
      expect(prismaMock.article.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { slug },
          data: {
            bookmarkedBy: {
              connect: {
                id: userId,
              },
            },
          },
        }),
      );
    });
  });
});
