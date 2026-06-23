import { Request, Response, Router } from 'express';
import auth from './auth';
import { asyncHandler } from '../async-handler';
import { createUser, getCurrentUser, login, updateUser } from './auth.service';
import { loginRateLimiter } from './login-rate-limit.middleware';

const router = Router();

/**
 * Create an user
 * @auth none
 * @route {POST} /users
 * @bodyparam user User
 * @returns user User
 */
router.post(
  '/users',
  asyncHandler(async (req: Request, res: Response) => {
    const user = await createUser({ ...req.body.user, demo: false });
    res.status(201).json({ user });
  }),
);

/**
 * Login
 * @auth none
 * @route {POST} /users/login
 * @bodyparam user User
 * @returns user User
 */
router.post(
  '/users/login',
  loginRateLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const user = await login(req.body.user);
    res.json({ user });
  }),
);

/**
 * Get current user
 * @auth required
 * @route {GET} /user
 * @returns user User
 */
router.get(
  '/user',
  auth.required,
  asyncHandler(async (req: Request, res: Response) => {
    const user = await getCurrentUser(req.auth?.user?.id);
    res.json({ user });
  }),
);

/**
 * Update user
 * @auth required
 * @route {PUT} /user
 * @bodyparam user User
 * @returns user User
 */
router.put(
  '/user',
  auth.required,
  asyncHandler(async (req: Request, res: Response) => {
    const user = await updateUser(req.body.user, req.auth?.user?.id);
    res.json({ user });
  }),
);

export default router;
