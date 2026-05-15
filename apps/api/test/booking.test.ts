import { describe, expect, it } from 'vitest';
import { generateBookingCode } from '../src/lib/booking-code.js';

describe('generateBookingCode', () => {
  it('starts with DK- prefix', () => {
    const code = generateBookingCode();
    expect(code.startsWith('DK-')).toBe(true);
  });

  it('uses only unambiguous characters (no 0/O/1/I)', () => {
    for (let i = 0; i < 200; i++) {
      const code = generateBookingCode().slice(3); // drop DK-
      expect(code).toMatch(/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]+$/);
    }
  });

  it('generates 8-char codes after the prefix', () => {
    expect(generateBookingCode()).toHaveLength('DK-'.length + 8);
  });

  it('is unique across many calls', () => {
    const codes = new Set<string>();
    for (let i = 0; i < 5000; i++) codes.add(generateBookingCode());
    expect(codes.size).toBe(5000);
  });
});
