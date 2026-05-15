import Link from 'next/link';
import { api } from '@/lib/api';
import { formatDuration } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function CentersPage({
  searchParams,
}: {
  searchParams: { city?: 'HN' | 'HCM'; search?: string };
}) {
  const { city, search } = searchParams;

  let centers: Awaited<ReturnType<typeof api.listCenters>>['items'] = [];
  let error: string | null = null;
  try {
    const res = await api.listCenters({ city, search });
    centers = res.items;
  } catch (e) {
    error = (e as Error).message;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Trung tâm đăng kiểm</h1>
        <div className="flex gap-2">
          <Link
            href="/centers"
            className={!city ? 'btn-primary' : 'btn-secondary'}
          >
            Tất cả
          </Link>
          <Link
            href="/centers?city=HN"
            className={city === 'HN' ? 'btn-primary' : 'btn-secondary'}
          >
            Hà Nội
          </Link>
          <Link
            href="/centers?city=HCM"
            className={city === 'HCM' ? 'btn-primary' : 'btn-secondary'}
          >
            TP.HCM
          </Link>
        </div>
      </div>

      {error && (
        <div className="rounded border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          Không kết nối được API: {error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {centers.map((c) => {
          const queue = c.liveStatus?.queueLength ?? 0;
          const perCarMin = 60 / Math.max(1, c.capacityPerHour);
          const estWait = queue * perCarMin;
          const sev = estWait < 60 ? 'badge-ok' : estWait < 180 ? 'badge-warn' : 'badge-danger';

          return (
            <Link key={c.id} href={`/centers/${c.id}`} className="card hover:border-brand-500 hover:shadow-md">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-xs text-slate-500">{c.code}</div>
                  <div className="font-semibold">{c.name}</div>
                  <div className="text-sm text-slate-600">
                    {c.district}, {c.city === 'HN' ? 'Hà Nội' : 'TP.HCM'}
                  </div>
                </div>
                <span className={sev}>~{formatDuration(estWait)}</span>
              </div>
              <div className="mt-3 text-xs text-slate-500">
                {c.address}
              </div>
              <div className="mt-3 flex gap-3 text-xs text-slate-600">
                <span>{c.laneCount} dây chuyền</span>
                <span>·</span>
                <span>{c.capacityPerHour} xe/giờ</span>
                {c.liveStatus && (
                  <>
                    <span>·</span>
                    <span>{c.liveStatus.queueLength} xe đang chờ</span>
                  </>
                )}
              </div>
            </Link>
          );
        })}
        {centers.length === 0 && !error && (
          <div className="col-span-full text-slate-500">Không có trung tâm nào.</div>
        )}
      </div>
    </div>
  );
}
