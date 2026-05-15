// Notify owners of vehicles whose tem (inspection sticker) is expiring soon.
// Designed to be run daily via cron, e.g.:
//   0 8 * * *  cd /app && node dist/jobs/notify-expiring.js
//
// For each vehicle with temExpiresAt within {7, 30} days that hasn't already
// been notified for that bucket, enqueue + send a notification.

import { prisma } from '../lib/db.js';
import { logger } from '../lib/logger.js';
import { send, type Channel } from '../lib/notifier.js';

const BUCKETS = [
  { days: 7, topic: 'tem.expiring.7d', urgency: 'gấp' },
  { days: 30, topic: 'tem.expiring.30d', urgency: 'sắp tới' },
] as const;

function pickChannel(user: { email: string | null; phone: string | null }): Channel {
  if (user.email) return 'EMAIL';
  if (user.phone) return 'SMS';
  return 'CONSOLE';
}

function renderBody(vehicle: { plateNumber: string; temExpiresAt: Date }, days: number): {
  subject: string;
  body: string;
} {
  const dateStr = vehicle.temExpiresAt.toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
  return {
    subject: `Tem kiểm định xe ${vehicle.plateNumber} sắp hết hạn (còn ${days} ngày)`,
    body:
      `Xe ${vehicle.plateNumber} có tem đăng kiểm hết hạn ngày ${dateStr} (còn ${days} ngày).\n\n` +
      `Đặt slot trước để tránh xếp hàng 6-12 tiếng tại trung tâm:\n` +
      `https://dangkiem.app/centers\n\n` +
      `Hoặc dùng dịch vụ "đi đăng kiểm hộ" — chúng tôi nhận xe, làm thủ tục và trả tận nơi.`,
  };
}

export async function runNotifyExpiring(now: Date = new Date()): Promise<{ created: number; sent: number; failed: number }> {
  let created = 0;
  let sent = 0;
  let failed = 0;

  for (const bucket of BUCKETS) {
    const lower = new Date(now.getTime() + (bucket.days - 1) * 86400000);
    const upper = new Date(now.getTime() + bucket.days * 86400000);

    const vehicles = await prisma.vehicle.findMany({
      where: { temExpiresAt: { gte: lower, lt: upper } },
      include: { owner: { select: { id: true, email: true, phone: true } } },
    });

    for (const v of vehicles) {
      if (!v.temExpiresAt) continue;
      const dedupeKey = `${v.id}:${bucket.topic}`;
      const channel = pickChannel(v.owner);
      const recipient =
        channel === 'EMAIL' ? v.owner.email! : channel === 'SMS' ? v.owner.phone! : v.owner.id;

      const rendered = renderBody({ plateNumber: v.plateNumber, temExpiresAt: v.temExpiresAt }, bucket.days);

      // Create the row first — unique dedupeKey gives idempotency
      let row;
      try {
        row = await prisma.notification.create({
          data: {
            userId: v.owner.id,
            vehicleId: v.id,
            channel,
            topic: bucket.topic,
            recipient,
            subject: rendered.subject,
            body: rendered.body,
            dedupeKey,
            status: 'PENDING',
          },
        });
        created++;
      } catch {
        // Already exists — skip
        continue;
      }

      const result = await send({
        channel,
        recipient,
        subject: rendered.subject,
        body: rendered.body,
        topic: bucket.topic,
      });

      await prisma.notification.update({
        where: { id: row.id },
        data: {
          status: result.ok ? 'SENT' : 'FAILED',
          providerRef: result.providerRef,
          error: result.error,
          sentAt: result.ok ? new Date() : null,
        },
      });
      if (result.ok) sent++;
      else failed++;
    }
  }

  return { created, sent, failed };
}

// Entry point when invoked as a script (`node dist/jobs/notify-expiring.js`).
if (import.meta.url === `file://${process.argv[1]}`) {
  runNotifyExpiring()
    .then((r) => {
      logger.info(r, 'notify-expiring complete');
      process.exit(0);
    })
    .catch((err) => {
      logger.error({ err }, 'notify-expiring failed');
      process.exit(1);
    });
}
