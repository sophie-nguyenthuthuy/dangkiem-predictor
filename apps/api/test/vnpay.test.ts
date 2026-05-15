import { describe, expect, it } from 'vitest';
import { buildPayUrl, sign, verifyCallback, isVnpaySuccess } from '../src/lib/vnpay.js';

const cfg = {
  tmnCode: 'TESTCODE',
  hashSecret: 'TEST_SECRET_KEY_32_CHARS_LONG_XX',
  payUrl: 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html',
  returnUrl: 'http://localhost:3000/payments/return',
};

describe('VNPay sign + buildPayUrl', () => {
  it('signs deterministically (sorted params)', () => {
    const a = sign({ vnp_Amount: '24000000', vnp_TxnRef: '123', vnp_TmnCode: 'X' }, 'k');
    const b = sign({ vnp_TmnCode: 'X', vnp_TxnRef: '123', vnp_Amount: '24000000' }, 'k');
    expect(a).toBe(b);
  });

  it('builds a payUrl with amount × 100', () => {
    const url = buildPayUrl(cfg, {
      txnRef: 'DK00000000000001',
      amountVnd: 240_000,
      orderInfo: 'Phi dang kiem',
      ipAddr: '127.0.0.1',
      createdAt: new Date('2026-03-02T09:00:00+07:00'),
      expiresAt: new Date('2026-03-02T09:15:00+07:00'),
    });
    expect(url).toContain('vnp_Amount=24000000');
    expect(url).toContain('vnp_TmnCode=TESTCODE');
    expect(url).toContain('vnp_SecureHash=');
    expect(url).toContain('vnp_TxnRef=DK00000000000001');
  });
});

describe('VNPay verifyCallback', () => {
  it('round-trips a signed param set', () => {
    const params: Record<string, string> = {
      vnp_TmnCode: 'TESTCODE',
      vnp_Amount: '24000000',
      vnp_TxnRef: 'DK00000000000001',
      vnp_ResponseCode: '00',
      vnp_TransactionStatus: '00',
      vnp_TransactionNo: '13456789',
      vnp_OrderInfo: 'Phi dang kiem',
    };
    const signature = sign(params, cfg.hashSecret);
    const result = verifyCallback({ ...params, vnp_SecureHash: signature }, cfg.hashSecret);
    expect(result.valid).toBe(true);
    expect(result.txnRef).toBe('DK00000000000001');
    expect(result.amountVnd).toBe(240_000);
    expect(isVnpaySuccess(result.responseCode, result.transactionStatus)).toBe(true);
  });

  it('rejects a tampered amount', () => {
    const params: Record<string, string> = {
      vnp_TmnCode: 'TESTCODE',
      vnp_Amount: '24000000',
      vnp_TxnRef: 'DK1',
      vnp_ResponseCode: '00',
      vnp_TransactionStatus: '00',
    };
    const signature = sign(params, cfg.hashSecret);
    const result = verifyCallback(
      { ...params, vnp_Amount: '99900000', vnp_SecureHash: signature },
      cfg.hashSecret,
    );
    expect(result.valid).toBe(false);
  });

  it('rejects a failed-payment response code', () => {
    expect(isVnpaySuccess('24', '00')).toBe(false); // customer cancelled
    expect(isVnpaySuccess('00', '01')).toBe(false); // not yet completed
    expect(isVnpaySuccess(undefined, undefined)).toBe(false);
  });

  it('rejects when secret differs', () => {
    const params: Record<string, string> = { vnp_TmnCode: 'X', vnp_TxnRef: '1' };
    const signature = sign(params, cfg.hashSecret);
    const result = verifyCallback({ ...params, vnp_SecureHash: signature }, 'different-secret');
    expect(result.valid).toBe(false);
  });
});
