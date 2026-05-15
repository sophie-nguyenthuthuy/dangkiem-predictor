export const VEHICLE_TYPES = ['car', 'truck', 'bus', 'specialized'] as const;
export type VehicleType = (typeof VEHICLE_TYPES)[number];

export const VEHICLE_TYPE_LABEL_VI: Record<VehicleType, string> = {
  car: 'Xe con (dưới 9 chỗ)',
  truck: 'Xe tải',
  bus: 'Xe khách (từ 10 chỗ)',
  specialized: 'Xe chuyên dùng',
};

export const LANE_TYPES = ['light', 'heavy', 'mixed'] as const;
export type LaneType = (typeof LANE_TYPES)[number];

export const BOOKING_STATUSES = [
  'PENDING',
  'CONFIRMED',
  'CHECKED_IN',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
  'NO_SHOW',
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const PROXY_JOB_STATUSES = [
  'REQUESTED',
  'ASSIGNED',
  'PICKED_UP',
  'AT_CENTER',
  'INSPECTED',
  'RETURNING',
  'DELIVERED',
  'CANCELLED',
] as const;
export type ProxyJobStatus = (typeof PROXY_JOB_STATUSES)[number];

export const USER_ROLES = ['USER', 'FLEET_ADMIN', 'PROXY_WORKER', 'ADMIN'] as const;
export type UserRole = (typeof USER_ROLES)[number];

// Phí kiểm định theo Thông tư 55/2022/TT-BTC (VND)
export const INSPECTION_FEES_VND: Record<VehicleType, number> = {
  car: 240000,
  truck: 350000,
  bus: 350000,
  specialized: 570000,
};

// Lệ phí cấp giấy chứng nhận
export const CERTIFICATE_FEE_VND = 50000;

// Mức phí đề xuất cho dịch vụ đi đăng kiểm hộ (VND)
export const PROXY_SERVICE_FEE_VND = 350000;

export const CITIES = ['HN', 'HCM'] as const;
export type City = (typeof CITIES)[number];
