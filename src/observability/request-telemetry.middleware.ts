import { context, trace } from '@opentelemetry/api';
import { NextFunction, Request, Response } from 'express';
import {
  finishRequestSpan,
  logRequestTelemetry,
  recordHttpRequest,
  startRequestSpan,
} from './telemetry';

const routeTemplates: Array<[RegExp, string]> = [
  [/^\/$/, '/'],
  [/^\/api\/tags$/, '/api/tags'],
  [/^\/api\/articles$/, '/api/articles'],
  [/^\/api\/articles\/feed$/, '/api/articles/feed'],
  [
    /^\/api\/articles\/[^/]+\/comments\/[^/]+$/,
    '/api/articles/:slug/comments/:id',
  ],
  [/^\/api\/articles\/[^/]+\/comments$/, '/api/articles/:slug/comments'],
  [/^\/api\/articles\/[^/]+\/favorite$/, '/api/articles/:slug/favorite'],
  [/^\/api\/articles\/[^/]+\/bookmark$/, '/api/articles/:slug/bookmark'],
  [/^\/api\/articles\/[^/]+$/, '/api/articles/:slug'],
  [/^\/api\/profiles\/[^/]+\/follow$/, '/api/profiles/:username/follow'],
  [/^\/api\/profiles\/[^/]+$/, '/api/profiles/:username'],
  [/^\/api\/users\/login$/, '/api/users/login'],
  [/^\/api\/users$/, '/api/users'],
  [/^\/api\/user$/, '/api/user'],
];

const normalizeRequestPath = (req: Request): string => {
  const path = req.originalUrl.split('?')[0] || '/';
  const matchedTemplate = routeTemplates.find(([pattern]) =>
    pattern.test(path)
  );

  return matchedTemplate?.[1] ?? 'unmatched';
};

const getRoutePath = (req: Request): string => {
  const normalizedPath = normalizeRequestPath(req);

  if (normalizedPath !== 'unmatched') {
    return normalizedPath;
  }

  const routePath = req.route?.path;

  if (typeof routePath !== 'string') {
    return 'unmatched';
  }

  return `${req.baseUrl}${routePath}` || '/';
};

export const requestTelemetryMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const startTime = process.hrtime.bigint();
  const span = startRequestSpan(req.method);
  const activeContext = trace.setSpan(context.active(), span);

  res.on('finish', () => {
    const durationNs = process.hrtime.bigint() - startTime;
    const durationMs = Number(durationNs) / 1_000_000;
    const route = getRoutePath(req);

    recordHttpRequest(req.method, route, res.statusCode, durationMs);
    logRequestTelemetry(req.method, route, res.statusCode, durationMs);
    finishRequestSpan(span, route, res.statusCode, durationMs);
  });

  context.with(activeContext, next);
};
