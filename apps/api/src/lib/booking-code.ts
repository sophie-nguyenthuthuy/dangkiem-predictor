import { customAlphabet } from 'nanoid';

// Avoid ambiguous chars (0/O, 1/I) for booking codes used over phone.
const generate = customAlphabet('23456789ABCDEFGHJKLMNPQRSTUVWXYZ', 8);

export function generateBookingCode(): string {
  return `DK-${generate()}`;
}
