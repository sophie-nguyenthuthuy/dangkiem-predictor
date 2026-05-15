import type { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { createVehicleSchema, paginationSchema } from '@dangkiem/shared';
import { prisma } from '../lib/db.js';

export async function vehicleRoutes(app: FastifyInstance) {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.post(
    '/vehicles',
    {
      preHandler: app.authenticate,
      schema: { tags: ['vehicles'], body: createVehicleSchema },
    },
    async (req, reply) => {
      const fleetId = req.body.fleetId;
      if (fleetId) {
        const user = await prisma.user.findUnique({ where: { id: req.userId } });
        if (!user || user.fleetId !== fleetId || user.role !== 'FLEET_ADMIN') {
          return reply
            .status(403)
            .send({ message: 'Chỉ FLEET_ADMIN của fleet này mới có thể tạo xe cho fleet' });
        }
      }
      const vehicle = await prisma.vehicle.create({
        data: {
          plateNumber: req.body.plateNumber,
          vehicleType: req.body.vehicleType,
          brand: req.body.brand,
          model: req.body.model,
          yearOfManufacture: req.body.yearOfManufacture,
          vin: req.body.vin ?? null,
          ownerId: req.userId,
          fleetId: fleetId ?? null,
        },
      });
      return reply.status(201).send(vehicle);
    },
  );

  typed.get(
    '/vehicles',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['vehicles'],
        querystring: paginationSchema.extend({
          fleetId: z.string().optional(),
          expiringWithinDays: z.coerce.number().int().min(0).max(365).optional(),
        }),
      },
    },
    async (req) => {
      const { page, pageSize, fleetId, expiringWithinDays } = req.query;
      const where = {
        ...(fleetId ? { fleetId } : { ownerId: req.userId }),
        ...(expiringWithinDays !== undefined
          ? {
              temExpiresAt: {
                lte: new Date(Date.now() + expiringWithinDays * 86400000),
                gte: new Date(),
              },
            }
          : {}),
      };
      const [total, items] = await Promise.all([
        prisma.vehicle.count({ where }),
        prisma.vehicle.findMany({
          where,
          orderBy: [{ temExpiresAt: 'asc' }, { plateNumber: 'asc' }],
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
      ]);
      return { total, page, pageSize, items };
    },
  );

  typed.get(
    '/vehicles/:id',
    {
      preHandler: app.authenticate,
      schema: { tags: ['vehicles'], params: z.object({ id: z.string() }) },
    },
    async (req, reply) => {
      const vehicle = await prisma.vehicle.findUnique({ where: { id: req.params.id } });
      if (!vehicle) return reply.status(404).send({ message: 'Vehicle not found' });
      const user = await prisma.user.findUnique({ where: { id: req.userId } });
      const isOwner = vehicle.ownerId === req.userId;
      const isFleetAdmin =
        user?.role === 'FLEET_ADMIN' && vehicle.fleetId && user.fleetId === vehicle.fleetId;
      if (!isOwner && !isFleetAdmin && req.userRole !== 'ADMIN') {
        return reply.status(403).send({ message: 'Forbidden' });
      }
      return vehicle;
    },
  );
}
