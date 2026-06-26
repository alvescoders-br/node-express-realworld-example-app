import { Request, Response, Router } from 'express';
import auth from '../auth/auth';
import { asyncHandler } from '../async-handler';
import { requireUserId } from '../auth/current-user.utils';
import { requireRouteParam } from '../route-param.utils';
import { favoriteArticle, unfavoriteArticle } from './favorite.service';

const router = Router();

/**
 * Favorite article
 * @auth required
 * @route {POST} /articles/:slug/favorite
 * @param slug slug of the article (based on the title)
 * @returns article favorited article
 */
router.post(
  '/articles/:slug/favorite',
  auth.required,
  asyncHandler(async (req: Request, res: Response) => {
    const article = await favoriteArticle(
      requireRouteParam(req.params.slug, 'slug'),
      requireUserId(req)
    );
    res.json({ article });
  })
);

/**
 * Unfavorite article
 * @auth required
 * @route {DELETE} /articles/:slug/favorite
 * @param slug slug of the article (based on the title)
 * @returns article unfavorited article
 */
router.delete(
  '/articles/:slug/favorite',
  auth.required,
  asyncHandler(async (req: Request, res: Response) => {
    const article = await unfavoriteArticle(
      requireRouteParam(req.params.slug, 'slug'),
      requireUserId(req)
    );
    res.json({ article });
  })
);

export default router;
