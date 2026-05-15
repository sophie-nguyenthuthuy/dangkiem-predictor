'use client';

import { useEffect, useRef } from 'react';
import 'leaflet/dist/leaflet.css';
import type { CenterListItem } from '@/lib/api';

// Leaflet is imported dynamically to avoid SSR window-not-defined errors.
// Tile attribution must remain visible per OSM terms.

interface Props {
  centers: CenterListItem[];
}

const HN_CENTER: [number, number] = [21.0285, 105.8542];
const HCM_CENTER: [number, number] = [10.7626, 106.6602];

function severity(queue: number): { color: string; label: string } {
  if (queue >= 30) return { color: '#dc2626', label: 'Đông' };
  if (queue >= 10) return { color: '#d97706', label: 'Vừa' };
  return { color: '#16a34a', label: 'Vắng' };
}

export function CenterMap({ centers }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<unknown>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!containerRef.current) return;
      const L = await import('leaflet');

      if (cancelled || mapRef.current || !containerRef.current) return;

      const hasHn = centers.some((c) => c.city === 'HN');
      const hasHcm = centers.some((c) => c.city === 'HCM');
      const initialCenter: [number, number] =
        hasHn && hasHcm ? [16.0, 106.5] : hasHcm ? HCM_CENTER : HN_CENTER;
      const initialZoom = hasHn && hasHcm ? 6 : 11;

      const map = L.map(containerRef.current, {
        center: initialCenter,
        zoom: initialZoom,
        zoomControl: true,
      });
      mapRef.current = map;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);

      const bounds = L.latLngBounds([]);
      for (const c of centers) {
        const sev = severity(c.liveStatus?.queueLength ?? 0);
        const marker = L.circleMarker([c.latitude, c.longitude], {
          radius: 10,
          color: '#fff',
          weight: 2,
          fillColor: sev.color,
          fillOpacity: 0.9,
        }).addTo(map);
        marker.bindPopup(
          `<div style="font-size:12px;line-height:1.4">
             <div style="font-weight:600">${escapeHtml(c.name)}</div>
             <div style="color:#64748b">${escapeHtml(c.code)} · ${escapeHtml(c.district)}</div>
             <div style="margin-top:4px">${sev.label} — ${c.liveStatus?.queueLength ?? 0} xe chờ</div>
             <a href="/centers/${c.id}" style="color:#0f766e">Xem chi tiết →</a>
           </div>`,
        );
        bounds.extend([c.latitude, c.longitude]);
      }
      // After paint, refresh size and zoom to fit only if it doesn't widen too much
      requestAnimationFrame(() => {
        map.invalidateSize();
        if (bounds.isValid()) {
          map.fitBounds(bounds.pad(0.1), { maxZoom: 12, animate: false });
        }
      });
    })();

    return () => {
      cancelled = true;
      // @ts-expect-error — leaflet types not imported at top level
      mapRef.current?.remove?.();
      mapRef.current = null;
    };
  }, [centers]);

  return (
    <div
      ref={containerRef}
      className="h-[60vh] w-full rounded-lg border border-slate-200"
      role="application"
      aria-label="Bản đồ trung tâm đăng kiểm"
    />
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
