import authorMapper, { AuthorMapperInput } from './author.mapper';

interface ArticleMapperInput {
  slug: string;
  title: string;
  description: string;
  body: string;
  tagList: Array<{ name: string }>;
  createdAt: Date;
  updatedAt: Date;
  favoritedBy: Array<{ id: number }>;
  author: AuthorMapperInput;
}

const articleMapper = (article: ArticleMapperInput, id?: number) => ({
  slug: article.slug,
  title: article.title,
  description: article.description,
  body: article.body,
  tagList: article.tagList.map((tag) => tag.name),
  createdAt: article.createdAt,
  updatedAt: article.updatedAt,
  favorited: article.favoritedBy.some((item) => item.id === id),
  favoritesCount: article.favoritedBy.length,
  author: authorMapper(article.author, id),
});

export default articleMapper;
