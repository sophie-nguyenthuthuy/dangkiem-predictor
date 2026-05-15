// Booking lifecycle transitions. These drive both UX (status badges) and
// the WaitSample ingest pipeline. The transitions capture the queue snapshot
// at check-in time so we can later compute the actual wait and train the
// model on real data.

import type { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { prisma } from '../lib/db.js';

export async function bookingTransitionRoutes(app: FastifyInstance) {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  // Customer presses "Tôi đã đến" upon arrival. Captures queue snapshot.
  typed.post(
    '/bookings/:id/check-in',
    {
      preHandler: app.authenticate,
      schema: { tags: ['bookings'], params: z.object({ id: z.string() }) },
    },
    async (req, reply) => {
      const booking = await prisma.booking.findUnique({
        where: { id: req.params.id },
        include: { center: { include: { liveStatuses: true } } },
      });
      if (!booking) return reply.status(404).send({ message: 'Booking không tồn tại' });
      if (booking.userId !== req.userId && req.userRole !== 'ADMIN') {
        return reply.status(403).send({ message: 'Forbidden' });
      }
      if (booking.status !== 'CONFIRMED') {
        return reply.status(409).send({
          message: `Không thể check-in từ trạng thái ${booking.status}`,
        });
      }

      const live = booking.center.liveStatuses[0];
      const updated = await prisma.booking.update({
        where: { id: booking.id },
        data: {
          status: 'CHECKED_IN',
          checkedInAt: new Date(),
          queueAheadAtArrival: live?.queueLength ?? 0,
          activeLanesAtArrival: live?.activeLanes ?? booking.center.laneCount,
        },
      });
      return updated;
    },
  );

  // Inspector marks "đang kiểm" — wait time = checkedInAt → now
  typed.post(
    '/bookings/:id/start-inspection',
    {
      preHandler: app.requireRole('ADMIN'),
      schema: { tags: ['bookings'], params: z.object({ id: z.string() }) },
    },
    async (req, reply) => {
      const booking = await prisma.booking.findUnique({ where: { id: req.params.id } });
      if (!booking) return reply.status(404).send({ message: 'Booking không tồn tại' });
      if (booking.status !== 'CHECKED_IN') {
        return reply.status(409).send({
          message: `Phải check-in trước khi bắt đầu kiểm (đang ở ${booking.status})`,
        });
      }
      return prisma.booking.update({
        where: { id: booking.id },
        data: { status: 'IN_PROGRESS', inspectionStartedAt: new Date() },
      });
    },
  );

  typed.post(
    '/bookings/:id/complete',
    {
      preHandler: app.requireRole('ADMIN'),
      schema: {
        tags: ['bookings'],
        params: z.object({ id: z.string() }),
        body: z.object({ passed: z.boolean().default(true) }).optional(),
      },
    },
    async (req, reply) => {
      const booking = await prisma.booking.findUnique({ where: { id: req.params.id } });
      if (!booking) return reply.status(404).send({ message: 'Booking không tồn tại' });
      if (booking.status !== 'IN_PROGRESS') {
        return reply.status(409).send({
          message: `Phải đang kiểm (IN_PROGRESS) mới hoàn tất được (đang ở ${booking.status})`,
        });
      }
      return prisma.booking.update({
        where: { id: booking.id },
        data: { status: 'COMPLETED', completedAt: new Date() },
      });
    },
  );

  // Admin: mark no-show (customer didn't arrive)
  typed.post(
    '/bookings/:id/no-show',
    {
      preHandler: app.requireRole('ADMIN'),
      schema: { tags: ['bookings'], params: z.object({ id: z.string() }) },
    },
    async (req, reply) => {
      const booking = await prisma.booking.findUnique({ where: { id: req.params.id } });
      if (!booking) return reply.status(404).send({ message: 'Booking không tồn tại' });
      if (booking.status !== 'CONFIRMED' && booking.status !== 'PENDING') {
        return reply.status(409).send({ message: `Không thể đánh dấu no-show từ ${booking.status}` });
      }
      return prisma.booking.update({
        where: { id: booking.id },
        data: { status: 'NO_SHOW' },
      });
    },
  );
}
