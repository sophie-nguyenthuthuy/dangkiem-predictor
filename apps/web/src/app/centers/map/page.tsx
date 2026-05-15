import { api } from '@/lib/api';
import { CenterMap } from '@/components/CenterMap';

export const dynamic = 'force-dynamic';

export default async function CenterMapPage({
  searchParams,
}: {
  searchParams: { city?: 'HN' | 'HCM' };
}) {
  let centers: Awaited<ReturnType<typeof api.listCenters>>['items'] = [];
  let error: string | null = null;
  try {
    const res = await api.listCenters({ city: searchParams.city });
    centers = res.items;
  } catch (e) {
    error = (e as Error).message;
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Bản đồ trung tâm đăng kiểm</h1>
      <p className="text-sm text-slate-600">
        Tap pin để xem chi tiết. Pin màu đỏ = đang đông (queue ≥ 30), vàng = vừa (10–30), xanh = vắng.
      </p>
      {error && (
        <div className="rounded border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          Không tải được trung tâm: {error}
        </div>
      )}
      <CenterMap centers={centers} />
    </div>
  );
}
