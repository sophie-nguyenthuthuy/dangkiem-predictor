'use client';

import { useEffect, useState } from 'react';
import { api, ApiError, getStoredToken } from '@/lib/api';

interface FleetData {
  fleet: { id: string; name: string; taxCode: string };
  stats: { vehicleCount: number; upcomingBookings: number; expiringSoon: number };
}

export default function FleetPage() {
  const [data, setData] = useState<FleetData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      setError('Vui lòng đăng nhập với tài khoản FLEET_ADMIN.');
      setLoading(false);
      return;
    }
    api
      .fleetMe(token)
      .then(setData)
      .catch((e: unknown) => {
        if (e instanceof ApiError) setError(e.message);
        else setError((e as Error).message);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Cho doanh nghiệp / fleet</h1>
      <p className="text-slate-600">
        Quản lý đăng kiểm cho nhiều xe (taxi, logistics, dịch vụ). Dashboard hiển thị xe sắp hết
        hạn tem, đặt lịch hàng loạt, nhận cảnh báo qua email/SMS.
      </p>

      {loading && <div className="card text-sm text-slate-500">Đang tải…</div>}

      {error && (
        <div className="card border-amber-300 bg-amber-50 text-sm text-amber-900">{error}</div>
      )}

      {data && (
        <>
          <div className="card">
            <div className="text-xs text-slate-500">{data.fleet.taxCode}</div>
            <div className="text-lg font-semibold">{data.fleet.name}</div>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="card">
              <div className="text-xs font-medium text-slate-500">Tổng số xe</div>
              <div className="mt-2 text-3xl font-bold text-brand-700">{data.stats.vehicleCount}</div>
            </div>
            <div className="card">
              <div className="text-xs font-medium text-slate-500">Tem hết hạn trong 30 ngày</div>
              <div className="mt-2 text-3xl font-bold text-warn">{data.stats.expiringSoon}</div>
            </div>
            <div className="card">
              <div className="text-xs font-medium text-slate-500">Booking đang hoạt động</div>
              <div className="mt-2 text-3xl font-bold text-brand-700">
                {data.stats.upcomingBookings}
              </div>
            </div>
          </div>
        </>
      )}

      <div className="card">
        <h2 className="font-semibold">API cho tích hợp</h2>
        <pre className="mt-2 overflow-x-auto rounded bg-slate-900 p-3 text-xs text-slate-100">
{`# Đăng ký fleet
POST /v1/fleets
{ "name": "Mai Linh Taxi", "taxCode": "0123456789", ... }

# Xe sắp hết hạn
GET /v1/vehicles?expiringWithinDays=30&fleetId=<fleet-id>
Authorization: Bearer <token>

# Dashboard
GET /v1/fleets/me`}
        </pre>
      </div>
    </div>
  );
}
