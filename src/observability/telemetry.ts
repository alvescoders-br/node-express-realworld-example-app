import { SpanStatusCode, metrics, trace } from '@opentelemetry/api';
import type { Span } from '@opentelemetry/api';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { PrismaInstrumentation } from '@prisma/instrumentation';

const serviceName = process.env.OTEL_SERVICE_NAME || 'conduit-api';
const telemetryDisabled =
  process.env.OTEL_SDK_DISABLED === 'true' || process.env.NODE_ENV === 'test';
const traceEndpoint =
  process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT ||
  'http://tempo:4318/v1/traces';
const metricsEndpoint =
  process.env.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT ||
  'http://mimir:9009/otlp/v1/metrics';
const lokiEndpoint =
  process.env.LOKI_PUSH_URL || 'http://loki:3100/loki/api/v1/push';

let telemetrySdk: NodeSDK | undefined;
let telemetryStarted = false;

type TelemetryLogEvent = 'startup' | 'shutdown' | 'request';

interface SafeLogPayload {
  durationMs?: number;
  event: TelemetryLogEvent;
  method?: string;
  route?: string;
  service: string;
  statusCode?: number;
  timestamp: string;
}

const createMetricInstruments = () => {
  const meter = metrics.getMeter(serviceName);

  return {
    requestCounter: meter.createCounter('http_server_requests_total', {
      description: 'Total HTTP requests handled by route template.',
    }),
    requestDuration: meter.createHistogram('http_server_request_duration_ms', {
      description: 'HTTP request duration by route template in milliseconds.',
      unit: 'ms',
    }),
  };
};

let metricInstruments: ReturnType<typeof createMetricInstruments> | undefined;

const getMetricInstruments = (): ReturnType<typeof createMetricInstruments> => {
  if (!metricInstruments) {
    metricInstruments = createMetricInstruments();
  }

  return metricInstruments;
};

const getTracer = () => trace.getTracer(serviceName);

export const startRequestSpan = (method: string): Span =>
  getTracer().startSpan(`HTTP ${method}`, {
    attributes: {
      method,
    },
  });

export const finishRequestSpan = (
  span: Span,
  route: string,
  statusCode: number,
  durationMs: number,
): void => {
  span.setAttributes({
    duration_ms: durationMs,
    route,
    status_code: statusCode,
  });

  if (statusCode >= 500) {
    span.setStatus({ code: SpanStatusCode.ERROR });
  }

  span.end();
};

const buildMetricReader = () =>
  new PeriodicExportingMetricReader({
    exporter: new OTLPMetricExporter({ url: metricsEndpoint }),
    exportIntervalMillis: Number(process.env.OTEL_METRIC_EXPORT_INTERVAL_MS) || 5000,
    exportTimeoutMillis: 4000,
  });

const buildTelemetrySdk = () =>
  new NodeSDK({
    serviceName,
    traceExporter: new OTLPTraceExporter({ url: traceEndpoint }),
    metricReader: buildMetricReader(),
    instrumentations: [
      new HttpInstrumentation({
        disableIncomingRequestInstrumentation: true,
        disableOutgoingRequestInstrumentation: true,
        headersToSpanAttributes: {
          client: { requestHeaders: [], responseHeaders: [] },
          server: { requestHeaders: [], responseHeaders: [] },
        },
      }),
      new ExpressInstrumentation(),
      new PrismaInstrumentation(),
    ],
  });

const buildLokiBody = (payload: SafeLogPayload) => ({
  streams: [
    {
      stream: {
        service: serviceName,
        event: payload.event,
      },
      values: [[`${Date.now()}000000`, JSON.stringify(payload)]],
    },
  ],
});

const sendLokiLog = async (payload: SafeLogPayload): Promise<void> => {
  if (telemetryDisabled || !lokiEndpoint) {
    return;
  }

  try {
    await fetch(lokiEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildLokiBody(payload)),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error';
    console.warn(`telemetry log export failed: ${message}`);
  }
};

export const startTelemetry = (): void => {
  if (telemetryDisabled || telemetryStarted) {
    return;
  }

  telemetrySdk = buildTelemetrySdk();
  telemetrySdk.start();
  telemetryStarted = true;
};

export const recordHttpRequest = (
  method: string,
  route: string,
  statusCode: number,
  durationMs: number,
): void => {
  const attributes = {
    method,
    route,
    status_code: statusCode,
  };
  const { requestCounter, requestDuration } = getMetricInstruments();

  requestCounter.add(1, attributes);
  requestDuration.record(durationMs, attributes);
};

export const logStartup = (): void => {
  const payload: SafeLogPayload = {
    event: 'startup',
    service: serviceName,
    timestamp: new Date().toISOString(),
  };

  console.info(JSON.stringify(payload));
  void sendLokiLog(payload);
};

export const logShutdown = async (): Promise<void> => {
  const payload: SafeLogPayload = {
    event: 'shutdown',
    service: serviceName,
    timestamp: new Date().toISOString(),
  };

  console.info(JSON.stringify(payload));
  await sendLokiLog(payload);
};

export const logRequestTelemetry = (
  method: string,
  route: string,
  statusCode: number,
  durationMs: number,
): void => {
  const payload: SafeLogPayload = {
    durationMs,
    event: 'request',
    method,
    route,
    service: serviceName,
    statusCode,
    timestamp: new Date().toISOString(),
  };

  void sendLokiLog(payload);
};

export const shutdownTelemetry = async (): Promise<void> => {
  await logShutdown();

  if (!telemetryStarted || !telemetrySdk) {
    return;
  }

  await telemetrySdk.shutdown();
  telemetryStarted = false;
};
