'use client';

import { useState } from 'react';
import { api, ApiError, getStoredToken } from '@/lib/api';

interface Props {
  bookingId: string;
  className?: string;
  label?: string;
}

const BANKS = [
  { code: '', label: 'Tất cả ngân hàng (VNPay chọn giúp)' },
  { code: 'NCB', label: 'NCB (sandbox test)' },
  { code: 'VNPAYQR', label: 'VNPay QR' },
  { code: 'VNBANK', label: 'Thẻ ATM/Tài khoản nội địa' },
  { code: 'INTCARD', label: 'Thẻ quốc tế (Visa/Master/JCB)' },
];

export function PayWithVnpay({ bookingId, className, label }: Props) {
  const [bankCode, setBankCode] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function pay() {
    setError(null);
    const token = getStoredToken();
    if (!token) {
      setError('Vui lòng đăng nhập trước khi thanh toán.');
      return;
    }
    setSubmitting(true);
    try {
      const { redirectUrl } = await api.initVnpayPayment(token, {
        bookingId,
        bankCode: bankCode || undefined,
      });
      window.location.href = redirectUrl;
    } catch (e) {
      setError(e instanceof ApiError ? e.message : (e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={className ?? 'space-y-2'}>
      <select
        value={bankCode}
        onChange={(e) => setBankCode(e.target.value)}
        className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
      >
        {BANKS.map((b) => (
          <option key={b.code} value={b.code}>
            {b.label}
          </option>
        ))}
      </select>
      <button onClick={pay} disabled={submitting} className="btn-primary w-full">
        {submitting ? 'Đang khởi tạo VNPay…' : (label ?? 'Thanh toán qua VNPay')}
      </button>
      {error && <div className="text-sm text-danger">{error}</div>}
    </div>
  );
}
