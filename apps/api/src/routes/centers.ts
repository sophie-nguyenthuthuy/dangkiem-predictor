import type { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { citySchema, paginationSchema } from '@dangkiem/shared';
import { prisma } from '../lib/db.js';

export async function centerRoutes(app: FastifyInstance) {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.get(
    '/centers',
    {
      schema: {
        tags: ['centers'],
        querystring: paginationSchema.extend({
          city: citySchema.optional(),
          search: z.string().min(1).max(80).optional(),
          includeSuspended: z.coerce.boolean().default(false),
        }),
      },
    },
    async (req) => {
      const { city, search, includeSuspended, page, pageSize } = req.query;
      const where = {
        ...(city ? { city } : {}),
        ...(includeSuspended ? {} : { suspended: false }),
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' as const } },
                { code: { contains: search, mode: 'insensitive' as const } },
                { district: { contains: search, mode: 'insensitive' as const } },
              ],
            }
          : {}),
      };

      const [total, items] = await Promise.all([
        prisma.center.count({ where }),
        prisma.center.findMany({
          where,
          orderBy: [{ city: 'asc' }, { code: 'asc' }],
          skip: (page - 1) * pageSize,
          take: pageSize,
          include: { liveStatuses: true },
        }),
      ]);

      return {
        total,
        page,
        pageSize,
        items: items.map((c) => ({
          id: c.id,
          code: c.code,
          name: c.name,
          city: c.city,
          district: c.district,
          address: c.address,
          latitude: c.latitude,
          longitude: c.longitude,
          phone: c.phone,
          operatingHours: {
            open: c.openTime,
            close: c.closeTime,
            daysClosed: c.daysClosed,
          },
          laneCount: c.laneCount,
          supportedVehicleTypes: c.supportedVehicleTypes,
          capacityPerHour: c.capacityPerHour,
          suspended: c.suspended,
          liveStatus: c.liveStatuses[0]
            ? {
                queueLength: c.liveStatuses[0].queueLength,
                activeLanes: c.liveStatuses[0].activeLanes,
                lastUpdatedAt: c.liveStatuses[0].lastUpdatedAt.toISOString(),
              }
            : null,
        })),
      };
    },
  );

  typed.get(
    '/centers/:id',
    { schema: { tags: ['centers'], params: z.object({ id: z.string() }) } },
    async (req, reply) => {
      const center = await prisma.center.findUnique({
        where: { id: req.params.id },
        include: { liveStatuses: true, lanes: { where: { active: true } } },
      });
      if (!center) return reply.status(404).send({ message: 'Center not found' });
      return center;
    },
  );

  // Admin-only: ingest live queue snapshots (would be called by on-site staff or scraper)
  typed.post(
    '/centers/:id/live-status',
    {
      preHandler: app.requireRole('ADMIN'),
      schema: {
        tags: ['centers'],
        params: z.object({ id: z.string() }),
        body: z.object({
          queueLength: z.number().int().min(0),
          activeLanes: z.number().int().min(0),
        }),
      },
    },
    async (req) => {
      const status = await prisma.centerLiveStatus.upsert({
        where: { centerId: req.params.id },
        create: {
          centerId: req.params.id,
          queueLength: req.body.queueLength,
          activeLanes: req.body.activeLanes,
        },
        update: {
          queueLength: req.body.queueLength,
          activeLanes: req.body.activeLanes,
          lastUpdatedAt: new Date(),
        },
      });
      return status;
    },
  );
}
