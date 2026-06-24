import { Request } from 'express';
import HttpException from '../../models/http-exception.model';

/**
 * Returns the authenticated user's id for routes guarded by `auth.required`.
 *
 * express-jwt populates `req.auth` before the handler runs, so under normal
 * flow this never throws — it is a type-narrowing guard that keeps call sites
 * strictly typed as `number` once `strict` / `strictNullChecks` is enabled.
 * The defensive 401 is unreachable while the route stays behind `auth.required`.
 */
export const requireUserId = (req: Request): number => {
  const id = req.auth?.user?.id;
  if (typeof id !== 'number') {
    throw new HttpException(401, { message: 'missing authorization credentials' });
  }
  return id;
};
