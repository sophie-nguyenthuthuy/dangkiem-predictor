import type { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { bookingStatusSchema, createBookingSchema, paginationSchema } from '@dangkiem/shared';
import { prisma } from '../lib/db.js';
import { BookingError, cancelBooking, createBooking } from '../services/booking.service.js';
import { predictWaitTime } from '../lib/predictor-client.js';

export async function bookingRoutes(app: FastifyInstance) {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.post(
    '/bookings',
    {
      preHandler: app.authenticate,
      schema: { tags: ['bookings'], body: createBookingSchema },
    },
    async (req, reply) => {
      const slot = await prisma.slot.findUnique({
        where: { id: req.body.slotId },
        include: { center: { include: { liveStatuses: true } } },
      });
      const vehicle = await prisma.vehicle.findUnique({ where: { id: req.body.vehicleId } });

      let predictedWait: number | undefined;
      if (slot && vehicle) {
        const live = slot.center.liveStatuses[0];
        const prediction = await predictWaitTime({
          centerId: slot.centerId,
          vehicleType: vehicle.vehicleType,
          arrivalTime: slot.startsAt.toISOString(),
          laneCount: slot.center.laneCount,
          capacityPerHour: slot.center.capacityPerHour,
          queueLength: live?.queueLength ?? 0,
          activeLanes: live?.activeLanes ?? slot.center.laneCount,
        });
        predictedWait = prediction.predictedWaitMinutes;
      }

      try {
        const booking = await createBooking({
          userId: req.userId,
          centerId: req.body.centerId,
          slotId: req.body.slotId,
          vehicleId: req.body.vehicleId,
          notes: req.body.notes,
          predictedWaitMinutes: predictedWait,
        });
        return reply.status(201).send(booking);
      } catch (err) {
        if (err instanceof BookingError) {
          return reply.status(err.statusCode).send({ message: err.message });
        }
        throw err;
      }
    },
  );

  typed.get(
    '/bookings',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['bookings'],
        querystring: paginationSchema.extend({
          status: bookingStatusSchema.optional(),
        }),
      },
    },
    async (req) => {
      const { page, pageSize, status } = req.query;
      const where = {
        userId: req.userId,
        ...(status ? { status } : {}),
      };
      const [total, items] = await Promise.all([
        prisma.booking.count({ where }),
        prisma.booking.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * pageSize,
          take: pageSize,
          include: {
            center: { select: { id: true, code: true, name: true, address: true } },
            slot: { select: { startsAt: true, endsAt: true } },
            vehicle: { select: { plateNumber: true, vehicleType: true } },
          },
        }),
      ]);
      return { total, page, pageSize, items };
    },
  );

  typed.get(
    '/bookings/:id',
    {
      preHandler: app.authenticate,
      schema: { tags: ['bookings'], params: z.object({ id: z.string() }) },
    },
    async (req, reply) => {
      const booking = await prisma.booking.findUnique({
        where: { id: req.params.id },
        include: { center: true, slot: true, vehicle: true },
      });
      if (!booking) return reply.status(404).send({ message: 'Booking not found' });
      if (booking.userId !== req.userId && req.userRole !== 'ADMIN') {
        return reply.status(403).send({ message: 'Forbidden' });
      }
      return booking;
    },
  );

  typed.post(
    '/bookings/:id/cancel',
    {
      preHandler: app.authenticate,
      schema: { tags: ['bookings'], params: z.object({ id: z.string() }) },
    },
    async (req, reply) => {
      try {
        return await cancelBooking(req.userId, req.userRole, req.params.id);
      } catch (err) {
        if (err instanceof BookingError) {
          return reply.status(err.statusCode).send({ message: err.message });
        }
        throw err;
      }
    },
  );
}
