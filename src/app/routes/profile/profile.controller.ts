import { Request, Response, Router } from 'express';
import auth from '../auth/auth';
import { asyncHandler } from '../async-handler';
import { requireUserId } from '../auth/current-user.utils';
import { followUser, getProfile, unfollowUser } from './profile.service';

const router = Router();

/**
 * Get profile
 * @auth optional
 * @route {GET} /profiles/:username
 * @param username string
 * @returns profile
 */
router.get(
  '/profiles/:username',
  auth.optional,
  asyncHandler(async (req: Request, res: Response) => {
    const profile = await getProfile(req.params.username, req.auth?.user?.id);
    res.json({ profile });
  }),
);

/**
 * Follow user
 * @auth required
 * @route {POST} /profiles/:username/follow
 * @param username string
 * @returns profile
 */
router.post(
  '/profiles/:username/follow',
  auth.required,
  asyncHandler(async (req: Request, res: Response) => {
    const profile = await followUser(req.params?.username, requireUserId(req));
    res.json({ profile });
  }),
);

/**
 * Unfollow user
 * @auth required
 * @route {DELETE} /profiles/:username/follow
 * @param username string
 * @returns profiles
 */
router.delete(
  '/profiles/:username/follow',
  auth.required,
  asyncHandler(async (req: Request, res: Response) => {
    const profile = await unfollowUser(req.params.username, requireUserId(req));
    res.json({ profile });
  }),
);

export default router;
