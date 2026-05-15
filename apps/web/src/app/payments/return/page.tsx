// VNPay browser-return page. VNPay redirects the user here with signed
// query params after the user finishes (or cancels) payment at their bank.
// This page is UX only — the IPN endpoint is what we trust on the server.

import Link from 'next/link';

export const dynamic = 'force-dynamic';

const RESPONSE_MESSAGES: Record<string, string> = {
  '00': 'Giao dịch thành công',
  '07': 'Trừ tiền thành công, đang xác minh',
  '09': 'Thẻ/Tài khoản chưa đăng ký InternetBanking',
  '10': 'Xác thực thông tin thẻ không đúng quá 3 lần',
  '11': 'Đã hết hạn chờ thanh toán',
  '12': 'Thẻ/Tài khoản bị khóa',
  '13': 'Sai mật khẩu OTP',
  '24': 'Khách hàng đã hủy giao dịch',
  '51': 'Tài khoản không đủ số dư',
  '65': 'Vượt quá hạn mức trong ngày',
  '75': 'Ngân hàng thanh toán đang bảo trì',
  '79': 'Sai mật khẩu thanh toán quá số lần quy định',
  '99': 'Lỗi không xác định',
};

export default function PaymentReturnPage({
  searchParams,
}: {
  searchParams: Record<string, string>;
}) {
  const responseCode = searchParams.vnp_ResponseCode ?? '99';
  const txnStatus = searchParams.vnp_TransactionStatus ?? '99';
  const txnRef = searchParams.vnp_TxnRef ?? '—';
  const amountRaw = Number(searchParams.vnp_Amount ?? 0);
  const amountVnd = Math.round(amountRaw / 100);

  const success = responseCode === '00' && txnStatus === '00';
  const message = RESPONSE_MESSAGES[responseCode] ?? 'Không xác định';

  return (
    <div className="mx-auto max-w-md space-y-4">
      <div className={success ? 'card border-l-4 border-l-emerald-500' : 'card border-l-4 border-l-red-500'}>
        <div className={success ? 'text-lg font-semibold text-emerald-700' : 'text-lg font-semibold text-red-700'}>
          {success ? '✓ Thanh toán thành công' : '✗ Thanh toán không thành công'}
        </div>
        <div className="mt-2 text-sm text-slate-600">{message}</div>
        <dl className="mt-4 space-y-1 text-sm">
          <div className="flex justify-between">
            <dt className="text-slate-500">Mã giao dịch</dt>
            <dd className="font-mono">{txnRef}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">Số tiền</dt>
            <dd>{amountVnd > 0 ? new Intl.NumberFormat('vi-VN').format(amountVnd) + ' đ' : '—'}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">Mã phản hồi</dt>
            <dd className="font-mono">{responseCode}</dd>
          </div>
        </dl>
      </div>
      <p className="text-xs text-slate-500">
        Trạng thái cuối cùng sẽ được cập nhật khi VNPay gửi IPN xác nhận tới server (thường vài giây).
      </p>
      <Link href="/bookings" className="btn-primary inline-block">
        Về lịch hẹn của tôi
      </Link>
    </div>
  );
}
