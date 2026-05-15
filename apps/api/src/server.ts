import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import sensible from '@fastify/sensible';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { serializerCompiler, validatorCompiler, jsonSchemaTransform } from 'fastify-type-provider-zod';
import { config } from './config.js';
import { logger } from './lib/logger.js';
import authPlugin from './plugins/auth.js';
import errorHandlerPlugin from './plugins/error-handler.js';
import { healthRoutes } from './routes/health.js';
import { authRoutes } from './routes/auth.js';
import { centerRoutes } from './routes/centers.js';
import { predictionRoutes } from './routes/predictions.js';
import { slotRoutes } from './routes/slots.js';
import { bookingRoutes } from './routes/bookings.js';
import { vehicleRoutes } from './routes/vehicles.js';
import { proxyJobRoutes } from './routes/proxy-jobs.js';
import { fleetRoutes } from './routes/fleets.js';
import { paymentRoutes } from './routes/payments.js';
import { queueReportRoutes } from './routes/queue-reports.js';
import { bookingTransitionRoutes } from './routes/booking-transitions.js';

export async function buildServer() {
  const app = Fastify({
    loggerInstance: logger,
    requestIdHeader: 'x-request-id',
    disableRequestLogging: false,
    trustProxy: true,
    bodyLimit: 1024 * 1024, // 1 MB
  });

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  await app.register(sensible);
  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cors, {
    origin: config.CORS_ORIGIN.split(',').map((s) => s.trim()),
    credentials: true,
  });
  await app.register(rateLimit, {
    max: config.RATE_LIMIT_MAX,
    timeWindow: config.RATE_LIMIT_WINDOW,
  });

  await app.register(swagger, {
    openapi: {
      info: {
        title: 'Đăng kiểm Predictor API',
        description: 'Wait-time prediction, booking, and proxy inspection service for VN registry centers',
        version: '0.1.0',
      },
      servers: [{ url: 'http://localhost:4000' }],
      components: {
        securitySchemes: {
          bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        },
      },
    },
    transform: jsonSchemaTransform,
  });
  await app.register(swaggerUi, { routePrefix: '/docs' });

  await app.register(authPlugin);
  await app.register(errorHandlerPlugin);

  // Public routes
  await app.register(healthRoutes);
  await app.register(authRoutes, { prefix: '/v1/auth' });
  await app.register(centerRoutes, { prefix: '/v1' });
  await app.register(predictionRoutes, { prefix: '/v1' });
  await app.register(slotRoutes, { prefix: '/v1' });

  // Authenticated
  await app.register(bookingRoutes, { prefix: '/v1' });
  await app.register(vehicleRoutes, { prefix: '/v1' });
  await app.register(proxyJobRoutes, { prefix: '/v1' });
  await app.register(fleetRoutes, { prefix: '/v1' });
  await app.register(paymentRoutes, { prefix: '/v1' });
  await app.register(queueReportRoutes, { prefix: '/v1' });
  await app.register(bookingTransitionRoutes, { prefix: '/v1' });

  return app;
}
