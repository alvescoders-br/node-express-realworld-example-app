import { Request } from 'express';
import { rateLimit } from 'express-rate-limit';

const DEFAULT_LOGIN_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const DEFAULT_LOGIN_RATE_LIMIT_MAX = 5;

const parsePositiveIntegerEnv = (value: string | undefined, fallback: number): number => {
  const parsedValue = Number(value);

  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    return fallback;
  }

  return parsedValue;
};

const getLoginRateLimitKey = (req: Request): string => {
  const email = req.body?.user?.email;

  if (typeof email === 'string' && email.trim()) {
    return `email:${email.trim().toLowerCase()}`;
  }

  return `ip:${req.ip ?? 'unknown'}`;
};

export const loginRateLimiter = rateLimit({
  windowMs: parsePositiveIntegerEnv(
    process.env.LOGIN_RATE_LIMIT_WINDOW_MS,
    DEFAULT_LOGIN_RATE_LIMIT_WINDOW_MS,
  ),
  limit: parsePositiveIntegerEnv(process.env.LOGIN_RATE_LIMIT_MAX, DEFAULT_LOGIN_RATE_LIMIT_MAX),
  standardHeaders: true,
  legacyHeaders: true,
  skipSuccessfulRequests: true,
  keyGenerator: getLoginRateLimitKey,
  message: {
    errors: {
      login: ['rate limit exceeded'],
    },
  },
});
