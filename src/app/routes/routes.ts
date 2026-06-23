import { Router } from 'express';
import tagsController from './tag/tag.controller';
import articlesController from './article/article.controller';
import commentController from './article/comment.controller';
import favoriteController from './article/favorite.controller';
import bookmarkController from './article/bookmark.controller';
import authController from './auth/auth.controller';
import profileController from './profile/profile.controller';

const api = Router()
  .use(tagsController)
  .use(articlesController)
  .use(commentController)
  .use(favoriteController)
  .use(bookmarkController)
  .use(profileController)
  .use(authController);

export default Router().use('/api', api);
