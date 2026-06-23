import { context, trace } from '@opentelemetry/api';
import { NextFunction, Request, Response } from 'express';
import {
  finishRequestSpan,
  logRequestTelemetry,
  recordHttpRequest,
  startRequestSpan,
} from './telemetry';

const getRoutePath = (req: Request): string => {
  const routePath = req.route?.path;

  if (typeof routePath !== 'string') {
    return 'unmatched';
  }

  return `${req.baseUrl}${routePath}` || '/';
};

export const requestTelemetryMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
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
