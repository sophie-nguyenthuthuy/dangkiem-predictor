import { notFound } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { formatDateTime, formatDuration } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function CenterDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const { id } = params;

  let center;
  let prediction;
  let slots;
  try {
    [center, prediction, slots] = await Promise.all([
      api.getCenter(id),
      api.predict({ centerId: id, vehicleType: 'car' }).catch(() => null),
      api.getSlots(id, { onlyAvailable: true }).catch(() => []),
    ]);
  } catch (e) {
    if (e instanceof ApiError && e.statusCode === 404) notFound();
    throw e;
  }

  const upcomingSlots = slots.slice(0, 12);

  return (
    <div className="space-y-8">
      <div>
        <div className="text-xs text-slate-500">{center.code}</div>
        <h1 className="text-2xl font-bold">{center.name}</h1>
        <div className="text-slate-600">
          {center.district}, {center.city === 'HN' ? 'Hà Nội' : 'TP.HCM'}
        </div>
        <div className="mt-1 text-sm text-slate-500">{center.address}</div>
      </div>

      {prediction && (
        <div className="card border-l-4 border-l-brand-700">
          <div className="text-sm font-medium text-slate-500">Dự đoán thời gian chờ ngay bây giờ</div>
          <div className="mt-1 flex items-baseline gap-4">
            <div className="text-3xl font-bold text-brand-700">
              {formatDuration(prediction.predictedWaitMinutes)}
            </div>
            <div className="text-sm text-slate-500">
              khoảng {formatDuration(prediction.lowerBoundMinutes)}–{formatDuration(prediction.upperBoundMinutes)}
            </div>
          </div>
          <div className="mt-2 text-xs text-slate-500">
            {prediction.queueAhead} xe đang chờ · Confidence {Math.round(prediction.confidence * 100)}% · Model {prediction.modelVersion}
          </div>
        </div>
      )}

      <div>
        <h2 className="text-lg font-semibold">Slot còn trống</h2>
        <p className="text-sm text-slate-500">Chọn một slot để đặt lịch. Phí đăng kiểm tính theo loại xe.</p>
        <div className="mt-4 grid gap-2 md:grid-cols-3">
          {upcomingSlots.map((s) => (
            <div key={s.id} className="card">
              <div className="font-medium">{formatDateTime(s.startsAt)}</div>
              <div className="mt-1 text-sm text-slate-500">
                Còn {s.capacity - s.bookedCount}/{s.capacity} chỗ
              </div>
              <form action={`/bookings?slotId=${s.id}&centerId=${center.id}`} method="get" className="mt-3">
                <button className="btn-primary w-full" type="submit">
                  Đặt slot này
                </button>
              </form>
            </div>
          ))}
          {upcomingSlots.length === 0 && (
            <div className="col-span-full rounded border border-dashed border-slate-300 p-4 text-sm text-slate-500">
              Không còn slot trống trong tuần tới.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
