import type { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { createFleetSchema, paginationSchema } from '@dangkiem/shared';
import { prisma } from '../lib/db.js';

export async function fleetRoutes(app: FastifyInstance) {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.post(
    '/fleets',
    {
      preHandler: app.authenticate,
      schema: { tags: ['fleets'], body: createFleetSchema },
    },
    async (req, reply) => {
      const user = await prisma.user.findUnique({ where: { id: req.userId } });
      if (!user) return reply.status(404).send({ message: 'User not found' });
      if (user.fleetId) {
        return reply.status(409).send({ message: 'Bạn đã thuộc một fleet' });
      }

      const fleet = await prisma.$transaction(async (tx) => {
        const created = await tx.fleet.create({ data: req.body });
        await tx.user.update({
          where: { id: req.userId },
          data: { fleetId: created.id, role: 'FLEET_ADMIN' },
        });
        return created;
      });
      return reply.status(201).send(fleet);
    },
  );

  typed.get(
    '/fleets/me',
    {
      preHandler: app.requireRole('FLEET_ADMIN', 'ADMIN'),
      schema: { tags: ['fleets'] },
    },
    async (req, reply) => {
      const user = await prisma.user.findUnique({ where: { id: req.userId } });
      if (!user?.fleetId) return reply.status(404).send({ message: 'Bạn chưa thuộc fleet nào' });

      const [fleet, vehicleCount, upcomingBookings, expiringSoon] = await Promise.all([
        prisma.fleet.findUnique({ where: { id: user.fleetId } }),
        prisma.vehicle.count({ where: { fleetId: user.fleetId } }),
        prisma.booking.count({
          where: {
            vehicle: { fleetId: user.fleetId },
            status: { in: ['PENDING', 'CONFIRMED'] },
          },
        }),
        prisma.vehicle.count({
          where: {
            fleetId: user.fleetId,
            temExpiresAt: {
              gte: new Date(),
              lte: new Date(Date.now() + 30 * 86400000),
            },
          },
        }),
      ]);

      return {
        fleet,
        stats: { vehicleCount, upcomingBookings, expiringSoon },
      };
    },
  );

  // Key B2B value prop: which fleet vehicles need inspection soon
  typed.get(
    '/fleets/me/upcoming-expirations',
    {
      preHandler: app.requireRole('FLEET_ADMIN', 'ADMIN'),
      schema: {
        tags: ['fleets'],
        querystring: paginationSchema.extend({
          withinDays: z.coerce.number().int().min(1).max(365).default(60),
        }),
      },
    },
    async (req, reply) => {
      const user = await prisma.user.findUnique({ where: { id: req.userId } });
      if (!user?.fleetId) return reply.status(404).send({ message: 'Bạn chưa thuộc fleet nào' });

      const { page, pageSize, withinDays } = req.query;
      const cutoff = new Date(Date.now() + withinDays * 86400000);
      const where = {
        fleetId: user.fleetId,
        temExpiresAt: { not: null, lte: cutoff },
      };
      const [total, items] = await Promise.all([
        prisma.vehicle.count({ where }),
        prisma.vehicle.findMany({
          where,
          orderBy: { temExpiresAt: 'asc' },
          skip: (page - 1) * pageSize,
          take: pageSize,
          select: {
            id: true,
            plateNumber: true,
            vehicleType: true,
            brand: true,
            model: true,
            temExpiresAt: true,
          },
        }),
      ]);
      return { total, page, pageSize, items, cutoff: cutoff.toISOString() };
    },
  );

  typed.post(
    '/fleets/me/members',
    {
      preHandler: app.requireRole('FLEET_ADMIN', 'ADMIN'),
      schema: {
        tags: ['fleets'],
        body: z.object({ userEmail: z.string().email() }),
      },
    },
    async (req, reply) => {
      const admin = await prisma.user.findUnique({ where: { id: req.userId } });
      if (!admin?.fleetId) return reply.status(400).send({ message: 'Bạn chưa thuộc fleet' });

      const target = await prisma.user.findUnique({ where: { email: req.body.userEmail } });
      if (!target) return reply.status(404).send({ message: 'User không tồn tại' });
      if (target.fleetId) return reply.status(409).send({ message: 'User đã thuộc fleet khác' });

      const updated = await prisma.user.update({
        where: { id: target.id },
        data: { fleetId: admin.fleetId },
      });
      return updated;
    },
  );
}
