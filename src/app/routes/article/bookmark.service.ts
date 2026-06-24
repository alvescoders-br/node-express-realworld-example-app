import prisma from '../../../prisma/prisma-client';
import articleMapper from './article.mapper';

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
    },
  });

  return articleMapper(article, id);
};

export const unbookmarkArticle = async (slug: string, id: number) => {
  const article = await prisma.article.update({
    where: {
      slug,
    },
    data: {
      bookmarkedBy: {
        disconnect: {
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
    },
  });

  return articleMapper(article, id);
};
