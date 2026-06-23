import prismaMock from '../prisma-mock';
import getTags from '../../app/routes/tag/tag.service';

const tagMock = prismaMock.tag as unknown as {
  findMany: jest.Mock;
};

describe('TagService', () => {
  describe('getTags', () => {
    test('should return a list of strings ordered by article count for demo and user tags', async () => {
      // Given
      tagMock.findMany.mockResolvedValue([
        { name: 'dragons' },
        { name: 'training' },
      ]);

      // Then
      await expect(getTags(123)).resolves.toEqual(['dragons', 'training']);
      expect(tagMock.findMany).toHaveBeenCalledWith({
        where: {
          articles: {
            some: {
              author: {
                OR: [
                  { demo: true },
                  { id: { equals: 123 } },
                ],
              },
            },
          },
        },
        select: {
          name: true,
        },
        orderBy: {
          articles: {
            _count: 'desc',
          },
        },
        take: 10,
      });
    });

    test('should only query demo tags when no user id is provided', async () => {
      // Given
      tagMock.findMany.mockResolvedValue([{ name: 'welcome' }]);

      // Then
      await expect(getTags()).resolves.toEqual(['welcome']);
      expect(tagMock.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            articles: {
              some: {
                author: {
                  OR: [{ demo: true }],
                },
              },
            },
          },
        }),
      );
    });
  });
});
