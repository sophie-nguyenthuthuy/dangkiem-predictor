import type { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  createProxyJobSchema,
  paginationSchema,
  PROXY_SERVICE_FEE_VND,
  proxyJobStatusSchema,
} from '@dangkiem/shared';
import { prisma } from '../lib/db.js';

const STATUS_TRANSITIONS: Record<string, string[]> = {
  REQUESTED: ['ASSIGNED', 'CANCELLED'],
  ASSIGNED: ['PICKED_UP', 'CANCELLED'],
  PICKED_UP: ['AT_CENTER', 'CANCELLED'],
  AT_CENTER: ['INSPECTED', 'CANCELLED'],
  INSPECTED: ['RETURNING'],
  RETURNING: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: [],
};

export async function proxyJobRoutes(app: FastifyInstance) {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.post(
    '/proxy-jobs',
    {
      preHandler: app.authenticate,
      schema: { tags: ['proxy-jobs'], body: createProxyJobSchema },
    },
    async (req, reply) => {
      const vehicle = await prisma.vehicle.findUnique({ where: { id: req.body.vehicleId } });
      if (!vehicle) return reply.status(404).send({ message: 'Xe không tồn tại' });
      if (vehicle.ownerId !== req.userId && req.userRole !== 'ADMIN') {
        const user = await prisma.user.findUnique({ where: { id: req.userId } });
        const isFleetAdmin =
          user?.role === 'FLEET_ADMIN' && vehicle.fleetId && user.fleetId === vehicle.fleetId;
        if (!isFleetAdmin) {
          return reply.status(403).send({ message: 'Không có quyền với xe này' });
        }
      }

      const job = await prisma.proxyJob.create({
        data: {
          status: 'REQUESTED',
          vehicleId: req.body.vehicleId,
          customerId: req.userId,
          pickupAddress: req.body.pickupAddress,
          pickupTime: new Date(req.body.pickupTime),
          contactPhone: req.body.contactPhone,
          centerId: req.body.preferredCenterId ?? null,
          notes: req.body.notes ?? null,
          feeVnd: PROXY_SERVICE_FEE_VND,
          events: { create: { status: 'REQUESTED', note: 'Yêu cầu được tạo' } },
        },
        include: { events: true },
      });
      return reply.status(201).send(job);
    },
  );

  typed.get(
    '/proxy-jobs',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['proxy-jobs'],
        querystring: paginationSchema.extend({
          status: proxyJobStatusSchema.optional(),
          role: z.enum(['customer', 'worker']).default('customer'),
        }),
      },
    },
    async (req) => {
      const { page, pageSize, status, role } = req.query;
      const where = {
        ...(role === 'customer' ? { customerId: req.userId } : { workerId: req.userId }),
        ...(status ? { status } : {}),
      };
      const [total, items] = await Promise.all([
        prisma.proxyJob.count({ where }),
        prisma.proxyJob.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * pageSize,
          take: pageSize,
          include: {
            vehicle: { select: { plateNumber: true, vehicleType: true } },
            center: { select: { id: true, name: true, code: true } },
          },
        }),
      ]);
      return { total, page, pageSize, items };
    },
  );

  // Worker claims a REQUESTED job
  typed.post(
    '/proxy-jobs/:id/claim',
    {
      preHandler: app.requireRole('PROXY_WORKER', 'ADMIN'),
      schema: { tags: ['proxy-jobs'], params: z.object({ id: z.string() }) },
    },
    async (req, reply) => {
      try {
        const job = await prisma.$transaction(async (tx) => {
          const current = await tx.proxyJob.findUnique({ where: { id: req.params.id } });
          if (!current) throw new Error('NOT_FOUND');
          if (current.status !== 'REQUESTED') throw new Error('NOT_AVAILABLE');
          if (current.workerId) throw new Error('ALREADY_ASSIGNED');
          return tx.proxyJob.update({
            where: { id: req.params.id },
            data: {
              status: 'ASSIGNED',
              workerId: req.userId,
              events: { create: { status: 'ASSIGNED', note: `Worker ${req.userId} đã nhận` } },
            },
          });
        });
        return job;
      } catch (err) {
        const msg = (err as Error).message;
        if (msg === 'NOT_FOUND') return reply.status(404).send({ message: 'Không tìm thấy' });
        if (msg === 'NOT_AVAILABLE')
          return reply.status(409).send({ message: 'Job đã được nhận hoặc không khả dụng' });
        throw err;
      }
    },
  );

  // Update status (worker or admin)
  typed.post(
    '/proxy-jobs/:id/status',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['proxy-jobs'],
        params: z.object({ id: z.string() }),
        body: z.object({
          status: proxyJobStatusSchema,
          note: z.string().max(500).optional(),
        }),
      },
    },
    async (req, reply) => {
      const job = await prisma.proxyJob.findUnique({ where: { id: req.params.id } });
      if (!job) return reply.status(404).send({ message: 'Không tìm thấy' });

      const isCustomer = job.customerId === req.userId;
      const isWorker = job.workerId === req.userId;
      const isAdmin = req.userRole === 'ADMIN';

      // Only customer can CANCEL while REQUESTED/ASSIGNED. Worker/admin can advance.
      const target = req.body.status;
      if (target === 'CANCELLED') {
        if (!isCustomer && !isAdmin) return reply.status(403).send({ message: 'Forbidden' });
      } else {
        if (!isWorker && !isAdmin) return reply.status(403).send({ message: 'Forbidden' });
      }

      const allowed = STATUS_TRANSITIONS[job.status] ?? [];
      if (!allowed.includes(target)) {
        return reply.status(409).send({
          message: `Không thể chuyển từ ${job.status} sang ${target}`,
        });
      }

      const updated = await prisma.proxyJob.update({
        where: { id: job.id },
        data: {
          status: target,
          events: { create: { status: target, note: req.body.note ?? null } },
        },
        include: { events: { orderBy: { createdAt: 'asc' } } },
      });
      return updated;
    },
  );

  typed.get(
    '/proxy-jobs/:id',
    {
      preHandler: app.authenticate,
      schema: { tags: ['proxy-jobs'], params: z.object({ id: z.string() }) },
    },
    async (req, reply) => {
      const job = await prisma.proxyJob.findUnique({
        where: { id: req.params.id },
        include: {
          events: { orderBy: { createdAt: 'asc' } },
          vehicle: true,
          center: true,
        },
      });
      if (!job) return reply.status(404).send({ message: 'Không tìm thấy' });
      const canView =
        job.customerId === req.userId ||
        job.workerId === req.userId ||
        req.userRole === 'ADMIN';
      if (!canView) return reply.status(403).send({ message: 'Forbidden' });
      return job;
    },
  );
}
