import type { BookingStatus, City, ProxyJobStatus, UserRole, VehicleType } from './constants.js';

export interface Center {
  id: string;
  code: string; // e.g. "29-03V"
  name: string;
  city: City;
  district: string;
  address: string;
  latitude: number;
  longitude: number;
  phone: string;
  operatingHours: { open: string; close: string; daysClosed: number[] };
  laneCount: number;
  supportedVehicleTypes: VehicleType[];
  capacityPerHour: number;
  suspended: boolean;
}

export interface CenterLiveStatus {
  centerId: string;
  queueLength: number;
  activeLanes: number;
  lastUpdatedAt: string;
}

export interface PublicUser {
  id: string;
  email: string;
  fullName: string;
  phone: string;
  role: UserRole;
  fleetId: string | null;
  createdAt: string;
}

export interface Vehicle {
  id: string;
  plateNumber: string;
  vehicleType: VehicleType;
  brand: string;
  model: string;
  yearOfManufacture: number;
  vin: string | null;
  temExpiresAt: string | null; // hạn tem kiểm định
  ownerId: string;
  fleetId: string | null;
}

export interface Slot {
  id: string;
  centerId: string;
  startsAt: string;
  endsAt: string;
  capacity: number;
  bookedCount: number;
  available: boolean;
}

export interface Booking {
  id: string;
  bookingCode: string;
  status: BookingStatus;
  centerId: string;
  slotId: string;
  vehicleId: string;
  userId: string;
  notes: string | null;
  predictedWaitMinutes: number | null;
  feeVnd: number;
  createdAt: string;
}

export interface ProxyJob {
  id: string;
  status: ProxyJobStatus;
  vehicleId: string;
  customerId: string;
  workerId: string | null;
  pickupAddress: string;
  pickupTime: string;
  centerId: string | null;
  contactPhone: string;
  notes: string | null;
  feeVnd: number;
  createdAt: string;
}

export interface Fleet {
  id: string;
  name: string;
  taxCode: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  vehicleCount: number;
  createdAt: string;
}

export interface AuthResponse {
  user: PublicUser;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface ApiError {
  statusCode: number;
  error: string;
  message: string;
  details?: unknown;
}
