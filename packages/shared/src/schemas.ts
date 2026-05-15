import { z } from 'zod';
import {
  BOOKING_STATUSES,
  CITIES,
  LANE_TYPES,
  PROXY_JOB_STATUSES,
  USER_ROLES,
  VEHICLE_TYPES,
} from './constants.js';

// Vietnamese plate: 29A-12345, 30E-678.90, 51F-12345 etc.
export const plateNumberSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^\d{2}[A-Z]{1,2}-?\d{3,5}(\.\d{2})?$/, 'Biển số không hợp lệ');

export const phoneSchema = z
  .string()
  .trim()
  .regex(/^(0|\+84)\d{9,10}$/, 'Số điện thoại không hợp lệ');

export const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  fullName: z.string().min(1).max(120),
  phone: phoneSchema,
});
export type SignupInput = z.infer<typeof signupSchema>;

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const predictionQuerySchema = z.object({
  centerId: z.string().min(1),
  vehicleType: z.enum(VEHICLE_TYPES),
  arrivalTime: z.string().datetime().optional(),
});
export type PredictionQuery = z.infer<typeof predictionQuerySchema>;

export const predictionResponseSchema = z.object({
  centerId: z.string(),
  predictedWaitMinutes: z.number().nonnegative(),
  lowerBoundMinutes: z.number().nonnegative(),
  upperBoundMinutes: z.number().nonnegative(),
  queueAhead: z.number().int().nonnegative(),
  confidence: z.number().min(0).max(1),
  modelVersion: z.string(),
  generatedAt: z.string().datetime(),
});
export type PredictionResponse = z.infer<typeof predictionResponseSchema>;

export const createBookingSchema = z.object({
  centerId: z.string().min(1),
  slotId: z.string().min(1),
  vehicleId: z.string().min(1),
  notes: z.string().max(500).optional(),
});
export type CreateBookingInput = z.infer<typeof createBookingSchema>;

export const bookingStatusSchema = z.enum(BOOKING_STATUSES);
export const proxyJobStatusSchema = z.enum(PROXY_JOB_STATUSES);
export const userRoleSchema = z.enum(USER_ROLES);
export const citySchema = z.enum(CITIES);
export const laneTypeSchema = z.enum(LANE_TYPES);

export const createVehicleSchema = z.object({
  plateNumber: plateNumberSchema,
  vehicleType: z.enum(VEHICLE_TYPES),
  brand: z.string().min(1).max(60),
  model: z.string().min(1).max(60),
  yearOfManufacture: z.number().int().min(1980).max(2100),
  vin: z.string().min(5).max(30).optional(),
  fleetId: z.string().min(1).optional(),
});
export type CreateVehicleInput = z.infer<typeof createVehicleSchema>;

export const createProxyJobSchema = z.object({
  vehicleId: z.string().min(1),
  pickupAddress: z.string().min(5).max(300),
  pickupTime: z.string().datetime(),
  contactPhone: phoneSchema,
  preferredCenterId: z.string().optional(),
  notes: z.string().max(500).optional(),
});
export type CreateProxyJobInput = z.infer<typeof createProxyJobSchema>;

export const createFleetSchema = z.object({
  name: z.string().min(1).max(120),
  taxCode: z.string().regex(/^\d{10}(-\d{3})?$/, 'Mã số thuế không hợp lệ'),
  contactName: z.string().min(1).max(120),
  contactPhone: phoneSchema,
  contactEmail: z.string().email(),
});
export type CreateFleetInput = z.infer<typeof createFleetSchema>;

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type Pagination = z.infer<typeof paginationSchema>;
