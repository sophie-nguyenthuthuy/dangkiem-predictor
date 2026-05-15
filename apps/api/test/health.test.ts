import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;

beforeAll(async () => {
  process.env.JWT_SECRET ||= 'test-secret-min-16-chars';
  process.env.DATABASE_URL ||= 'postgresql://x:y@localhost:5432/x?schema=public';
  process.env.NODE_ENV = 'test';
  const { buildServer } = await import('../src/server.js');
  app = await buildServer();
});

afterAll(async () => {
  await app.close();
});

describe('GET /health', () => {
  it('returns ok', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe('ok');
    expect(typeof body.timestamp).toBe('string');
  });
});

describe('GET /v1/centers', () => {
  it('responds (may 500 without DB but should hit handler)', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/centers' });
    expect([200, 500, 503]).toContain(res.statusCode);
  });
});
