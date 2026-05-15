// VNPay payment gateway helpers.
//
// VNPay sandbox flow (PayGate version 2.1.0):
//   1. Server builds a sorted, URL-encoded param string and signs it with HMAC-SHA512(secret).
//   2. Client is redirected to vnp_Url with `vnp_SecureHash` appended.
//   3. After payment, VNPay redirects the browser back to vnp_ReturnUrl (for UX)
//      AND fires an IPN POST to vnp_IpnUrl (the trustworthy source).
//   4. Both must be verified by recomputing the hash from the received params.
//
// Spec: https://sandbox.vnpayment.vn/apis/docs/thanh-toan-pay/pay.html

import crypto from 'node:crypto';

export interface VnpayConfig {
  tmnCode: string;
  hashSecret: string;
  payUrl: string; // typically https://sandbox.vnpayment.vn/paymentv2/vpcpay.html
  returnUrl: string;
}

const HASH_FIELDS = ['vnp_SecureHash', 'vnp_SecureHashType'];

function sortAndEncode(params: Record<string, string>): string {
  const keys = Object.keys(params).sort();
  return keys
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(params[k] ?? '')}`)
    .join('&');
}

export function sign(params: Record<string, string>, secret: string): string {
  const data = sortAndEncode(params);
  return crypto.createHmac('sha512', secret).update(data, 'utf8').digest('hex');
}

export interface BuildPayUrlInput {
  txnRef: string; // unique reference (Payment.txnRef)
  amountVnd: number;
  orderInfo: string;
  ipAddr: string;
  createdAt: Date;
  expiresAt: Date;
  locale?: 'vn' | 'en';
  bankCode?: string;
}

export function buildPayUrl(config: VnpayConfig, input: BuildPayUrlInput): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  const fmt = (d: Date) =>
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;

  const params: Record<string, string> = {
    vnp_Version: '2.1.0',
    vnp_Command: 'pay',
    vnp_TmnCode: config.tmnCode,
    vnp_Locale: input.locale ?? 'vn',
    vnp_CurrCode: 'VND',
    vnp_TxnRef: input.txnRef,
    vnp_OrderInfo: input.orderInfo,
    vnp_OrderType: 'other',
    // VNPay amounts are in VND × 100 (so 240,000 VND → 24_000_000)
    vnp_Amount: String(input.amountVnd * 100),
    vnp_ReturnUrl: config.returnUrl,
    vnp_IpAddr: input.ipAddr,
    vnp_CreateDate: fmt(input.createdAt),
    vnp_ExpireDate: fmt(input.expiresAt),
  };
  if (input.bankCode) params.vnp_BankCode = input.bankCode;

  const signature = sign(params, config.hashSecret);
  const qs = sortAndEncode(params);
  return `${config.payUrl}?${qs}&vnp_SecureHash=${signature}`;
}

export interface VerifyResult {
  valid: boolean;
  reason?: string;
  txnRef?: string;
  amountVnd?: number;
  responseCode?: string;
  transactionStatus?: string;
  vnpTransactionNo?: string;
  message?: string;
}

export function verifyCallback(
  params: Record<string, string>,
  secret: string,
): VerifyResult {
  const received = params.vnp_SecureHash;
  if (!received) return { valid: false, reason: 'missing vnp_SecureHash' };

  const filtered: Record<string, string> = {};
  for (const [k, v] of Object.entries(params)) {
    if (!HASH_FIELDS.includes(k) && v !== undefined && v !== null) filtered[k] = String(v);
  }
  const expected = sign(filtered, secret);

  // timing-safe compare; both must be lowercase hex of equal length
  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(String(received).toLowerCase(), 'hex');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { valid: false, reason: 'signature mismatch' };
  }

  const amountRaw = Number(filtered.vnp_Amount ?? 0);
  return {
    valid: true,
    txnRef: filtered.vnp_TxnRef,
    amountVnd: Math.round(amountRaw / 100),
    responseCode: filtered.vnp_ResponseCode,
    transactionStatus: filtered.vnp_TransactionStatus,
    vnpTransactionNo: filtered.vnp_TransactionNo,
    message: filtered.vnp_OrderInfo,
  };
}

// Subset of VNPay response codes — full list at
// https://sandbox.vnpayment.vn/apis/docs/bang-ma-loi/
export const VNPAY_RESPONSE_MESSAGES_VI: Record<string, string> = {
  '00': 'Giao dịch thành công',
  '07': 'Trừ tiền thành công, đang nghi ngờ gian lận',
  '09': 'Thẻ/Tài khoản chưa đăng ký InternetBanking',
  '10': 'Xác thực thông tin thẻ không đúng quá 3 lần',
  '11': 'Đã hết hạn chờ thanh toán',
  '12': 'Thẻ/Tài khoản bị khóa',
  '13': 'Sai mật khẩu OTP',
  '24': 'Khách hàng hủy giao dịch',
  '51': 'Tài khoản không đủ số dư',
  '65': 'Vượt quá hạn mức giao dịch trong ngày',
  '75': 'Ngân hàng thanh toán đang bảo trì',
  '79': 'Sai mật khẩu thanh toán quá số lần quy định',
  '99': 'Lỗi khác',
};

export const isVnpaySuccess = (responseCode?: string, transactionStatus?: string) =>
  responseCode === '00' && transactionStatus === '00';
