import { Prisma } from '@prisma/client';
import { INSPECTION_FEES_VND, type VehicleType } from '@dangkiem/shared';
import { prisma } from '../lib/db.js';
import { generateBookingCode } from '../lib/booking-code.js';

export class BookingError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
  }
}

interface CreateBookingArgs {
  userId: string;
  centerId: string;
  slotId: string;
  vehicleId: string;
  notes?: string | undefined;
  predictedWaitMinutes?: number | undefined;
}

export async function createBooking(args: CreateBookingArgs) {
  return prisma.$transaction(
    async (tx) => {
      const slot = await tx.slot.findUnique({ where: { id: args.slotId } });
      if (!slot) throw new BookingError('Slot không tồn tại', 404);
      if (slot.centerId !== args.centerId) {
        throw new BookingError('Slot không thuộc trung tâm này', 400);
      }
      if (slot.startsAt < new Date()) {
        throw new BookingError('Không thể đặt slot trong quá khứ', 400);
      }
      if (slot.bookedCount >= slot.capacity) {
        throw new BookingError('Slot đã hết chỗ', 409);
      }

      const vehicle = await tx.vehicle.findUnique({ where: { id: args.vehicleId } });
      if (!vehicle) throw new BookingError('Xe không tồn tại', 404);
      if (vehicle.ownerId !== args.userId) {
        // Allow if user is fleet admin of vehicle's fleet
        const user = await tx.user.findUnique({ where: { id: args.userId } });
        const isFleetAdmin =
          user?.role === 'FLEET_ADMIN' && vehicle.fleetId && user.fleetId === vehicle.fleetId;
        const isAdmin = user?.role === 'ADMIN';
        if (!isFleetAdmin && !isAdmin) {
          throw new BookingError('Không có quyền đặt cho xe này', 403);
        }
      }

      // Optimistic locking: increment bookedCount only if version matches
      const updated = await tx.slot.updateMany({
        where: { id: slot.id, version: slot.version, bookedCount: { lt: slot.capacity } },
        data: { bookedCount: { increment: 1 }, version: { increment: 1 } },
      });
      if (updated.count !== 1) {
        throw new BookingError('Slot vừa được người khác đặt, vui lòng chọn slot khác', 409);
      }

      const fee = INSPECTION_FEES_VND[vehicle.vehicleType as VehicleType] ?? 240000;

      const booking = await tx.booking.create({
        data: {
          bookingCode: generateBookingCode(),
          status: 'CONFIRMED',
          centerId: args.centerId,
          slotId: args.slotId,
          vehicleId: args.vehicleId,
          userId: args.userId,
          notes: args.notes,
          predictedWaitMinutes: args.predictedWaitMinutes,
          feeVnd: fee + 50000, // + lệ phí cấp giấy chứng nhận
        },
      });

      return booking;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
  );
}

export async function cancelBooking(userId: string, userRole: string, bookingId: string) {
  return prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findUnique({ where: { id: bookingId } });
    if (!booking) throw new BookingError('Booking không tồn tại', 404);
    if (booking.userId !== userId && userRole !== 'ADMIN') {
      throw new BookingError('Không có quyền hủy booking này', 403);
    }
    if (booking.status === 'CANCELLED') {
      throw new BookingError('Booking đã được hủy', 409);
    }
    if (booking.status !== 'CONFIRMED' && booking.status !== 'PENDING') {
      throw new BookingError(`Không thể hủy booking ở trạng thái ${booking.status}`, 409);
    }

    await tx.slot.update({
      where: { id: booking.slotId },
      data: { bookedCount: { decrement: 1 }, version: { increment: 1 } },
    });

    return tx.booking.update({
      where: { id: bookingId },
      data: { status: 'CANCELLED' },
    });
  });
}
