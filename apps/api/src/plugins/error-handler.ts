import fp from 'fastify-plugin';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { isProd } from '../config.js';

export default fp(async (app) => {
  app.setErrorHandler((err, req, reply) => {
    const requestId = req.id;

    if (err instanceof ZodError) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'ValidationError',
        message: 'Invalid input',
        details: err.flatten(),
        requestId,
      });
    }

    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === 'P2002') {
        return reply.status(409).send({
          statusCode: 409,
          error: 'Conflict',
          message: 'Resource already exists',
          requestId,
        });
      }
      if (err.code === 'P2025') {
        return reply.status(404).send({
          statusCode: 404,
          error: 'NotFound',
          message: 'Resource not found',
          requestId,
        });
      }
    }

    const status = (err as { statusCode?: number }).statusCode ?? 500;
    if (status >= 500) {
      req.log.error({ err, requestId }, 'Unhandled error');
    } else {
      req.log.warn({ err: err.message, statusCode: status }, 'Client error');
    }

    reply.status(status).send({
      statusCode: status,
      error: err.name || 'Error',
      message: status >= 500 && isProd ? 'Internal server error' : err.message,
      requestId,
    });
  });

  app.setNotFoundHandler((req, reply) => {
    reply.status(404).send({
      statusCode: 404,
      error: 'NotFound',
      message: `Route ${req.method} ${req.url} not found`,
      requestId: req.id,
    });
  });
});
