import type { FastifyInstance } from 'fastify';
import { prisma } from '../lib/db.js';
import { config } from '../config.js';
import { request } from 'undici';

export async function healthRoutes(app: FastifyInstance) {
  app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

  app.get('/health/ready', async (_req, reply) => {
    const checks: Record<string, { ok: boolean; error?: string }> = {};

    try {
      await prisma.$queryRaw`SELECT 1`;
      checks.database = { ok: true };
    } catch (err) {
      checks.database = { ok: false, error: (err as Error).message };
    }

    try {
      const res = await request(`${config.PREDICTOR_URL}/health`, {
        method: 'GET',
        bodyTimeout: 1000,
        headersTimeout: 1000,
      });
      checks.predictor = { ok: res.statusCode === 200 };
      await res.body.dump();
    } catch (err) {
      checks.predictor = { ok: false, error: (err as Error).message };
    }

    const allOk = Object.values(checks).every((c) => c.ok);
    reply.status(allOk ? 200 : 503).send({ status: allOk ? 'ready' : 'degraded', checks });
  });
}
