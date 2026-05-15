'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { api, ApiError, getStoredToken } from '@/lib/api';
import { formatDateTime, formatVND } from '@/lib/format';

interface VehicleOption {
  id: string;
  plateNumber: string;
  vehicleType: string;
  brand: string;
  model: string;
}

interface BookingRow {
  id: string;
  bookingCode: string;
  status: string;
  feeVnd: number;
  predictedWaitMinutes: number | null;
  center?: { code: string; name: string };
  slot?: { startsAt: string };
  vehicle?: { plateNumber: string };
}

export default function BookingsPage() {
  return (
    <Suspense fallback={<div className="card text-sm text-slate-500">Đang tải…</div>}>
      <BookingsPageInner />
    </Suspense>
  );
}

function BookingsPageInner() {
  const params = useSearchParams();
  const slotId = params.get('slotId');
  const centerId = params.get('centerId');
  if (slotId && centerId) {
    return <ConfirmBookingView slotId={slotId} centerId={centerId} />;
  }
  return <MyBookingsView />;
}

function MyBookingsView() {
  const [items, setItems] = useState<BookingRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      setError('Vui lòng đăng nhập để xem lịch hẹn.');
      setLoading(false);
      return;
    }
    api
      .listBookings(token)
      .then((r) => setItems(r.items as BookingRow[]))
      .catch((e) => setError(e instanceof ApiError ? e.message : (e as Error).message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Lịch hẹn của tôi</h1>
      {loading && <div className="card text-sm text-slate-500">Đang tải…</div>}
      {error && (
        <div className="card border-amber-300 bg-amber-50 text-sm text-amber-900">
          {error} <Link className="underline" href="/login">Đăng nhập</Link>
        </div>
      )}
      {!loading && !error && items.length === 0 && (
        <div className="card text-sm text-slate-500">Chưa có lịch hẹn nào.</div>
      )}
      <div className="grid gap-3">
        {items.map((b) => (
          <div key={b.id} className="card flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="font-mono text-xs text-slate-500">{b.bookingCode}</div>
              <div className="font-medium">{b.center?.name}</div>
              <div className="text-sm text-slate-600">
                {b.slot ? formatDateTime(b.slot.startsAt) : '—'} · Xe {b.vehicle?.plateNumber}
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs uppercase text-slate-500">{b.status}</div>
              <div className="text-sm font-medium">{formatVND(b.feeVnd)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ConfirmBookingView({ slotId, centerId }: { slotId: string; centerId: string }) {
  const [vehicles, setVehicles] = useState<VehicleOption[]>([]);
  const [vehicleId, setVehicleId] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ bookingCode: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      setError('Vui lòng đăng nhập để đặt slot.');
      return;
    }
    api
      .listMyVehicles(token)
      .then((r) => {
        setVehicles(r.items);
        if (r.items[0]) setVehicleId(r.items[0].id);
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : (e as Error).message));
  }, []);

  async function confirm(e: React.FormEvent) {
    e.preventDefault();
    const token = getStoredToken();
    if (!token) return setError('Vui lòng đăng nhập.');
    if (!vehicleId) return setError('Vui lòng chọn xe.');
    setSubmitting(true);
    setError(null);
    try {
      const booking = await api.createBooking(token, {
        centerId,
        slotId,
        vehicleId,
        notes: notes || undefined,
      });
      setResult({ bookingCode: booking.bookingCode });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : (e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    return (
      <div className="card space-y-2">
        <div className="text-lg font-semibold text-emerald-700">Đặt slot thành công!</div>
        <div className="text-sm">
          Mã booking: <code className="rounded bg-slate-100 px-2 py-0.5">{result.bookingCode}</code>
        </div>
        <Link href="/bookings" className="btn-primary mt-3 inline-block">
          Xem lịch hẹn của tôi
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-md space-y-4">
      <h1 className="text-2xl font-bold">Xác nhận đặt slot</h1>
      <form onSubmit={confirm} className="card space-y-3">
        <label className="block text-sm">
          <span className="text-slate-700">Chọn xe</span>
          <select
            value={vehicleId}
            onChange={(e) => setVehicleId(e.target.value)}
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
            required
          >
            {vehicles.length === 0 && <option value="">Không có xe nào</option>}
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.plateNumber} — {v.brand} {v.model}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-slate-700">Ghi chú (tùy chọn)</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
            rows={3}
          />
        </label>
        {error && <div className="text-sm text-danger">{error}</div>}
        <button className="btn-primary w-full" disabled={submitting || !vehicleId}>
          {submitting ? 'Đang đặt…' : 'Xác nhận'}
        </button>
      </form>
    </div>
  );
}
