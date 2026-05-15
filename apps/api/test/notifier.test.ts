import { describe, expect, it, beforeAll } from 'vitest';

beforeAll(() => {
  process.env.JWT_SECRET ||= 'test-secret-min-16-chars';
  process.env.DATABASE_URL ||= 'postgresql://x:y@localhost:5432/x?schema=public';
  // Force the console-fallback path
  delete process.env.RESEND_API_KEY;
  delete process.env.ESMS_API_KEY;
  delete process.env.ESMS_SECRET_KEY;
});

describe('notifier console fallback', () => {
  it('returns ok=true and flags fallback when no provider configured (email)', async () => {
    const { send } = await import('../src/lib/notifier.js');
    const out = await send({
      channel: 'EMAIL',
      recipient: 'user@example.com',
      subject: 'Test',
      body: 'Body',
      topic: 'test.topic',
    });
    expect(out.ok).toBe(true);
    expect(out.fellBackToConsole).toBe(true);
  });

  it('returns ok=true and flags fallback when no provider configured (sms)', async () => {
    const { send } = await import('../src/lib/notifier.js');
    const out = await send({
      channel: 'SMS',
      recipient: '0901234567',
      body: 'Body',
      topic: 'test.topic',
    });
    expect(out.ok).toBe(true);
    expect(out.fellBackToConsole).toBe(true);
  });

  it('CONSOLE channel always returns ok and does not flag fallback', async () => {
    const { send } = await import('../src/lib/notifier.js');
    const out = await send({
      channel: 'CONSOLE',
      recipient: 'system',
      body: 'Body',
      topic: 'test.topic',
    });
    expect(out.ok).toBe(true);
    expect(out.fellBackToConsole).toBeUndefined();
  });
});
