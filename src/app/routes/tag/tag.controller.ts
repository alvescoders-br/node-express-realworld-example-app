import { Request, Response, Router } from 'express';
import auth from '../auth/auth';
import { asyncHandler } from '../async-handler';
import getTags from './tag.service';

const router = Router();

/**
 * Get top 10 popular tags
 * @auth optional
 * @route {GET} /api/tags
 * @returns tags list of tag names
 */
router.get(
  '/tags',
  auth.optional,
  asyncHandler(async (req: Request, res: Response) => {
    const tags = await getTags(req.auth?.user?.id);
    res.json({ tags });
  }),
);

export default router;
