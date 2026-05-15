import fp from 'fastify-plugin';
import fastifyJwt from '@fastify/jwt';
import type { FastifyRequest } from 'fastify';
import { config } from '../config.js';

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (req: FastifyRequest) => Promise<void>;
    requireRole: (...roles: string[]) => (req: FastifyRequest) => Promise<void>;
  }
  interface FastifyRequest {
    userId: string;
    userRole: string;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { sub: string; role: string };
    user: { sub: string; role: string };
  }
}

export default fp(async (app) => {
  await app.register(fastifyJwt, {
    secret: config.JWT_SECRET,
    sign: { expiresIn: config.JWT_ACCESS_TTL },
  });

  app.decorate('authenticate', async (req: FastifyRequest) => {
    await req.jwtVerify();
    req.userId = req.user.sub;
    req.userRole = req.user.role;
  });

  app.decorate('requireRole', (...roles: string[]) => {
    return async (req: FastifyRequest) => {
      await req.jwtVerify();
      req.userId = req.user.sub;
      req.userRole = req.user.role;
      if (!roles.includes(req.user.role)) {
        const err: Error & { statusCode?: number } = new Error('Forbidden');
        err.statusCode = 403;
        throw err;
      }
    };
  });
});
