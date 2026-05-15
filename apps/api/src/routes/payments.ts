import type { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { customAlphabet } from 'nanoid';
import { prisma } from '../lib/db.js';
import { config } from '../config.js';
import {
  buildPayUrl,
  isVnpaySuccess,
  verifyCallback,
  VNPAY_RESPONSE_MESSAGES_VI,
  type VnpayConfig,
} from '../lib/vnpay.js';

const txnRefGen = customAlphabet('0123456789', 14);

function vnpayConfig(): VnpayConfig | null {
  if (!config.VNPAY_TMN_CODE || !config.VNPAY_HASH_SECRET) return null;
  return {
    tmnCode: config.VNPAY_TMN_CODE,
    hashSecret: config.VNPAY_HASH_SECRET,
    payUrl: config.VNPAY_PAY_URL,
    returnUrl: config.VNPAY_RETURN_URL,
  };
}

export async function paymentRoutes(app: FastifyInstance) {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.post(
    '/payments/vnpay/init',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['payments'],
        body: z.object({
          bookingId: z.string().min(1),
          bankCode: z.string().min(2).max(20).optional(),
          locale: z.enum(['vn', 'en']).default('vn'),
        }),
      },
    },
    async (req, reply) => {
      const cfg = vnpayConfig();
      if (!cfg) {
        return reply
          .status(503)
          .send({ message: 'VNPay chưa được cấu hình (VNPAY_TMN_CODE/VNPAY_HASH_SECRET)' });
      }

      const booking = await prisma.booking.findUnique({
        where: { id: req.body.bookingId },
        include: { payments: { orderBy: { createdAt: 'desc' }, take: 1 } },
      });
      if (!booking) return reply.status(404).send({ message: 'Booking không tồn tại' });
      if (booking.userId !== req.userId) {
        return reply.status(403).send({ message: 'Không có quyền thanh toán cho booking này' });
      }
      if (booking.status === 'CANCELLED') {
        return reply.status(409).send({ message: 'Booking đã bị hủy' });
      }
      // If there's a pending payment created in the last 10 minutes, reuse its URL
      const recent = booking.payments[0];
      if (
        recent?.status === 'PENDING' &&
        recent.expiresAt > new Date() &&
        recent.redirectUrl
      ) {
        return { paymentId: recent.id, redirectUrl: recent.redirectUrl };
      }

      const txnRef = `DK${txnRefGen()}`;
      const createdAt = new Date();
      const expiresAt = new Date(createdAt.getTime() + 15 * 60 * 1000);
      const ipAddr =
        (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ??
        req.ip ??
        '0.0.0.0';

      const redirectUrl = buildPayUrl(cfg, {
        txnRef,
        amountVnd: booking.feeVnd,
        orderInfo: `Phi dang kiem booking ${booking.bookingCode}`,
        ipAddr,
        createdAt,
        expiresAt,
        locale: req.body.locale,
        bankCode: req.body.bankCode,
      });

      const payment = await prisma.payment.create({
        data: {
          status: 'PENDING',
          provider: 'VNPAY',
          amountVnd: booking.feeVnd,
          userId: req.userId,
          bookingId: booking.id,
          txnRef,
          redirectUrl,
          expiresAt,
        },
      });

      return { paymentId: payment.id, redirectUrl };
    },
  );

  // Browser-facing return — for UX only, trust the IPN instead
  typed.get(
    '/payments/vnpay/return',
    {
      schema: {
        tags: ['payments'],
        querystring: z.record(z.string()),
      },
    },
    async (req, reply) => {
      const cfg = vnpayConfig();
      if (!cfg) return reply.status(503).send({ message: 'VNPay chưa được cấu hình' });
      const result = verifyCallback(req.query as Record<string, string>, cfg.hashSecret);
      const status = result.valid && isVnpaySuccess(result.responseCode, result.transactionStatus)
        ? 'success'
        : 'failure';
      return {
        status,
        txnRef: result.txnRef,
        amountVnd: result.amountVnd,
        message:
          VNPAY_RESPONSE_MESSAGES_VI[result.responseCode ?? ''] ?? result.reason ?? 'Không xác định',
      };
    },
  );

  // Server-to-server IPN — VNPay expects a specific JSON response format
  typed.post(
    '/payments/vnpay/ipn',
    {
      schema: {
        tags: ['payments'],
        body: z.record(z.string()),
      },
    },
    async (req, reply) => {
      const cfg = vnpayConfig();
      if (!cfg) {
        return reply.send({ RspCode: '99', Message: 'Config missing' });
      }
      const verified = verifyCallback(req.body as Record<string, string>, cfg.hashSecret);
      if (!verified.valid || !verified.txnRef) {
        return reply.send({ RspCode: '97', Message: 'Invalid signature' });
      }

      const payment = await prisma.payment.findUnique({
        where: { txnRef: verified.txnRef },
        include: { booking: true },
      });
      if (!payment) return reply.send({ RspCode: '01', Message: 'Order not found' });
      if (verified.amountVnd !== payment.amountVnd) {
        return reply.send({ RspCode: '04', Message: 'Invalid amount' });
      }
      if (payment.status === 'PAID') {
        // Idempotent — VNPay may retry
        return reply.send({ RspCode: '02', Message: 'Order already confirmed' });
      }

      const success = isVnpaySuccess(verified.responseCode, verified.transactionStatus);
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: success ? 'PAID' : 'FAILED',
          providerRef: verified.vnpTransactionNo,
          providerCode: verified.responseCode,
          providerMessage:
            VNPAY_RESPONSE_MESSAGES_VI[verified.responseCode ?? ''] ?? null,
          paidAt: success ? new Date() : null,
          ipnReceivedAt: new Date(),
        },
      });

      return reply.send({ RspCode: '00', Message: 'Confirm Success' });
    },
  );

  typed.get(
    '/payments/:id',
    {
      preHandler: app.authenticate,
      schema: { tags: ['payments'], params: z.object({ id: z.string() }) },
    },
    async (req, reply) => {
      const payment = await prisma.payment.findUnique({
        where: { id: req.params.id },
        include: { booking: { select: { bookingCode: true, status: true } } },
      });
      if (!payment) return reply.status(404).send({ message: 'Payment not found' });
      if (payment.userId !== req.userId && req.userRole !== 'ADMIN') {
        return reply.status(403).send({ message: 'Forbidden' });
      }
      return payment;
    },
  );
}
