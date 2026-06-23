import prisma from '../../../prisma/prisma-client';
import articleMapper from './article.mapper';

interface BookmarkingUser {
  id: number;
}

export const bookmarkArticle = async (slug: string, id: number) => {
  const article = await prisma.article.update({
    where: {
      slug,
    },
    data: {
      bookmarkedBy: {
        connect: {
          id,
        },
      },
    },
    include: {
      tagList: {
        select: {
          name: true,
        },
      },
      author: {
        select: {
          username: true,
          bio: true,
          image: true,
          followedBy: true,
        },
      },
      favoritedBy: true,
      bookmarkedBy: true,
      _count: {
        select: {
          bookmarkedBy: true,
        },
      },
    },
  });

  return {
    ...articleMapper(article, id),
    bookmarked: article.bookmarkedBy.some((user: BookmarkingUser) => user.id === id),
    bookmarksCount: article._count.bookmarkedBy,
  };
};
