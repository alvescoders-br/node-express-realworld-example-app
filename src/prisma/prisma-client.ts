import { SpanStatusCode, trace } from '@opentelemetry/api';
import { Prisma, PrismaClient } from '@prisma/client';

type CustomNodeJsGlobal = typeof globalThis & {
  prisma?: PrismaClient;
};

// Prevent multiple instances of Prisma Client in development
const globalForPrisma = global as CustomNodeJsGlobal;

const prisma = globalForPrisma.prisma || new PrismaClient();
const prismaTracer = trace.getTracer('conduit-api');

prisma.$use(async (params: Prisma.MiddlewareParams, next) => {
  const model = params.model || 'unknown';
  const span = prismaTracer.startSpan(`prisma.${model}.${params.action}`, {
    attributes: {
      action: params.action,
      model,
    },
  });

  try {
    return await next(params);
  } catch (error) {
    span.setStatus({ code: SpanStatusCode.ERROR });
    throw error;
  } finally {
    span.end();
  }
});

if (process.env.NODE_ENV === 'development') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
