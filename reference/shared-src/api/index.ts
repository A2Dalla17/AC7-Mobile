/**
 * AC7 Ride — API surface
 *
 * Every path here was read directly out of the Go handlers. Where a route does
 * not exist on the backend it is marked NOT IMPLEMENTED rather than faked, so
 * there is never any doubt about what is real.
 *
 * Route sources:
 *   internal/auth/handler.go        /api/v1/auth
 *   internal/rides/handler.go       /api/v1/rides, /api/v1/driver/rides
 *   internal/geo/handler.go         /api/v1/geo, /api/v1/driver/status
 *   internal/pricing/handler.go     /api/v1/pricing
 *   internal/payments/handler.go    /api/v1/wallet, /api/v1/payments
 *   internal/safety/handler.go      /api/v1/safety
 *   internal/earnings/handler.go    /api/v1/driver/earnings
 *   internal/maps/handler.go        /maps  (note: NOT under /api/v1)
 */

import { http } from '@shared/lib/http';
import { ApiError } from '@shared/lib/http';
import type {
  Driver,
  EarningsEntry,
  EarningsSummary,
  EmergencyContact,
  EtaResult,
  FareEstimate,
  FavoritePlace,
  GeocodeResult,
  LatLng,
  LoginRequest,
  LoginResponse,
  NearbyDriver,
  Notification,
  Payment,
  PaymentMethod,
  PlaceDetail,
  PlaceSuggestion,
  RegisterRequest,
  Ride,
  Rating,
  RaterType,
  ReferralCode,
  ReferralEarnings,
  RideRatingPayload,
  UserRatingProfile,
  RideRequestPayload,
  RideResponse,
  RideType,
  RouteResult,
  ShareLink,
  SosEvent,
  SurgeInfo,
  User,
  Wallet,
  WalletTransaction,
} from './types';

/**
 * Thrown for features the brief asks for that the backend does not expose.
 * Screens catch this and show an honest "not available yet" state instead of
 * silently pretending to work.
 */
export class NotImplementedError extends ApiError {
  constructor(feature: string) {
    super(`${feature} is not available on this backend yet.`, 501, 'NOT_IMPLEMENTED');
    this.name = 'NotImplementedError';
  }
}

/* ========================================================================== */
/* AUTH — internal/auth/handler.go                                            */
/* ========================================================================== */

export const authApi = {
  /** POST /api/v1/auth/register */
  register: (payload: RegisterRequest) =>
    http.post<User>('/auth/register', payload, { anonymous: true }),

  /** POST /api/v1/auth/login */
  login: (payload: LoginRequest) =>
    http.post<LoginResponse>('/auth/login', payload, { anonymous: true }),

  /** GET /api/v1/auth/profile */
  profile: () => http.get<User>('/auth/profile'),

  /** PUT /api/v1/auth/profile */
  updateProfile: (payload: Partial<User>) => http.put<User>('/auth/profile', payload),

  /**
   * Password reset.
   *
   * `internal/auth` has no reset handler, but `internal/twofa` supports a
   * `password_reset` OTP type. So the flow is: send an OTP, verify it, then
   * the backend still needs an endpoint that accepts a new password. That last
   * step does not exist yet — hence the partial implementation below.
   *
   * Step 1 (works today): otpApi.send({ otp_type: 'password_reset', ... })
   * Step 2 (works today): otpApi.verify({ otp, otp_type: 'password_reset' })
   * Step 3 (missing):     POST /auth/password/reset  ← needs a backend handler
   */
  completePasswordReset: (_newPassword: string): Promise<never> => {
    return Promise.reject(new NotImplementedError('Setting a new password'));
  },
};

/* ========================================================================== */
/* OTP & TWO-FACTOR — internal/twofa/handler.go, mounted at /api/v1/2fa       */
/* ========================================================================== */

/** OTP purposes the backend recognises (internal/twofa/models.go). */
export type OtpType =
  | 'login'
  | 'phone_verification'
  | 'enable_2fa'
  | 'disable_2fa'
  | 'password_reset';

export type OtpDelivery = 'sms' | 'email';

export interface TwoFactorStatus {
  enabled: boolean;
  method?: string;
  phone_verified?: boolean;
}

export const otpApi = {
  /** POST /api/v1/2fa/otp/send */
  send: (otpType: OtpType, delivery: OtpDelivery = 'sms') =>
    http.post<{ expires_at?: string; sent?: boolean }>('/2fa/otp/send', {
      otp_type: otpType,
      delivery_method: delivery,
    }),

  /** POST /api/v1/2fa/otp/verify — code must be exactly 6 digits. */
  verify: (otp: string, otpType: OtpType, trustDevice = false) =>
    http.post<{ verified: boolean; token?: string }>('/2fa/otp/verify', {
      otp,
      otp_type: otpType,
      trust_device: trustDevice,
    }),

  /** POST /api/v1/2fa/phone/send — phone-number verification specifically. */
  sendPhoneVerification: () => http.post<{ sent: boolean }>('/2fa/phone/send'),

  /** POST /api/v1/2fa/phone/verify */
  verifyPhone: (otp: string) => http.post<{ verified: boolean }>('/2fa/phone/verify', { otp }),
};

export const twoFactorApi = {
  /** GET /api/v1/2fa/status */
  status: () => http.get<TwoFactorStatus>('/2fa/status'),

  /** POST /api/v1/2fa/enable */
  enable: (method: 'sms' | 'email' | 'totp' = 'sms') =>
    http.post<{ secret?: string; otpauth_url?: string; backup_codes?: string[] }>(
      '/2fa/enable',
      { method },
    ),

  /** POST /api/v1/2fa/disable */
  disable: (otp: string) => http.post<void>('/2fa/disable', { otp }),

  /** POST /api/v1/2fa/totp/verify — authenticator-app codes. */
  verifyTotp: (code: string) => http.post<{ verified: boolean }>('/2fa/totp/verify', { code }),

  /** POST /api/v1/2fa/backup-codes/regenerate */
  regenerateBackupCodes: () =>
    http.post<{ backup_codes: string[] }>('/2fa/backup-codes/regenerate'),

  /** GET /api/v1/2fa/devices */
  trustedDevices: () =>
    http.get<Array<{ id: string; device_name: string; last_used_at?: string }>>('/2fa/devices'),

  /** DELETE /api/v1/2fa/devices/:id */
  revokeDevice: (deviceId: string) => http.delete<void>(`/2fa/devices/${deviceId}`),
};

/* ========================================================================== */
/* RIDES — internal/rides/handler.go                                          */
/* ========================================================================== */

export const ridesApi = {
  /** POST /api/v1/rides */
  request: (payload: RideRequestPayload) => http.post<Ride>('/rides', payload),

  /** GET /api/v1/rides */
  list: (params?: { page?: number; per_page?: number; status?: string }) =>
    http.paged<Ride[]>('/rides', { params: params ?? {} }),

  /** GET /api/v1/rides/:id */
  get: (rideId: string) => http.get<RideResponse>(`/rides/${rideId}`),

  /** GET /api/v1/rides/surge-info */
  surgeInfo: (position: LatLng) =>
    http.get<SurgeInfo>('/rides/surge-info', {
      params: { latitude: position.lat, longitude: position.lng },
    }),

  /** GET /api/v1/rides/match-drivers */
  matchDrivers: (position: LatLng) =>
    http.get<NearbyDriver[]>('/rides/match-drivers', {
      params: { latitude: position.lat, longitude: position.lng },
    }),

  /** POST /api/v1/rides/:id/cancel */
  cancel: (rideId: string, reason?: string) =>
    http.post<Ride>(`/rides/${rideId}/cancel`, { cancellation_reason: reason }),

  /** POST /api/v1/rides/:id/rate */
  rate: (rideId: string, payload: RideRatingPayload) =>
    http.post<Ride>(`/rides/${rideId}/rate`, payload),
};

/* ========================================================================== */
/* DRIVER RIDES — internal/rides/handler.go (driver group)                    */
/* ========================================================================== */

export const driverRidesApi = {
  /** GET /api/v1/driver/rides/available */
  available: () => http.get<Ride[]>('/driver/rides/available'),

  /** POST /api/v1/driver/rides/:id/accept */
  accept: (rideId: string) => http.post<Ride>(`/driver/rides/${rideId}/accept`),

  /** POST /api/v1/driver/rides/:id/start */
  start: (rideId: string) => http.post<Ride>(`/driver/rides/${rideId}/start`),

  /** POST /api/v1/driver/rides/:id/complete */
  complete: (rideId: string) => http.post<Ride>(`/driver/rides/${rideId}/complete`),
};

/* ========================================================================== */
/* RIDE TYPES — internal/ridetypes/handler.go                                 */
/* ========================================================================== */

export const rideTypesApi = {
  /** GET /api/v1/ride-types/available */
  available: () => http.get<RideType[]>('/ride-types/available'),
};

/* ========================================================================== */
/* PRICING — internal/pricing/handler.go                                      */
/* ========================================================================== */

export interface EstimateRequest {
  pickup_latitude: number;
  pickup_longitude: number;
  dropoff_latitude: number;
  dropoff_longitude: number;
  ride_type_id?: string;
  promo_code?: string;
}

export const pricingApi = {
  /** POST /api/v1/pricing/estimate — one tier. */
  estimate: (payload: EstimateRequest) => http.post<FareEstimate>('/pricing/estimate', payload),

  /** POST /api/v1/pricing/bulk-estimate — every tier, for the selector. */
  bulkEstimate: (payload: Omit<EstimateRequest, 'ride_type_id'>) =>
    http.post<FareEstimate[]>('/pricing/bulk-estimate', payload),

  /** GET /api/v1/pricing/surge */
  surge: (position: LatLng) =>
    http.get<SurgeInfo>('/pricing/surge', {
      params: { latitude: position.lat, longitude: position.lng },
    }),

  /** POST /api/v1/pricing/cancellation-fee */
  cancellationFee: (rideId: string) =>
    http.post<{ fee: number; currency_code?: string }>('/pricing/cancellation-fee', {
      ride_id: rideId,
    }),
};

/* ========================================================================== */
/* GEO — internal/geo/handler.go                                              */
/* ========================================================================== */

export const geoApi = {
  /** POST /api/v1/geo/location — driver position ping. Driver role only. */
  pushLocation: (position: LatLng & { heading?: number; speed?: number }) =>
    http.post<void>('/geo/location', {
      latitude: position.lat,
      longitude: position.lng,
      heading: position.heading,
      speed: position.speed,
    }),

  /** GET /api/v1/geo/drivers/nearby */
  nearbyDrivers: (position: LatLng, radiusKm = 5) =>
    http.get<NearbyDriver[]>('/geo/drivers/nearby', {
      params: { latitude: position.lat, longitude: position.lng, radius: radiusKm },
    }),

  /** GET /api/v1/geo/drivers/:id/location */
  driverLocation: (driverId: string) =>
    http.get<NearbyDriver>(`/geo/drivers/${driverId}/location`),

  /** GET /api/v1/geo/geocode/autocomplete — destination search. */
  autocomplete: (query: string, near?: LatLng) =>
    http.get<PlaceSuggestion[]>('/geo/geocode/autocomplete', {
      params: {
        query,
        latitude: near?.lat,
        longitude: near?.lng,
      },
    }),

  /** GET /api/v1/geo/geocode/place */
  placeDetails: (placeId: string) =>
    http.get<PlaceDetail>('/geo/geocode/place', { params: { place_id: placeId } }),

  /** GET /api/v1/geo/geocode — address → coordinates. */
  geocode: (address: string) =>
    http.get<GeocodeResult>('/geo/geocode', { params: { address } }),

  /** GET /api/v1/geo/geocode/reverse — coordinates → address. */
  reverseGeocode: (position: LatLng) =>
    http.get<GeocodeResult>('/geo/geocode/reverse', {
      params: { latitude: position.lat, longitude: position.lng },
    }),

  /** GET /api/v1/geo/h3/demand-heatmap — admin demand view. */
  demandHeatmap: () => http.get<unknown>('/geo/h3/demand-heatmap'),

  /** POST /api/v1/driver/status — go online / offline. */
  setDriverStatus: (isAvailable: boolean) =>
    http.post<Driver>('/driver/status', { is_available: isAvailable }),

  /** GET /api/v1/driver/status */
  driverStatus: () => http.get<Driver>('/driver/status'),
};

/* ========================================================================== */
/* MAPS — internal/maps/handler.go                                            */
/* Mounted at /maps, NOT under /api/v1. Hence rawPath: true.                  */
/* ========================================================================== */

export const mapsApi = {
  /** POST /maps/route */
  route: (origin: LatLng, destination: LatLng) =>
    http.post<RouteResult>(
      '/maps/route',
      { origin, destination },
      { rawPath: true },
    ),

  /** POST /maps/eta */
  eta: (origin: LatLng, destination: LatLng) =>
    http.post<EtaResult>('/maps/eta', { origin, destination }, { rawPath: true }),

  /** POST /maps/traffic/flow */
  trafficFlow: (bounds: { north: number; south: number; east: number; west: number }) =>
    http.post<unknown>('/maps/traffic/flow', bounds, { rawPath: true }),
};

/* ========================================================================== */
/* PAYMENTS & WALLET — internal/payments/handler.go                           */
/* ========================================================================== */

export const walletApi = {
  /** GET /api/v1/wallet */
  get: () => http.get<Wallet>('/wallet'),

  /** POST /api/v1/wallet/topup */
  topUp: (amount: number, paymentMethodId?: string) =>
    http.post<Wallet>('/wallet/topup', { amount, payment_method_id: paymentMethodId }),

  /** GET /api/v1/wallet/transactions */
  transactions: (params?: { page?: number; per_page?: number }) =>
    http.paged<WalletTransaction[]>('/wallet/transactions', { params: params ?? {} }),
};

export const paymentsApi = {
  /** POST /api/v1/payments/process */
  process: (rideId: string, method: string, paymentMethodId?: string) =>
    http.post<Payment>('/payments/process', {
      ride_id: rideId,
      method,
      payment_method_id: paymentMethodId,
    }),

  /** GET /api/v1/payments/:id */
  get: (paymentId: string) => http.get<Payment>(`/payments/${paymentId}`),

  /** GET /api/v1/payment-methods */
  methods: () => http.get<PaymentMethod[]>('/payment-methods'),
};

/* ========================================================================== */
/* DRIVER EARNINGS & PAYOUTS                                                  */
/* ========================================================================== */

export const earningsApi = {
  /** GET /api/v1/driver/earnings/summary */
  summary: (period?: 'day' | 'week' | 'month') =>
    http.get<EarningsSummary>('/driver/earnings/summary', { params: { period } }),

  /** GET /api/v1/driver/earnings/daily — per-day breakdown for the chart. */
  daily: (params?: { from?: string; to?: string }) =>
    http.get<Array<{ date: string; total: number; rides: number }>>(
      '/driver/earnings/daily',
      { params: params ?? {} },
    ),

  /** GET /api/v1/driver/earnings/history — individual ride payouts. */
  history: (params?: { page?: number; per_page?: number; from?: string; to?: string }) =>
    http.paged<EarningsEntry[]>('/driver/earnings/history', { params: params ?? {} }),

  /** GET /api/v1/driver/earnings/balance — withdrawable balance. */
  balance: () =>
    http.get<{ available: number; pending: number; currency_code?: string }>(
      '/driver/earnings/balance',
    ),

  /** POST /api/v1/driver/earnings/payouts — request a payout. */
  requestPayout: (amount: number, bankAccountId?: string) =>
    http.post<{ status: string; id: string }>('/driver/earnings/payouts', {
      amount,
      bank_account_id: bankAccountId,
    }),

  /** GET /api/v1/driver/earnings/payouts */
  payoutHistory: () =>
    http.get<Array<{ id: string; amount: number; status: string; created_at: string }>>(
      '/driver/earnings/payouts',
    ),

  /** GET /api/v1/driver/earnings/bank-accounts */
  bankAccounts: () =>
    http.get<Array<{ id: string; bank_name: string; last_four: string }>>(
      '/driver/earnings/bank-accounts',
    ),

  /** GET /api/v1/driver/payouts/summary — from internal/payments, not earnings. */
  payoutSummary: () => http.get<EarningsSummary>('/driver/payouts/summary'),

  /** POST /api/v1/driver/payouts/withdraw — from internal/payments. */
  withdraw: (amount: number) =>
    http.post<{ status: string }>('/driver/payouts/withdraw', { amount }),
};

/* ========================================================================== */
/* SAFETY — internal/safety/handler.go                                        */
/* ========================================================================== */

export const safetyApi = {
  /** POST /api/v1/safety/sos */
  triggerSos: (position: LatLng, rideId?: string) =>
    http.post<SosEvent>('/safety/sos', {
      latitude: position.lat,
      longitude: position.lng,
      ride_id: rideId,
    }),

  /** DELETE /api/v1/safety/sos/:id */
  cancelSos: (sosId: string) => http.delete<void>(`/safety/sos/${sosId}`),

  /** GET /api/v1/safety/contacts */
  contacts: () => http.get<EmergencyContact[]>('/safety/contacts'),

  /** POST /api/v1/safety/contacts */
  addContact: (payload: { name: string; phone_number: string; relationship?: string }) =>
    http.post<EmergencyContact>('/safety/contacts', payload),

  /** DELETE /api/v1/safety/contacts/:id */
  removeContact: (contactId: string) => http.delete<void>(`/safety/contacts/${contactId}`),

  /** POST /api/v1/safety/share — live trip share link. */
  shareTrip: (rideId: string) => http.post<ShareLink>('/safety/share', { ride_id: rideId }),
};

/* ========================================================================== */
/* FAVORITES — internal/favorites, mounted on the mobile BFF                  */
/* ========================================================================== */

export const favoritesApi = {
  list: () => http.get<FavoritePlace[]>('/favorites'),
  create: (payload: Omit<FavoritePlace, 'id' | 'user_id'>) =>
    http.post<FavoritePlace>('/favorites', payload),
  update: (id: string, payload: Partial<FavoritePlace>) =>
    http.put<FavoritePlace>(`/favorites/${id}`, payload),
  remove: (id: string) => http.delete<void>(`/favorites/${id}`),
};

/* ========================================================================== */
/* NOTIFICATIONS                                                              */
/* ========================================================================== */

export const notificationsApi = {
  list: (params?: { page?: number; per_page?: number }) =>
    http.paged<Notification[]>('/notifications', { params: params ?? {} }),
  markRead: (id: string) => http.post<void>(`/notifications/${id}/read`),
};

/* ========================================================================== */
/* RATINGS — internal/ratings/handler.go                                      */
/* ========================================================================== */

export const ratingsApi = {
  /**
   * The signed-in user's own rating profile — average, star distribution,
   * top tags and recent reviews.
   *
   * Two endpoints, one shape: riders are rated by drivers and vice versa, so
   * the backend keeps them on separate routes with separate permissions.
   */
  myProfile: () => http.get<UserRatingProfile>('/ratings/me'),
  myDriverProfile: () => http.get<UserRatingProfile>('/driver/ratings/me'),

  /** Another user's public rating — shown on the driver card during a trip. */
  forUser: (userId: string) => http.get<UserRatingProfile>(`/ratings/users/${userId}`),

  /** Ratings this user has given out. */
  given: (params?: { limit?: number; offset?: number }) =>
    http.get<{ ratings: Rating[]; total: number }>('/ratings/given', {
      params: params ?? {},
    }),

  /** Canonical feedback tags, e.g. "Clean car", "Great conversation". */
  tags: (type: RaterType) => http.get<string[]>('/ratings/tags', { params: { type } }),

  /** A driver responding publicly to a review left about them. */
  respond: (ratingId: string, comment: string) =>
    http.post<void>(`/ratings/${ratingId}/respond`, { comment }),
};

/* ========================================================================== */
/* REFERRALS — internal/promos, mounted by cmd/promos                         */
/* ========================================================================== */

export const referralsApi = {
  /** The signed-in user's code. The backend generates one on first request. */
  myCode: () => http.get<ReferralCode>('/referrals/my-code'),

  /** Aggregate of everyone they have referred, split paid vs pending. */
  myEarnings: () => http.get<ReferralEarnings>('/referrals/my-earnings'),

  /** Redeem someone else's code. Called during onboarding, not from here. */
  apply: (code: string) => http.post<void>('/referrals/apply', { referral_code: code }),
};
