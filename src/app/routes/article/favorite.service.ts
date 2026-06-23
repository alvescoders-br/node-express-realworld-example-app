import prisma from '../../../prisma/prisma-client';
import { User } from '../auth/user.model';
import profileMapper from '../profile/profile.utils';
import { Tag } from '../tag/tag.model';

export const favoriteArticle = async (slugPayload: string, id: number) => {
  const { _count, ...article } = await prisma.article.update({
    where: {
      slug: slugPayload,
    },
    data: {
      favoritedBy: {
        connect: {
          id: id,
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
      _count: {
        select: {
          favoritedBy: true,
        },
      },
    },
  });

  const result = {
    ...article,
    author: profileMapper(article.author, id),
    tagList: article?.tagList.map((tag: Tag) => tag.name),
    favorited: article.favoritedBy.some((favorited: Partial<User>) => favorited.id === id),
    favoritesCount: _count?.favoritedBy,
  };

  return result;
};

export const unfavoriteArticle = async (slugPayload: string, id: number) => {
  const { _count, ...article } = await prisma.article.update({
    where: {
      slug: slugPayload,
    },
    data: {
      favoritedBy: {
        disconnect: {
          id: id,
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
      _count: {
        select: {
          favoritedBy: true,
        },
      },
    },
  });

  const result = {
    ...article,
    author: profileMapper(article.author, id),
    tagList: article?.tagList.map((tag: Tag) => tag.name),
    favorited: article.favoritedBy.some((favorited: Partial<User>) => favorited.id === id),
    favoritesCount: _count?.favoritedBy,
  };

  return result;
};
