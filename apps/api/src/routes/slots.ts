import type { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { prisma } from '../lib/db.js';

export async function slotRoutes(app: FastifyInstance) {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.get(
    '/centers/:id/slots',
    {
      schema: {
        tags: ['slots'],
        params: z.object({ id: z.string() }),
        querystring: z.object({
          from: z.string().datetime().optional(),
          to: z.string().datetime().optional(),
          onlyAvailable: z.coerce.boolean().default(false),
        }),
      },
    },
    async (req, reply) => {
      const center = await prisma.center.findUnique({ where: { id: req.params.id } });
      if (!center) return reply.status(404).send({ message: 'Center not found' });

      const from = req.query.from ? new Date(req.query.from) : new Date();
      const to = req.query.to
        ? new Date(req.query.to)
        : new Date(from.getTime() + 7 * 24 * 60 * 60 * 1000);

      const slots = await prisma.slot.findMany({
        where: {
          centerId: req.params.id,
          startsAt: { gte: from, lte: to },
          ...(req.query.onlyAvailable ? { bookedCount: { lt: center.capacityPerHour } } : {}),
        },
        orderBy: { startsAt: 'asc' },
      });

      return slots.map((s) => ({
        id: s.id,
        centerId: s.centerId,
        startsAt: s.startsAt.toISOString(),
        endsAt: s.endsAt.toISOString(),
        capacity: s.capacity,
        bookedCount: s.bookedCount,
        available: s.bookedCount < s.capacity,
      }));
    },
  );
}
