export const formatVND = (amount: number): string =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(amount);

export const formatDateTime = (iso: string): string =>
  new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(new Date(iso));

export const formatDate = (iso: string): string =>
  new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(iso));

export const formatDuration = (minutes: number): string => {
  if (minutes < 60) return `${Math.round(minutes)} phút`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m === 0 ? `${h} giờ` : `${h}h${m.toString().padStart(2, '0')}`;
};

export const waitSeverity = (minutes: number): 'ok' | 'warn' | 'danger' => {
  if (minutes < 60) return 'ok';
  if (minutes < 180) return 'warn';
  return 'danger';
};
