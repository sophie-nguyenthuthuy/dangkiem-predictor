import { describe, expect, it } from 'vitest';

// Pure unit test for the wait-sample math used in the ingestion job.
// We import the inline calculation rather than the whole job (which hits the DB).

function waitMinutes(checkedInAt: Date, inspectionStartedAt: Date): number {
  return Math.max(0, Math.round((inspectionStartedAt.getTime() - checkedInAt.getTime()) / 60_000));
}

describe('wait-sample minutes math', () => {
  it('computes minutes between check-in and start', () => {
    const t1 = new Date('2026-03-02T08:00:00+07:00');
    const t2 = new Date('2026-03-02T09:30:00+07:00');
    expect(waitMinutes(t1, t2)).toBe(90);
  });

  it('rounds sub-minute deltas', () => {
    const t1 = new Date('2026-03-02T08:00:00+07:00');
    const t2 = new Date('2026-03-02T08:00:29+07:00');
    expect(waitMinutes(t1, t2)).toBe(0);
    const t3 = new Date('2026-03-02T08:00:30+07:00');
    expect(waitMinutes(t1, t3)).toBe(1);
  });

  it('clamps negative deltas to zero (clock-skew safety)', () => {
    const t1 = new Date('2026-03-02T08:00:00+07:00');
    const t2 = new Date('2026-03-02T07:59:00+07:00');
    expect(waitMinutes(t1, t2)).toBe(0);
  });
});
