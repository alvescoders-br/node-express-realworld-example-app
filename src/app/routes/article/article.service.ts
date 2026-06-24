import { Prisma } from '@prisma/client';
import slugify from 'slugify';
import prisma from '../../../prisma/prisma-client';
import HttpException from '../../models/http-exception.model';
import articleMapper from './article.mapper';

interface ArticleListQuery {
  author?: string;
  favorited?: string;
  limit?: number | string;
  offset?: number | string;
  tag?: string;
}

interface ArticlePayload {
  body?: string;
  description?: string;
  tagList?: string[];
  title?: string;
}

const buildFindAllQuery = (query: ArticleListQuery, id: number | undefined) => {
  const queries: Prisma.ArticleWhereInput[] = [];
  const orAuthorQuery: Prisma.UserWhereInput[] = [];
  const andAuthorQuery: Prisma.UserWhereInput[] = [];

  orAuthorQuery.push({
    demo: {
      equals: true,
    },
  });

  if (id) {
    orAuthorQuery.push({
      id: {
        equals: id,
      },
    });
  }

  if ('author' in query) {
    andAuthorQuery.push({
      username: {
        equals: query.author,
      },
    });
  }

  const authorQuery = {
    author: {
      OR: orAuthorQuery,
      AND: andAuthorQuery,
    },
  };

  queries.push(authorQuery);

  if ('tag' in query) {
    queries.push({
      tagList: {
        some: {
          name: query.tag,
        },
      },
    });
  }

  if ('favorited' in query) {
    queries.push({
      favoritedBy: {
        some: {
          username: {
            equals: query.favorited,
          },
        },
      },
    });
  }

  return queries;
};

export const getArticles = async (query: ArticleListQuery, id?: number) => {
  const andQueries = buildFindAllQuery(query, id);
  const articlesCount = await prisma.article.count({
    where: {
      AND: andQueries,
    },
  });

  const articles = await prisma.article.findMany({
    where: { AND: andQueries },
    orderBy: {
      createdAt: 'desc',
    },
    skip: Number(query.offset) || 0,
    take: Number(query.limit) || 10,
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
          favoritedBy: true,
        },
      },
    },
  });

  return {
    articles: articles.map((article) => articleMapper(article, id)),
    articlesCount,
  };
};

export const getFeed = async (offset: number, limit: number, id: number) => {
  const articlesCount = await prisma.article.count({
    where: {
      author: {
        followedBy: { some: { id: id } },
      },
    },
  });

  const articles = await prisma.article.findMany({
    where: {
      author: {
        followedBy: { some: { id: id } },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
    skip: offset || 0,
    take: limit || 10,
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
          favoritedBy: true,
        },
      },
    },
  });

  return {
    articles: articles.map((article) => articleMapper(article, id)),
    articlesCount,
  };
};

export const createArticle = async (article: ArticlePayload, id: number) => {
  const { title, description, body, tagList } = article;
  const tags = Array.isArray(tagList) ? tagList : [];

  if (!title) {
    throw new HttpException(422, { errors: { title: ["can't be blank"] } });
  }

  if (!description) {
    throw new HttpException(422, { errors: { description: ["can't be blank"] } });
  }

  if (!body) {
    throw new HttpException(422, { errors: { body: ["can't be blank"] } });
  }

  const slug = `${slugify(title)}-${id}`;

  const existingTitle = await prisma.article.findUnique({
    where: {
      slug,
    },
    select: {
      slug: true,
    },
  });

  if (existingTitle) {
    throw new HttpException(422, { errors: { title: ['must be unique'] } });
  }

  const createdArticle = await prisma.article.create({
    data: {
      title,
      description,
      body,
      slug,
      tagList: {
        connectOrCreate: tags.map((tag: string) => ({
          create: { name: tag },
          where: { name: tag },
        })),
      },
      author: {
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
      bookmarkedBy: true,
      _count: {
        select: {
          favoritedBy: true,
        },
      },
    },
  });

  return articleMapper(createdArticle, id);
};

export const getArticle = async (slug: string, id?: number) => {
  const article = await prisma.article.findUnique({
    where: {
      slug,
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
          favoritedBy: true,
        },
      },
    },
  });

  if (!article) {
    throw new HttpException(404, { errors: { article: ['not found'] } });
  }

  return articleMapper(article, id);
};

const disconnectArticlesTags = async (slug: string) => {
  await prisma.article.update({
    where: {
      slug,
    },
    data: {
      tagList: {
        set: [],
      },
    },
  });
};

export const updateArticle = async (article: ArticlePayload, slug: string, id: number) => {
  let newSlug: string | null = null;

  const existingArticle = await prisma.article.findFirst({
    where: {
      slug,
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

  if (!existingArticle) {
    throw new HttpException(404, {});
  }

  if (existingArticle.author.id !== id) {
    throw new HttpException(403, {
      message: 'You are not authorized to update this article',
    });
  }

  if (article.title) {
    newSlug = `${slugify(article.title)}-${id}`;

    if (newSlug !== slug) {
      const existingTitle = await prisma.article.findFirst({
        where: {
          slug: newSlug,
        },
        select: {
          slug: true,
        },
      });

      if (existingTitle) {
        throw new HttpException(422, { errors: { title: ['must be unique'] } });
      }
    }
  }

  const tagList =
    Array.isArray(article.tagList) && article.tagList?.length
      ? article.tagList.map((tag: string) => ({
          create: { name: tag },
          where: { name: tag },
        }))
      : [];

  await disconnectArticlesTags(slug);

  const updatedArticle = await prisma.article.update({
    where: {
      slug,
    },
    data: {
      ...(article.title ? { title: article.title } : {}),
      ...(article.body ? { body: article.body } : {}),
      ...(article.description ? { description: article.description } : {}),
      ...(newSlug ? { slug: newSlug } : {}),
      updatedAt: new Date(),
      tagList: {
        connectOrCreate: tagList,
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
          favoritedBy: true,
        },
      },
    },
  });

  return articleMapper(updatedArticle, id);
};

export const deleteArticle = async (slug: string, id: number) => {
  const existingArticle = await prisma.article.findFirst({
    where: {
      slug,
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

  if (!existingArticle) {
    throw new HttpException(404, {});
  }

  if (existingArticle.author.id !== id) {
    throw new HttpException(403, {
      message: 'You are not authorized to delete this article',
    });
  }
  await prisma.article.delete({
    where: {
      slug,
    },
  });
};
