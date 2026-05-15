import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="space-y-12">
      <section className="rounded-lg bg-brand-700 px-6 py-12 text-white md:px-12 md:py-16">
        <h1 className="text-3xl font-bold md:text-4xl">
          Dự đoán thời gian chờ đăng kiểm xe – tránh xếp hàng 6–12 tiếng
        </h1>
        <p className="mt-4 max-w-2xl text-brand-50">
          Sau khủng hoảng đăng kiểm 2023, nhiều trung tâm ở Hà Nội và TP.HCM bị quá tải. App dự đoán
          chính xác thời gian chờ theo trung tâm, giờ, ngày, giúp bạn chọn slot tối ưu hoặc đặt
          dịch vụ "đi đăng kiểm hộ".
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/centers" className="btn bg-white text-brand-700 hover:bg-brand-50">
            Tra cứu trung tâm
          </Link>
          <Link href="/fleet" className="btn-secondary bg-brand-600 text-white border-brand-500 hover:bg-brand-500">
            Cho doanh nghiệp / fleet
          </Link>
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-3">
        <div className="card">
          <div className="text-2xl">📊</div>
          <h3 className="mt-2 font-semibold">Dự đoán theo ML</h3>
          <p className="mt-1 text-sm text-slate-600">
            Model gradient boosting học từ pattern thực tế: cao điểm sáng thứ Hai, cuối tháng đông,
            tồn đọng sau Tết.
          </p>
        </div>
        <div className="card">
          <div className="text-2xl">📅</div>
          <h3 className="mt-2 font-semibold">Đặt slot trước</h3>
          <p className="mt-1 text-sm text-slate-600">
            Chốt slot giờ cụ thể trước khi tới. Optimistic locking đảm bảo không bị trùng.
          </p>
        </div>
        <div className="card">
          <div className="text-2xl">🚖</div>
          <h3 className="mt-2 font-semibold">Đi đăng kiểm hộ</h3>
          <p className="mt-1 text-sm text-slate-600">
            Worker được verify nhận xe, chạy đăng kiểm và trả tận nơi. Tracking realtime trạng thái.
          </p>
        </div>
      </section>

      <section className="card">
        <h2 className="text-xl font-semibold">Cho fleet B2B</h2>
        <p className="mt-2 text-sm text-slate-600">
          Quản lý hàng chục/trăm xe taxi, logistics. Dashboard hiển thị xe sắp hết hạn tem, đặt
          lịch batch, nhận cảnh báo. Phí ưu đãi theo khối lượng.
        </p>
      </section>
    </div>
  );
}
