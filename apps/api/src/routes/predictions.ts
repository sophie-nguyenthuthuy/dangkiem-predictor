import type { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { predictionQuerySchema } from '@dangkiem/shared';
import { prisma } from '../lib/db.js';
import { predictWaitTime } from '../lib/predictor-client.js';

export async function predictionRoutes(app: FastifyInstance) {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.get(
    '/predictions',
    { schema: { tags: ['predictions'], querystring: predictionQuerySchema } },
    async (req, reply) => {
      const { centerId, vehicleType, arrivalTime } = req.query;
      const center = await prisma.center.findUnique({
        where: { id: centerId },
        include: { liveStatuses: true },
      });
      if (!center) return reply.status(404).send({ message: 'Center not found' });
      if (center.suspended) {
        return reply.status(409).send({ message: 'Trung tâm hiện đang tạm dừng hoạt động' });
      }
      if (!center.supportedVehicleTypes.includes(vehicleType)) {
        return reply.status(400).send({
          message: `Trung tâm không hỗ trợ loại xe ${vehicleType}`,
          supported: center.supportedVehicleTypes,
        });
      }

      const live = center.liveStatuses[0];
      const arriveAt = arrivalTime ? new Date(arrivalTime) : new Date();

      const queueAhead = live?.queueLength ?? 0;
      const activeLanes = live?.activeLanes ?? center.laneCount;

      const prediction = await predictWaitTime({
        centerId: center.id,
        vehicleType,
        arrivalTime: arriveAt.toISOString(),
        laneCount: center.laneCount,
        capacityPerHour: center.capacityPerHour,
        queueLength: queueAhead,
        activeLanes,
      });

      return {
        centerId: center.id,
        ...prediction,
        queueAhead,
        generatedAt: new Date().toISOString(),
      };
    },
  );
}
