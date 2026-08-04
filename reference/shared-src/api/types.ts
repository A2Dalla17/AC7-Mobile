/**
 * AC7 Ride — API types
 *
 * These mirror the Go structs in pkg/models and the domain packages under
 * internal/. Field names are snake_case because that is what the JSON tags
 * emit — do not camelCase them, the wire format is the contract.
 *
 * Sources:
 *   pkg/models/user.go, ride.go, payment.go, notification.go
 *   internal/pricing, internal/geo, internal/safety, internal/earnings
 */

/* -------------------------------------------------------------------------- */
/* Users & auth                                                               */
/* -------------------------------------------------------------------------- */

export type UserRole = 'rider' | 'driver' | 'admin';

export interface User {
  id: string;
  email: string;
  phone_number: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  is_active: boolean;
  is_verified: boolean;
  profile_image?: string | null;
  /** Short identifier for the control room. ACR prefix; drivers use AC7. */
  rider_code?: string | null;
  /** Which channel they agreed to be messaged on, and when. */
  messaging_channel?: 'none' | 'whatsapp' | 'sms' | 'both';
  messaging_consent_at?: string | null;
  /** Null until phone + consent are done, which is what gates the prompt. */
  onboarded_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  phone_number: string;
  first_name: string;
  last_name: string;
  role: Exclude<UserRole, 'admin'>;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  user: User;
  token: string;
}

/* -------------------------------------------------------------------------- */
/* Drivers                                                                    */
/* -------------------------------------------------------------------------- */

export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface Driver {
  id: string;
  user_id: string;
  license_number: string;
  vehicle_model: string;
  vehicle_plate: string;
  vehicle_color: string;
  vehicle_year: number;
  is_available: boolean;
  is_online: boolean;
  approval_status: ApprovalStatus;
  rating: number;
  total_rides: number;
  current_latitude?: number | null;
  current_longitude?: number | null;
  last_location_update?: string | null;
  created_at: string;
  updated_at: string;
}

/** Shape returned by GET /geo/drivers/nearby. */
export interface NearbyDriver {
  driver_id: string;
  latitude: number;
  longitude: number;
  distance?: number;
  heading?: number;
  rating?: number;
  vehicle_model?: string;
}

/* -------------------------------------------------------------------------- */
/* Rides                                                                      */
/* -------------------------------------------------------------------------- */

export type RideStatus = 'requested' | 'accepted' | 'in_progress' | 'completed' | 'cancelled';

export interface Ride {
  id: string;
  rider_id: string;
  driver_id?: string | null;
  status: RideStatus;

  pickup_latitude: number;
  pickup_longitude: number;
  pickup_address: string;
  dropoff_latitude: number;
  dropoff_longitude: number;
  dropoff_address: string;

  estimated_distance: number;
  estimated_duration: number;
  estimated_fare: number;
  actual_distance?: number | null;
  actual_duration?: number | null;
  final_fare?: number | null;

  surge_multiplier: number;
  discount_amount: number;
  currency_code: string;

  requested_at: string;
  accepted_at?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  cancelled_at?: string | null;
  cancellation_reason?: string | null;

  rating?: number | null;
  feedback?: string | null;

  ride_type_id?: string | null;
  promo_code_id?: string | null;

  scheduled_at?: string | null;
  is_scheduled: boolean;

  country_id?: string | null;
  region_id?: string | null;
  city_id?: string | null;
  was_negotiated: boolean;

  created_at: string;
  updated_at: string;
}

/** GET /rides/:id returns the ride with related records attached. */
export interface RideResponse extends Ride {
  rider?: User;
  driver?: Driver;
}

export interface RideRequestPayload {
  pickup_latitude: number;
  pickup_longitude: number;
  pickup_address: string;
  dropoff_latitude: number;
  dropoff_longitude: number;
  dropoff_address: string;
  ride_type_id?: string | null;
  promo_code?: string;
  scheduled_at?: string | null;
  is_scheduled?: boolean;
}

export interface RideRatingPayload {
  rating: number;
  feedback?: string;
}

/* -------------------------------------------------------------------------- */
/* Ride types (vehicle tiers)                                                 */
/* -------------------------------------------------------------------------- */

export interface RideType {
  id: string;
  name: string;
  description?: string;
  base_fare?: number;
  per_km_rate?: number;
  per_minute_rate?: number;
  capacity?: number;
  icon?: string;
  is_active?: boolean;
}

/* -------------------------------------------------------------------------- */
/* Pricing                                                                    */
/* -------------------------------------------------------------------------- */

export interface FareEstimate {
  ride_type_id?: string;
  ride_type_name?: string;
  base_fare?: number;
  distance_fare?: number;
  time_fare?: number;
  surge_multiplier?: number;
  discount_amount?: number;
  total_fare: number;
  currency_code?: string;
  estimated_distance?: number;
  estimated_duration?: number;
}

export interface SurgeInfo {
  multiplier: number;
  zone_id?: string;
  reason?: string;
  active?: boolean;
}

/* -------------------------------------------------------------------------- */
/* Geo & maps                                                                 */
/* -------------------------------------------------------------------------- */

export interface LatLng {
  lat: number;
  lng: number;
}

export interface PlaceSuggestion {
  place_id: string;
  description: string;
  main_text?: string;
  secondary_text?: string;
}

export interface PlaceDetail {
  place_id: string;
  name?: string;
  formatted_address: string;
  latitude: number;
  longitude: number;
}

export interface GeocodeResult {
  formatted_address: string;
  latitude: number;
  longitude: number;
}

export interface RouteLeg {
  distance_meters: number;
  duration_seconds: number;
  /** Encoded polyline, decoded client-side for rendering. */
  polyline?: string;
}

export interface RouteResult {
  legs: RouteLeg[];
  distance_meters: number;
  duration_seconds: number;
  duration_in_traffic_seconds?: number;
  polyline?: string;
}

export interface EtaResult {
  duration_seconds: number;
  distance_meters: number;
  duration_in_traffic_seconds?: number;
}

/* -------------------------------------------------------------------------- */
/* Payments & wallet                                                          */
/* -------------------------------------------------------------------------- */

export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded';

export interface Wallet {
  id: string;
  user_id: string;
  balance: number;
  currency_code: string;
  updated_at: string;
}

export interface WalletTransaction {
  id: string;
  wallet_id: string;
  amount: number;
  type: string;
  description?: string;
  reference_id?: string | null;
  created_at: string;
}

export interface Payment {
  id: string;
  ride_id?: string | null;
  user_id: string;
  amount: number;
  currency_code: string;
  status: PaymentStatus;
  method?: string;
  created_at: string;
}

export interface PaymentMethod {
  id: string;
  user_id: string;
  type: string;
  brand?: string;
  last_four?: string;
  is_default: boolean;
  expiry_month?: number;
  expiry_year?: number;
}

/* -------------------------------------------------------------------------- */
/* Driver earnings                                                            */
/* -------------------------------------------------------------------------- */

export interface EarningsSummary {
  total_earnings: number;
  total_rides: number;
  currency_code?: string;
  period_start?: string;
  period_end?: string;
  online_seconds?: number;
  average_rating?: number;
}

export interface EarningsEntry {
  id: string;
  ride_id: string;
  gross_amount: number;
  commission: number;
  net_amount: number;
  tip_amount?: number;
  created_at: string;
}

/* -------------------------------------------------------------------------- */
/* Notifications                                                              */
/* -------------------------------------------------------------------------- */

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  body: string;
  type: string;
  is_read: boolean;
  created_at: string;
}

/* -------------------------------------------------------------------------- */
/* Safety                                                                     */
/* -------------------------------------------------------------------------- */

export interface EmergencyContact {
  id: string;
  user_id: string;
  name: string;
  phone_number: string;
  relationship?: string;
  is_verified: boolean;
}

export interface SosEvent {
  id: string;
  user_id: string;
  ride_id?: string | null;
  latitude: number;
  longitude: number;
  status: string;
  created_at: string;
}

export interface ShareLink {
  id: string;
  ride_id: string;
  token: string;
  expires_at?: string | null;
  is_active: boolean;
}

/* -------------------------------------------------------------------------- */
/* Favorites                                                                  */
/* -------------------------------------------------------------------------- */

export interface FavoritePlace {
  id: string;
  user_id: string;
  label: string;
  address: string;
  latitude: number;
  longitude: number;
  icon?: string;
}

/* -------------------------------------------------------------------------- */
/* Ratings                                                                    */
/* -------------------------------------------------------------------------- */

export type RaterType = 'rider' | 'driver';

/** internal/ratings — models.go, Rating. */
export interface Rating {
  id: string;
  ride_id: string;
  rater_id: string;
  ratee_id: string;
  rater_type: RaterType;
  /** 1–5. */
  score: number;
  comment?: string | null;
  tags?: string[];
  is_public: boolean;
  created_at: string;
}

export interface TagCount {
  tag: string;
  count: number;
}

/**
 * internal/ratings — models.go, UserRatingProfile.
 *
 * `rating_distribution` is a star → count map keyed 1..5. It arrives as a JSON
 * object, so the keys are strings on the wire even though Go types them as
 * int — hence Record<string, number> rather than Record<number, number>.
 */
export interface UserRatingProfile {
  user_id: string;
  average_rating: number;
  total_ratings: number;
  rating_distribution: Record<string, number>;
  top_tags: TagCount[];
  recent_ratings?: Rating[];
  /** Change versus last month, in stars. */
  rating_trend: number;
}

/* -------------------------------------------------------------------------- */
/* Referrals — internal/promos                                                */
/* -------------------------------------------------------------------------- */

/** GET /referrals/my-code — promos/models.go, ReferralCode. */
export interface ReferralCode {
  id: string;
  user_id: string;
  code: string;
  total_referrals: number;
  total_earnings: number;
  created_at: string;
}

/**
 * GET /referrals/my-earnings.
 *
 * The Go handler returns `map[string]interface{}` built from the aggregate in
 * promos/repository.go — the keys below are the column aliases in that query,
 * so they are the contract even though the Go side is untyped.
 */
export interface ReferralEarnings {
  total_referrals: number;
  completed_referrals: number;
  total_earnings: number;
  pending_referrals: number;
  pending_earnings: number;
}
