// Notification adapter — sends via the configured provider.
//
// Providers:
//   - console:  always available (default in dev). Just logs.
//   - email:    Resend (RESEND_API_KEY) — chosen because it has a simple REST
//               API with no SDK dependency.
//   - sms:      Esms.vn (ESMS_API_KEY + ESMS_SECRET_KEY) — popular VN provider
//               supporting Brandname and Verify SMS.
//
// We deliberately keep this minimal — no queue, no retry. The caller (a cron
// job or worker) is responsible for picking up PENDING rows and calling send().
// If a provider key is missing, the channel falls back to console + tags the
// notification as SENT-via-console so we can audit later.

import { request } from 'undici';
import { config } from '../config.js';
import { logger } from './logger.js';

export type Channel = 'EMAIL' | 'SMS' | 'PUSH' | 'CONSOLE';

export interface SendInput {
  channel: Channel;
  recipient: string;
  subject?: string;
  body: string;
  topic: string;
}

export interface SendResult {
  ok: boolean;
  providerRef?: string;
  error?: string;
  fellBackToConsole?: boolean;
}

async function sendEmail(input: SendInput): Promise<SendResult> {
  if (!config.RESEND_API_KEY) return sendConsole(input, true);
  try {
    const { statusCode, body } = await request('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${config.RESEND_API_KEY}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        from: config.EMAIL_FROM,
        to: input.recipient,
        subject: input.subject ?? input.topic,
        text: input.body,
      }),
    });
    const json = (await body.json()) as { id?: string; message?: string };
    if (statusCode >= 400) return { ok: false, error: json.message ?? `HTTP ${statusCode}` };
    return { ok: true, providerRef: json.id };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

async function sendSms(input: SendInput): Promise<SendResult> {
  if (!config.ESMS_API_KEY || !config.ESMS_SECRET_KEY) return sendConsole(input, true);
  try {
    // Esms.vn API v3 — SMS Type 2 = Brandname, requires brand approval.
    // Type 8 = Verify SMS (works for sandbox, no brand required).
    const { statusCode, body } = await request('https://rest.esms.vn/MainService.svc/json/SendMultipleMessage_V4_post_json/', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        ApiKey: config.ESMS_API_KEY,
        SecretKey: config.ESMS_SECRET_KEY,
        Content: input.body,
        Phone: input.recipient,
        SmsType: '8',
        IsUnicode: '0',
        Sandbox: '1',
      }),
    });
    const json = (await body.json()) as { CodeResult?: string; SMSID?: string; ErrorMessage?: string };
    if (statusCode >= 400 || json.CodeResult !== '100') {
      return { ok: false, error: json.ErrorMessage ?? `code=${json.CodeResult}` };
    }
    return { ok: true, providerRef: json.SMSID };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

function sendConsole(input: SendInput, fallback = false): SendResult {
  logger.info(
    { topic: input.topic, recipient: input.recipient, subject: input.subject, body: input.body, fallback },
    fallback ? 'notification (console fallback — provider not configured)' : 'notification (console)',
  );
  return fallback ? { ok: true, fellBackToConsole: true } : { ok: true };
}

export async function send(input: SendInput): Promise<SendResult> {
  switch (input.channel) {
    case 'EMAIL':
      return sendEmail(input);
    case 'SMS':
      return sendSms(input);
    case 'CONSOLE':
      return sendConsole(input);
    case 'PUSH':
      // Push not implemented yet — log + return ok so callers don't break
      return sendConsole(input, true);
  }
}
