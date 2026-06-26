import { Request, Response, Router } from 'express';
import auth from '../auth/auth';
import { asyncHandler } from '../async-handler';
import { requireUserId } from '../auth/current-user.utils';
import { requireRouteParam } from '../route-param.utils';
import { bookmarkArticle, unbookmarkArticle } from './bookmark.service';

const router = Router();

/**
 * Bookmark article
 * @auth required
 * @route {POST} /articles/:slug/bookmark
 * @param slug slug of the article (based on the title)
 * @returns article bookmarked article
 */
router.post(
  '/articles/:slug/bookmark',
  auth.required,
  asyncHandler(async (req: Request, res: Response) => {
    const article = await bookmarkArticle(
      requireRouteParam(req.params.slug, 'slug'),
      requireUserId(req)
    );
    res.json({ article });
  })
);

/**
 * Unbookmark article
 * @auth required
 * @route {DELETE} /articles/:slug/bookmark
 * @param slug slug of the article (based on the title)
 * @returns article unbookmarked article
 */
router.delete(
  '/articles/:slug/bookmark',
  auth.required,
  asyncHandler(async (req: Request, res: Response) => {
    const article = await unbookmarkArticle(
      requireRouteParam(req.params.slug, 'slug'),
      requireUserId(req)
    );
    res.json({ article });
  })
);

export default router;
