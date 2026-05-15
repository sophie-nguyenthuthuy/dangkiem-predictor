const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
  }
  get status() {
    return this.statusCode;
  }
}

export interface RequestOpts extends Omit<RequestInit, 'body'> {
  token?: string | null;
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
}

async function request<T>(path: string, opts: RequestOpts = {}): Promise<T> {
  const { token, body, query, headers, ...rest } = opts;
  let url = `${API_BASE}${path}`;
  if (query) {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined) sp.set(k, String(v));
    }
    const qs = sp.toString();
    if (qs) url += (url.includes('?') ? '&' : '?') + qs;
  }
  const res = await fetch(url, {
    ...rest,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });
  if (!res.ok) {
    let parsed: { message?: string } = {};
    try {
      parsed = (await res.json()) as { message?: string };
    } catch {
      /* ignore */
    }
    throw new ApiError(res.status, parsed.message ?? (res.statusText || `HTTP ${res.status}`));
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export interface CenterListItem {
  id: string;
  code: string;
  name: string;
  city: 'HN' | 'HCM';
  district: string;
  address: string;
  latitude: number;
  longitude: number;
  phone: string;
  laneCount: number;
  capacityPerHour: number;
  supportedVehicleTypes: string[];
  suspended: boolean;
  liveStatus: { queueLength: number; activeLanes: number; lastUpdatedAt: string } | null;
}

export interface PaginatedResult<T> {
  total: number;
  page: number;
  pageSize: number;
  items: T[];
}

export interface PredictionResponse {
  centerId: string;
  predictedWaitMinutes: number;
  lowerBoundMinutes: number;
  upperBoundMinutes: number;
  queueAhead: number;
  confidence: number;
  modelVersion: string;
  generatedAt: string;
}

export interface SlotItem {
  id: string;
  centerId: string;
  startsAt: string;
  endsAt: string;
  capacity: number;
  bookedCount: number;
  available: boolean;
}

export interface BookingItem {
  id: string;
  bookingCode: string;
  status: string;
  centerId: string;
  slotId: string;
  vehicleId: string;
  feeVnd: number;
  predictedWaitMinutes: number | null;
  createdAt: string;
  center?: { id: string; code: string; name: string; address: string };
  slot?: { startsAt: string; endsAt: string };
  vehicle?: { plateNumber: string; vehicleType: string };
}

export interface AuthResponse {
  user: {
    id: string;
    email: string;
    fullName: string;
    phone: string;
    role: string;
    fleetId: string | null;
    createdAt: string;
  };
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export const api = {
  listCenters: (params: { city?: 'HN' | 'HCM'; search?: string; page?: number } = {}) =>
    request<PaginatedResult<CenterListItem>>('/v1/centers', { query: params }),
  getCenter: (id: string) => request<CenterListItem>(`/v1/centers/${id}`),
  predict: (params: { centerId: string; vehicleType: string; arrivalTime?: string }) =>
    request<PredictionResponse>('/v1/predictions', { query: params }),
  getSlots: (centerId: string, params: { from?: string; to?: string; onlyAvailable?: boolean } = {}) =>
    request<SlotItem[]>(`/v1/centers/${centerId}/slots`, { query: params }),
  listBookings: (token: string, params: { page?: number; status?: string } = {}) =>
    request<PaginatedResult<BookingItem>>('/v1/bookings', { token, query: params }),
  createBooking: (
    token: string,
    body: { centerId: string; slotId: string; vehicleId: string; notes?: string },
  ) => request<BookingItem>('/v1/bookings', { method: 'POST', token, body }),
  cancelBooking: (token: string, id: string) =>
    request<BookingItem>(`/v1/bookings/${id}/cancel`, { method: 'POST', token }),
  listMyVehicles: (token: string) =>
    request<PaginatedResult<{ id: string; plateNumber: string; vehicleType: string; brand: string; model: string; temExpiresAt: string | null }>>(
      '/v1/vehicles',
      { token },
    ),
  signup: (body: { email: string; password: string; fullName: string; phone: string }) =>
    request<AuthResponse>('/v1/auth/signup', { method: 'POST', body }),
  login: (body: { email: string; password: string }) =>
    request<AuthResponse>('/v1/auth/login', { method: 'POST', body }),
  me: (token: string) => request<AuthResponse['user']>('/v1/auth/me', { token }),
  fleetMe: (token: string) =>
    request<{ fleet: { id: string; name: string; taxCode: string }; stats: { vehicleCount: number; upcomingBookings: number; expiringSoon: number } }>(
      '/v1/fleets/me',
      { token },
    ),
  createProxyJob: (
    token: string,
    body: {
      vehicleId: string;
      pickupAddress: string;
      pickupTime: string;
      contactPhone: string;
      preferredCenterId?: string;
      notes?: string;
    },
  ) => request<{ id: string; status: string }>('/v1/proxy-jobs', { method: 'POST', token, body }),
};

export const TOKEN_KEY = 'dangkiem.access_token';
export const REFRESH_KEY = 'dangkiem.refresh_token';

export function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(TOKEN_KEY);
}
export function setStoredAuth(access: string, refresh: string) {
  window.localStorage.setItem(TOKEN_KEY, access);
  window.localStorage.setItem(REFRESH_KEY, refresh);
}
export function clearStoredAuth() {
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(REFRESH_KEY);
}
