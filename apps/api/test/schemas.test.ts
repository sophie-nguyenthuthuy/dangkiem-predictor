import { describe, expect, it } from 'vitest';

// We test the heuristic indirectly via the exported predictWaitTime,
// but since it makes a network call, here we just sanity-check the
// shape and bounds of fallback behavior by mocking config + undici.
// For a deeper test, use a Vitest mock of `undici`'s `request`.
import { plateNumberSchema, phoneSchema, signupSchema } from '@dangkiem/shared';

describe('plate number validation', () => {
  it('accepts standard 4-digit plate', () => {
    expect(plateNumberSchema.parse('29A-12345')).toBe('29A-12345');
  });

  it('accepts plate with decimal suffix (motorbike-style on car)', () => {
    expect(plateNumberSchema.parse('30E-678.90')).toBe('30E-678.90');
  });

  it('rejects malformed plates', () => {
    expect(() => plateNumberSchema.parse('ABCDEF')).toThrow();
    expect(() => plateNumberSchema.parse('12-345')).toThrow();
  });

  it('normalizes to uppercase', () => {
    expect(plateNumberSchema.parse('29a-12345')).toBe('29A-12345');
  });
});

describe('phone validation', () => {
  it('accepts VN phones starting with 0', () => {
    expect(phoneSchema.parse('0901234567')).toBe('0901234567');
  });

  it('accepts +84 prefix', () => {
    expect(phoneSchema.parse('+84901234567')).toBe('+84901234567');
  });

  it('rejects too-short numbers', () => {
    expect(() => phoneSchema.parse('0901')).toThrow();
  });
});

describe('signup validation', () => {
  it('requires a strong-enough password', () => {
    expect(() =>
      signupSchema.parse({
        email: 'a@b.com',
        password: 'short',
        fullName: 'Ng Van A',
        phone: '0901234567',
      }),
    ).toThrow();
  });
});
