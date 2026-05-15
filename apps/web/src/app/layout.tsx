import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: 'Đăng kiểm Predictor',
  description: 'Dự đoán thời gian chờ + đặt slot đăng kiểm xe cơ giới HN/HCM',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body>
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-6xl items-center justify-between p-4">
            <Link href="/" className="text-lg font-semibold text-brand-700">
              Đăng kiểm Predictor
            </Link>
            <nav className="flex items-center gap-6 text-sm">
              <Link href="/centers" className="hover:text-brand-700">Trung tâm</Link>
              <Link href="/bookings" className="hover:text-brand-700">Lịch hẹn</Link>
              <Link href="/fleet" className="hover:text-brand-700">Fleet</Link>
              <Link href="/login" className="btn-secondary py-1.5">Đăng nhập</Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl p-4 md:p-8">{children}</main>
        <footer className="mt-16 border-t border-slate-200 bg-white">
          <div className="mx-auto max-w-6xl p-4 text-xs text-slate-500">
            © 2026 Đăng kiểm Predictor · Dữ liệu trung tâm theo Thông tư 16/2021/TT-BGTVT và sửa đổi 2023
          </div>
        </footer>
      </body>
    </html>
  );
}
