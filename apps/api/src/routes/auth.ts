import type { FastifyInstance } from 'fastify';
import argon2 from 'argon2';
import crypto from 'node:crypto';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { loginSchema, signupSchema } from '@dangkiem/shared';
import { prisma } from '../lib/db.js';
import { config } from '../config.js';

function hashRefreshToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function parseTtlSeconds(ttl: string): number {
  // supports "30d", "15m", "1h", "60s"
  const m = ttl.match(/^(\d+)\s*([smhd])$/);
  if (!m) return 60 * 15;
  const n = parseInt(m[1]!, 10);
  const unit = m[2]!;
  return n * { s: 1, m: 60, h: 3600, d: 86400 }[unit as 's' | 'm' | 'h' | 'd']!;
}

export async function authRoutes(app: FastifyInstance) {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.post(
    '/signup',
    {
      schema: {
        tags: ['auth'],
        body: signupSchema,
      },
    },
    async (req, reply) => {
      const { email, password, fullName, phone } = req.body;
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) return reply.status(409).send({ message: 'Email đã được sử dụng' });

      const passwordHash = await argon2.hash(password);
      const user = await prisma.user.create({
        data: { email, passwordHash, fullName, phone, role: 'USER' },
      });

      const tokens = await issueTokens(app, user.id, user.role);
      return reply.status(201).send({
        user: publicUser(user),
        ...tokens,
      });
    },
  );

  typed.post(
    '/login',
    {
      schema: {
        tags: ['auth'],
        body: loginSchema,
      },
    },
    async (req, reply) => {
      const { email, password } = req.body;
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) return reply.status(401).send({ message: 'Sai email hoặc mật khẩu' });

      const ok = await argon2.verify(user.passwordHash, password);
      if (!ok) return reply.status(401).send({ message: 'Sai email hoặc mật khẩu' });

      const tokens = await issueTokens(app, user.id, user.role);
      return { user: publicUser(user), ...tokens };
    },
  );

  typed.post(
    '/refresh',
    {
      schema: {
        tags: ['auth'],
        body: z.object({ refreshToken: z.string().min(1) }),
      },
    },
    async (req, reply) => {
      const { refreshToken } = req.body;
      const tokenHash = hashRefreshToken(refreshToken);
      const record = await prisma.refreshToken.findUnique({
        where: { tokenHash },
        include: { user: true },
      });
      if (!record || record.revokedAt || record.expiresAt < new Date()) {
        return reply.status(401).send({ message: 'Refresh token không hợp lệ' });
      }

      // Rotate: revoke old, issue new
      await prisma.refreshToken.update({
        where: { id: record.id },
        data: { revokedAt: new Date() },
      });
      const tokens = await issueTokens(app, record.user.id, record.user.role);
      return { user: publicUser(record.user), ...tokens };
    },
  );

  typed.post(
    '/logout',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['auth'],
        body: z.object({ refreshToken: z.string().min(1) }).optional(),
      },
    },
    async (req, reply) => {
      if (req.body?.refreshToken) {
        const tokenHash = hashRefreshToken(req.body.refreshToken);
        await prisma.refreshToken
          .update({ where: { tokenHash }, data: { revokedAt: new Date() } })
          .catch(() => undefined);
      }
      return reply.status(204).send();
    },
  );

  typed.get(
    '/me',
    { preHandler: app.authenticate, schema: { tags: ['auth'] } },
    async (req, reply) => {
      const user = await prisma.user.findUnique({ where: { id: req.userId } });
      if (!user) return reply.status(404).send({ message: 'User not found' });
      return publicUser(user);
    },
  );
}

async function issueTokens(app: FastifyInstance, userId: string, role: string) {
  const accessToken = app.jwt.sign({ sub: userId, role });
  const refreshToken = crypto.randomBytes(48).toString('base64url');
  const tokenHash = hashRefreshToken(refreshToken);
  const ttlSec = parseTtlSeconds(config.JWT_REFRESH_TTL);

  await prisma.refreshToken.create({
    data: {
      tokenHash,
      userId,
      expiresAt: new Date(Date.now() + ttlSec * 1000),
    },
  });

  return {
    accessToken,
    refreshToken,
    expiresIn: parseTtlSeconds(config.JWT_ACCESS_TTL),
  };
}

function publicUser(u: {
  id: string;
  email: string;
  fullName: string;
  phone: string;
  role: string;
  fleetId: string | null;
  createdAt: Date;
}) {
  return {
    id: u.id,
    email: u.email,
    fullName: u.fullName,
    phone: u.phone,
    role: u.role,
    fleetId: u.fleetId,
    createdAt: u.createdAt.toISOString(),
  };
}
