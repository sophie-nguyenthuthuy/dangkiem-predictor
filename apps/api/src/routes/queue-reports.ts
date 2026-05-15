import type { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { prisma } from '../lib/db.js';

// Haversine distance in meters.
function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

const VERIFY_RADIUS_M = 500;
const SMOOTHING_WINDOW_MIN = 30;
// One person can verify a center at most once per N minutes
const PER_USER_COOLDOWN_MIN = 10;

export async function queueReportRoutes(app: FastifyInstance) {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.post(
    '/centers/:id/queue-reports',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['queue-reports'],
        params: z.object({ id: z.string() }),
        body: z.object({
          queueLength: z.number().int().min(0).max(500),
          laneCount: z.number().int().min(0).max(20).optional(),
          latitude: z.number().min(-90).max(90).optional(),
          longitude: z.number().min(-180).max(180).optional(),
        }),
      },
    },
    async (req, reply) => {
      const center = await prisma.center.findUnique({ where: { id: req.params.id } });
      if (!center) return reply.status(404).send({ message: 'Center not found' });

      // Rate-limit per user/center
      const recent = await prisma.crowdsourcedQueueReport.findFirst({
        where: {
          centerId: center.id,
          userId: req.userId,
          createdAt: { gte: new Date(Date.now() - PER_USER_COOLDOWN_MIN * 60_000) },
        },
      });
      if (recent) {
        return reply.status(429).send({
          message: `Bạn vừa report rồi, vui lòng chờ ${PER_USER_COOLDOWN_MIN} phút.`,
        });
      }

      // Proximity check
      let verified = false;
      if (req.body.latitude !== undefined && req.body.longitude !== undefined) {
        const distance = haversine(
          req.body.latitude,
          req.body.longitude,
          center.latitude,
          center.longitude,
        );
        verified = distance <= VERIFY_RADIUS_M;
      }

      const report = await prisma.crowdsourcedQueueReport.create({
        data: {
          centerId: center.id,
          userId: req.userId,
          queueLength: req.body.queueLength,
          laneCount: req.body.laneCount,
          latitude: req.body.latitude,
          longitude: req.body.longitude,
          verified,
        },
      });

      // Smooth recent verified reports into the live status
      if (verified) {
        const cutoff = new Date(Date.now() - SMOOTHING_WINDOW_MIN * 60_000);
        const verifiedReports = await prisma.crowdsourcedQueueReport.findMany({
          where: { centerId: center.id, verified: true, createdAt: { gte: cutoff } },
          orderBy: { createdAt: 'desc' },
          take: 10,
        });
        // Weighted average: newer reports matter more (linear decay)
        let weightSum = 0;
        let valueSum = 0;
        for (let i = 0; i < verifiedReports.length; i++) {
          const weight = verifiedReports.length - i;
          weightSum += weight;
          valueSum += weight * verifiedReports[i]!.queueLength;
        }
        const smoothed = Math.round(valueSum / Math.max(1, weightSum));
        const reportedLanes = verifiedReports.find((r) => r.laneCount !== null)?.laneCount;

        await prisma.centerLiveStatus.upsert({
          where: { centerId: center.id },
          create: {
            centerId: center.id,
            queueLength: smoothed,
            activeLanes: reportedLanes ?? center.laneCount,
          },
          update: {
            queueLength: smoothed,
            activeLanes: reportedLanes ?? undefined,
            lastUpdatedAt: new Date(),
          },
        });
      }

      return reply.status(201).send({
        id: report.id,
        verified,
        thanks: verified
          ? 'Cảm ơn báo cáo có vị trí, đã cập nhật live status'
          : 'Cảm ơn — chưa xác minh được vị trí, report được ghi nhận nhưng chưa dùng cho live status',
      });
    },
  );

  typed.get(
    '/centers/:id/queue-reports',
    {
      schema: {
        tags: ['queue-reports'],
        params: z.object({ id: z.string() }),
        querystring: z.object({
          sinceMinutes: z.coerce.number().int().min(1).max(1440).default(60),
        }),
      },
    },
    async (req) => {
      const since = new Date(Date.now() - req.query.sinceMinutes * 60_000);
      const reports = await prisma.crowdsourcedQueueReport.findMany({
        where: { centerId: req.params.id, createdAt: { gte: since } },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          queueLength: true,
          laneCount: true,
          verified: true,
          createdAt: true,
        },
        take: 50,
      });
      return { items: reports, since: since.toISOString() };
    },
  );
}
