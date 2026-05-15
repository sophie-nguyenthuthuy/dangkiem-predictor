// Convert completed bookings into WaitSample rows for ML training.
//
// A booking becomes a sample when:
//   - status = COMPLETED
//   - checkedInAt + inspectionStartedAt are both set
//   - waitSampleId is null (not yet ingested)
//
// waitMinutes = inspectionStartedAt - checkedInAt
//
// Designed to run nightly:
//   0 2 * * *  cd /app && node dist/jobs/ingest-wait-samples.js

import { prisma } from '../lib/db.js';
import { logger } from '../lib/logger.js';

export async function runIngestWaitSamples(batchSize = 500): Promise<{ ingested: number }> {
  let ingested = 0;

  while (true) {
    const batch = await prisma.booking.findMany({
      where: {
        status: 'COMPLETED',
        checkedInAt: { not: null },
        inspectionStartedAt: { not: null },
        waitSampleId: null,
      },
      include: { vehicle: { select: { vehicleType: true } } },
      take: batchSize,
    });
    if (batch.length === 0) break;

    for (const b of batch) {
      if (!b.checkedInAt || !b.inspectionStartedAt) continue;
      const waitMs = b.inspectionStartedAt.getTime() - b.checkedInAt.getTime();
      const waitMinutes = Math.max(0, Math.round(waitMs / 60_000));

      const sample = await prisma.waitSample.create({
        data: {
          centerId: b.centerId,
          vehicleType: b.vehicle.vehicleType,
          arrivedAt: b.checkedInAt,
          startedAt: b.inspectionStartedAt,
          finishedAt: b.completedAt,
          queueAhead: b.queueAheadAtArrival ?? 0,
          staffCount: b.activeLanesAtArrival ?? 0,
          waitMinutes,
          source: 'booking',
        },
      });

      await prisma.booking.update({
        where: { id: b.id },
        data: { waitSampleId: sample.id },
      });
      ingested++;
    }

    if (batch.length < batchSize) break;
  }

  return { ingested };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runIngestWaitSamples()
    .then((r) => {
      logger.info(r, 'wait-sample ingest complete');
      process.exit(0);
    })
    .catch((err) => {
      logger.error({ err }, 'wait-sample ingest failed');
      process.exit(1);
    });
}
