/**
 * AC7 Ride — admin API
 *
 * Paths read from internal/admin, internal/analytics, internal/payments and
 * internal/earnings. Nothing here is invented.
 *
 * Note the admin service runs behind Kong at /api/v1/admin. When the frontend
 * proxy points straight at a single service (development without Docker),
 * these calls will 404 — the screens handle that as an error state rather
 * than pretending to have data.
 */

import { http } from '@shared/lib/http';
import type { Driver, Payment, Ride, User } from './types';

/* -------------------------------------------------------------------------- */
/* Dashboard & analytics                                                       */
/* -------------------------------------------------------------------------- */

export interface PlatformStats {
  total_users?: number;
  total_drivers?: number;
  active_drivers?: number;
  total_rides?: number;
  completed_rides?: number;
  cancelled_rides?: number;
  total_revenue?: number;
  currency_code?: string;
  users_trend?: number;
  drivers_trend?: number;
  rides_trend?: number;
  revenue_trend?: number;
}

export interface TimeSeriesPoint {
  date: string;
  value: number;
  label?: string;
}

export interface RideTypeBreakdown {
  ride_type: string;
  count: number;
  revenue?: number;
}

export const adminApi = {
  /** GET /api/v1/admin/stats */
  stats: () => http.get<PlatformStats>('/admin/stats'),

  /** GET /api/v1/analytics/revenue */
  revenueSeries: (period: 'week' | 'month' | 'year' = 'month') =>
    http.get<TimeSeriesPoint[]>('/analytics/revenue', { params: { period } }),

  /** GET /api/v1/analytics/rides */
  rideSeries: (period: 'week' | 'month' | 'year' = 'month') =>
    http.get<TimeSeriesPoint[]>('/analytics/rides', { params: { period } }),

  /** GET /api/v1/analytics/ride-types */
  rideTypeBreakdown: () => http.get<RideTypeBreakdown[]>('/analytics/ride-types'),

  /* ---- People ---------------------------------------------------------- */

  /** GET /api/v1/admin/users */
  users: (params?: { page?: number; per_page?: number; role?: string; search?: string }) =>
    http.paged<User[]>('/admin/users', { params: params ?? {} }),

  /** GET /api/v1/admin/users/:id */
  user: (id: string) => http.get<User>(`/admin/users/${id}`),

  /** POST /api/v1/admin/users/:id/suspend */
  suspendUser: (id: string, reason?: string) =>
    http.post<User>(`/admin/users/${id}/suspend`, { reason }),

  /** POST /api/v1/admin/users/:id/activate */
  activateUser: (id: string) => http.post<User>(`/admin/users/${id}/activate`),

  /* ---- Drivers --------------------------------------------------------- */

  /** GET /api/v1/admin/drivers */
  drivers: (params?: { page?: number; per_page?: number; approval_status?: string }) =>
    http.paged<Driver[]>('/admin/drivers', { params: params ?? {} }),

  /** POST /api/v1/admin/drivers/:id/approve */
  approveDriver: (id: string) => http.post<Driver>(`/admin/drivers/${id}/approve`),

  /** POST /api/v1/admin/drivers/:id/reject */
  rejectDriver: (id: string, reason: string) =>
    http.post<Driver>(`/admin/drivers/${id}/reject`, { reason }),

  /* ---- Trips ----------------------------------------------------------- */

  /** GET /api/v1/admin/rides */
  rides: (params?: { page?: number; per_page?: number; status?: string }) =>
    http.paged<Ride[]>('/admin/rides', { params: params ?? {} }),

  /* ---- Money ----------------------------------------------------------- */

  /** GET /api/v1/admin/payments */
  payments: (params?: { page?: number; per_page?: number; status?: string }) =>
    http.paged<Payment[]>('/admin/payments', { params: params ?? {} }),

  /** GET /api/v1/admin/payments/stats */
  paymentStats: () =>
    http.get<{
      total_processed?: number;
      total_refunded?: number;
      pending_count?: number;
      failed_count?: number;
      currency_code?: string;
    }>('/admin/payments/stats'),

  /** POST /api/v1/admin/payments/:id/refund */
  refundPayment: (id: string, amount?: number) =>
    http.post<Payment>(`/admin/payments/${id}/refund`, { amount }),

  /* ---- Safety ---------------------------------------------------------- */

  /** GET /api/v1/admin/safety/emergencies */
  activeEmergencies: () =>
    http.get<
      Array<{
        id: string;
        user_id: string;
        ride_id?: string;
        latitude: number;
        longitude: number;
        status: string;
        created_at: string;
      }>
    >('/admin/safety/emergencies'),

  /** GET /api/v1/admin/safety/stats */
  safetyStats: () =>
    http.get<{ active_count?: number; resolved_today?: number; incidents_open?: number }>(
      '/admin/safety/stats',
    ),
};
