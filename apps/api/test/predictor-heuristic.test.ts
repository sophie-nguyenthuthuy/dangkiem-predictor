import { describe, expect, it, beforeAll } from 'vitest';

beforeAll(() => {
  process.env.JWT_SECRET ||= 'test-secret-min-16-chars';
  process.env.DATABASE_URL ||= 'postgresql://x:y@localhost:5432/x?schema=public';
  process.env.PREDICTOR_URL ||= 'http://127.0.0.1:1'; // intentionally unreachable
});

describe('predictWaitTime heuristic fallback', () => {
  it('returns sane values when predictor is unreachable', async () => {
    const { predictWaitTime } = await import('../src/lib/predictor-client.js');
    const out = await predictWaitTime({
      centerId: 'c1',
      vehicleType: 'car',
      arrivalTime: new Date('2026-03-02T09:00:00.000Z').toISOString(), // Monday
      laneCount: 3,
      capacityPerHour: 12,
      queueLength: 10,
      activeLanes: 2,
    });
    expect(out.modelVersion).toBe('heuristic-v1');
    expect(out.predictedWaitMinutes).toBeGreaterThan(20);
    expect(out.lowerBoundMinutes).toBeLessThanOrEqual(out.predictedWaitMinutes);
    expect(out.upperBoundMinutes).toBeGreaterThanOrEqual(out.predictedWaitMinutes);
  });

  it('predicts higher wait on Monday morning than Sunday', async () => {
    const { predictWaitTime } = await import('../src/lib/predictor-client.js');
    const monday = await predictWaitTime({
      centerId: 'c1',
      vehicleType: 'car',
      arrivalTime: new Date('2026-03-02T09:00:00.000Z').toISOString(),
      laneCount: 3,
      capacityPerHour: 12,
      queueLength: 5,
      activeLanes: 3,
    });
    const sunday = await predictWaitTime({
      centerId: 'c1',
      vehicleType: 'car',
      arrivalTime: new Date('2026-03-01T09:00:00.000Z').toISOString(),
      laneCount: 3,
      capacityPerHour: 12,
      queueLength: 5,
      activeLanes: 3,
    });
    expect(monday.predictedWaitMinutes).toBeGreaterThan(sunday.predictedWaitMinutes);
  });
});
