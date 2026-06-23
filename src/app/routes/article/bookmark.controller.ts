import { Request, Response, Router } from 'express';
import auth from '../auth/auth';
import { asyncHandler } from '../async-handler';
import { bookmarkArticle } from './bookmark.service';

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
    const article = await bookmarkArticle(req.params.slug, req.auth?.user?.id);
    res.json({ article });
  }),
);

export default router;
