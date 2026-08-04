/**
 * ⚠️  PREVIEW ONLY — see src/preview/README.md  ⚠️
 *
 * Realistic London fixtures used when the app runs without a backend.
 *
 * These exist so the design can be reviewed on a real phone before the Go
 * services are deployed. Every shape here mirrors `@shared/api/types` exactly, so
 * if the wire format changes, TypeScript breaks this file rather than the
 * screens silently rendering wrong.
 *
 * The addresses are real London places and the coordinates are accurate,
 * because a map full of plausible-but-wrong pins is harder to evaluate than
 * one you can sanity-check against somewhere you know.
 */

import type {
  Driver,
  FavoritePlace,
  Notification,
  PaymentMethod,
  Ride,
  User,
  UserRatingProfile,
  Wallet,
  WalletTransaction,
} from '@shared/api/types';
import type { Shift } from '@shared/api/shifts';

const now = Date.now();
const iso = (minutesAgo: number) => new Date(now - minutesAgo * 60_000).toISOString();

/* -------------------------------------------------------------------------- */
/* People                                                                     */
/* -------------------------------------------------------------------------- */

export const PREVIEW_USERS: Record<'rider' | 'driver' | 'admin', User> = {
  rider: {
    id: 'preview-rider-0001',
    email: 'amina@ac7ride.test',
    phone_number: '+44 7700 900001',
    first_name: 'Amina',
    last_name: 'Yusuf',
    role: 'rider',
    is_active: true,
    is_verified: true,
    profile_image: null,
    created_at: iso(60 * 24 * 210),
    updated_at: iso(90),
  },
  driver: {
    id: 'preview-driver-0002',
    email: 'omar@ac7ride.test',
    phone_number: '+44 7700 900002',
    first_name: 'Omar',
    last_name: 'Farah',
    role: 'driver',
    is_active: true,
    is_verified: true,
    profile_image: null,
    created_at: iso(60 * 24 * 400),
    updated_at: iso(20),
  },
  admin: {
    id: 'preview-admin-0003',
    email: 'ghaalabh10@gmail.com',
    phone_number: '+44 7700 900003',
    first_name: 'Abdullahi',
    last_name: 'Mohamud',
    role: 'admin',
    is_active: true,
    is_verified: true,
    profile_image: null,
    created_at: iso(60 * 24 * 500),
    updated_at: iso(5),
  },
};

/* -------------------------------------------------------------------------- */
/* Places — real London coordinates                                           */
/* -------------------------------------------------------------------------- */

const PLACES = {
  kingsCross: { lat: 51.5308, lng: -0.1238, address: "King's Cross Station, London N1C" },
  canaryWharf: { lat: 51.5054, lng: -0.0235, address: 'Canary Wharf, London E14' },
  heathrow: { lat: 51.47, lng: -0.4543, address: 'Heathrow Terminal 5, London TW6' },
  shoreditch: { lat: 51.5265, lng: -0.0784, address: 'Shoreditch High St, London E1' },
  southBank: { lat: 51.5055, lng: -0.1165, address: 'Southbank Centre, London SE1' },
  camden: { lat: 51.5414, lng: -0.1465, address: 'Camden Market, London NW1' },
  stratford: { lat: 51.5416, lng: -0.0034, address: 'Westfield Stratford City, London E20' },
  home: { lat: 51.5462, lng: -0.1058, address: '42 Highbury Grove, London N5' },
  work: { lat: 51.5155, lng: -0.0922, address: '1 Poultry, London EC2R' },
};

/* -------------------------------------------------------------------------- */
/* Rides                                                                      */
/* -------------------------------------------------------------------------- */

function ride(
  id: string,
  from: { lat: number; lng: number; address: string },
  to: { lat: number; lng: number; address: string },
  opts: {
    status: Ride['status'];
    fare: number;
    distance: number;
    duration: number;
    minutesAgo: number;
    surge?: number;
  },
): Ride {
  return {
    id,
    rider_id: PREVIEW_USERS.rider.id,
    driver_id: opts.status === 'requested' ? null : PREVIEW_USERS.driver.id,
    status: opts.status,

    pickup_latitude: from.lat,
    pickup_longitude: from.lng,
    pickup_address: from.address,
    dropoff_latitude: to.lat,
    dropoff_longitude: to.lng,
    dropoff_address: to.address,

    estimated_distance: opts.distance,
    estimated_duration: opts.duration,
    estimated_fare: opts.fare,
    actual_distance: opts.status === 'completed' ? opts.distance : null,
    actual_duration: opts.status === 'completed' ? opts.duration : null,
    final_fare: opts.status === 'completed' ? opts.fare : null,

    surge_multiplier: opts.surge ?? 1,
    discount_amount: 0,
    currency_code: 'GBP',

    requested_at: iso(opts.minutesAgo),
    accepted_at: opts.status === 'requested' ? null : iso(opts.minutesAgo - 2),
    started_at: ['in_progress', 'completed'].includes(opts.status)
      ? iso(opts.minutesAgo - 6)
      : null,
    completed_at: opts.status === 'completed' ? iso(opts.minutesAgo - opts.duration - 6) : null,
    cancelled_at: opts.status === 'cancelled' ? iso(opts.minutesAgo - 3) : null,
    cancellation_reason: opts.status === 'cancelled' ? 'Cancelled by rider' : null,

    is_scheduled: false,
    was_negotiated: false,
    created_at: iso(opts.minutesAgo),
    updated_at: iso(Math.max(0, opts.minutesAgo - 6)),
  };
}

export const PREVIEW_RIDES: Ride[] = [
  ride('ride-live-01', PLACES.home, PLACES.canaryWharf, {
    status: 'accepted',
    fare: 24.4,
    distance: 11.2,
    duration: 34,
    minutesAgo: 4,
  }),
  ride('ride-02', PLACES.kingsCross, PLACES.heathrow, {
    status: 'completed',
    fare: 62.5,
    distance: 28.4,
    duration: 58,
    minutesAgo: 60 * 26,
    surge: 1.3,
  }),
  ride('ride-03', PLACES.shoreditch, PLACES.southBank, {
    status: 'completed',
    fare: 14.8,
    distance: 5.1,
    duration: 22,
    minutesAgo: 60 * 50,
  }),
  ride('ride-04', PLACES.camden, PLACES.work, {
    status: 'completed',
    fare: 18.2,
    distance: 7.3,
    duration: 29,
    minutesAgo: 60 * 74,
  }),
  ride('ride-05', PLACES.work, PLACES.stratford, {
    status: 'cancelled',
    fare: 16.0,
    distance: 6.8,
    duration: 25,
    minutesAgo: 60 * 96,
  }),
  ride('ride-06', PLACES.stratford, PLACES.home, {
    status: 'completed',
    fare: 21.6,
    distance: 9.4,
    duration: 31,
    minutesAgo: 60 * 120,
  }),
];

/* -------------------------------------------------------------------------- */
/* Driver                                                                     */
/* -------------------------------------------------------------------------- */

export const PREVIEW_DRIVER: Driver = {
  id: 'preview-driver-record-0002',
  user_id: PREVIEW_USERS.driver.id,
  license_number: 'FARAH901284OM9AB',
  vehicle_model: 'Toyota Prius',
  vehicle_plate: 'LM71 XKD',
  vehicle_color: 'Pearl White',
  vehicle_year: 2022,
  is_available: true,
  is_online: true,
  approval_status: 'approved',
  rating: 4.91,
  total_rides: 1284,
  current_latitude: PLACES.shoreditch.lat,
  current_longitude: PLACES.shoreditch.lng,
  last_location_update: iso(1),
  created_at: iso(60 * 24 * 400),
  updated_at: iso(1),
};

/** Cars scattered around the pickup, for the "drivers nearby" layer. */
export const PREVIEW_NEARBY = [
  { driver_id: 'd1', latitude: 51.5478, longitude: -0.1041, heading: 45 },
  { driver_id: 'd2', latitude: 51.5441, longitude: -0.1092, heading: 190 },
  { driver_id: 'd3', latitude: 51.5495, longitude: -0.1013, heading: 270 },
  { driver_id: 'd4', latitude: 51.5427, longitude: -0.1008, heading: 120 },
  { driver_id: 'd5', latitude: 51.5503, longitude: -0.1094, heading: 330 },
];

/* -------------------------------------------------------------------------- */
/* Ratings                                                                    */
/* -------------------------------------------------------------------------- */

export const PREVIEW_DRIVER_RATING: UserRatingProfile = {
  user_id: PREVIEW_USERS.driver.id,
  average_rating: 4.91,
  total_ratings: 1148,
  rating_distribution: { '5': 1012, '4': 96, '3': 24, '2': 9, '1': 7 },
  top_tags: [
    { tag: 'Great conversation', count: 214 },
    { tag: 'Clean car', count: 189 },
    { tag: 'Safe driving', count: 156 },
    { tag: 'Knows the route', count: 98 },
    { tag: 'Helped with bags', count: 61 },
  ],
  recent_ratings: [
    {
      id: 'rt-1',
      ride_id: 'ride-02',
      rater_id: PREVIEW_USERS.rider.id,
      ratee_id: PREVIEW_USERS.driver.id,
      rater_type: 'rider',
      score: 5,
      comment: 'Got me to Heathrow with time to spare even with the M4 backed up. Spotless car.',
      tags: ['Knows the route', 'Clean car'],
      is_public: true,
      created_at: iso(60 * 26),
    },
    {
      id: 'rt-2',
      ride_id: 'ride-03',
      rater_id: PREVIEW_USERS.rider.id,
      ratee_id: PREVIEW_USERS.driver.id,
      rater_type: 'rider',
      score: 5,
      comment: 'Really friendly, helped me with my suitcase.',
      tags: ['Great conversation', 'Helped with bags'],
      is_public: true,
      created_at: iso(60 * 50),
    },
    {
      id: 'rt-3',
      ride_id: 'ride-04',
      rater_id: PREVIEW_USERS.rider.id,
      ratee_id: PREVIEW_USERS.driver.id,
      rater_type: 'rider',
      score: 4,
      comment: 'Good trip, took a slightly longer way round Camden.',
      tags: ['Safe driving'],
      is_public: true,
      created_at: iso(60 * 74),
    },
  ],
  rating_trend: 0.04,
};

export const PREVIEW_RIDER_RATING: UserRatingProfile = {
  user_id: PREVIEW_USERS.rider.id,
  average_rating: 4.87,
  total_ratings: 63,
  rating_distribution: { '5': 54, '4': 6, '3': 2, '2': 1, '1': 0 },
  top_tags: [
    { tag: 'Ready on time', count: 31 },
    { tag: 'Polite', count: 24 },
    { tag: 'Clear directions', count: 11 },
  ],
  recent_ratings: [],
  rating_trend: 0.02,
};

/* -------------------------------------------------------------------------- */
/* Money                                                                      */
/* -------------------------------------------------------------------------- */

export const PREVIEW_WALLET: Wallet = {
  id: 'wallet-preview',
  user_id: PREVIEW_USERS.rider.id,
  balance: 48.6,
  currency_code: 'GBP',
  updated_at: iso(90),
};

export const PREVIEW_TRANSACTIONS: WalletTransaction[] = [
  { id: 'tx1', wallet_id: 'wallet-preview', type: 'top_up', amount: 50, description: 'Top-up · Visa 4242', created_at: iso(90) },
  {
    id: 'tx2',
    wallet_id: 'wallet-preview',
    type: 'ride_charge',
    amount: -21.6,
    description: 'Trip to Highbury',
    created_at: iso(60 * 120),
  },
  {
    id: 'tx3',
    wallet_id: 'wallet-preview',
    type: 'referral_bonus',
    amount: 200,
    description: 'Referral bonus · driver approved',
    created_at: iso(60 * 24 * 9),
  },
  {
    id: 'tx4',
    wallet_id: 'wallet-preview',
    type: 'ride_charge',
    amount: -62.5,
    description: 'Trip to Heathrow T5',
    created_at: iso(60 * 26),
  },
  {
    id: 'tx5',
    wallet_id: 'wallet-preview',
    type: 'refund',
    amount: 16,
    description: 'Refund · cancelled trip',
    created_at: iso(60 * 96),
  },
];

export const PREVIEW_PAYMENT_METHODS: PaymentMethod[] = [
  {
    id: 'pm1',
    user_id: PREVIEW_USERS.rider.id,
    type: 'card',
    brand: 'Visa',
    last_four: '4242',
    is_default: true,
    expiry_month: 4,
    expiry_year: 2029,
  },
  {
    id: 'pm2',
    user_id: PREVIEW_USERS.rider.id,
    type: 'card',
    brand: 'Mastercard',
    last_four: '8210',
    is_default: false,
    expiry_month: 11,
    expiry_year: 2027,
  },
];

/* -------------------------------------------------------------------------- */
/* Driver earnings                                                            */
/* -------------------------------------------------------------------------- */

export const PREVIEW_EARNINGS = {
  day: {
    total_earnings: 187.4,
    total_rides: 11,
    online_seconds: 6 * 3600 + 42 * 60,
    average_rating: 4.91,
    currency_code: 'GBP',
  },
  week: {
    total_earnings: 1142.8,
    total_rides: 68,
    online_seconds: 38 * 3600 + 15 * 60,
    average_rating: 4.9,
    currency_code: 'GBP',
  },
  month: {
    total_earnings: 4386.2,
    total_rides: 264,
    online_seconds: 152 * 3600,
    average_rating: 4.91,
    currency_code: 'GBP',
  },
};

export const PREVIEW_DAILY_EARNINGS = [
  { date: iso(60 * 24 * 6), total: 142.3 },
  { date: iso(60 * 24 * 5), total: 168.9 },
  { date: iso(60 * 24 * 4), total: 121.4 },
  { date: iso(60 * 24 * 3), total: 196.7 },
  { date: iso(60 * 24 * 2), total: 174.2 },
  { date: iso(60 * 24 * 1), total: 151.9 },
  { date: iso(0), total: 187.4 },
];

export const PREVIEW_EARNINGS_HISTORY = PREVIEW_RIDES.filter(
  (r) => r.status === 'completed',
).map((r, i) => ({
  id: `earn-${i}`,
  ride_id: r.id,
  gross_amount: r.final_fare ?? 0,
  commission: Number((((r.final_fare ?? 0) * 0.2)).toFixed(2)),
  net_amount: Number((((r.final_fare ?? 0) * 0.8)).toFixed(2)),
  tip_amount: i === 0 ? 5 : i === 2 ? 3 : 0,
  currency_code: 'GBP',
  created_at: r.completed_at ?? r.requested_at,
}));

export const PREVIEW_BALANCE = {
  available: 642.8,
  pending: 187.4,
  currency_code: 'GBP',
};

export const PREVIEW_PAYOUTS = [
  { id: 'po1', amount: 890.4, status: 'completed', created_at: iso(60 * 24 * 7) },
  { id: 'po2', amount: 1120.6, status: 'completed', created_at: iso(60 * 24 * 14) },
  { id: 'po3', amount: 642.8, status: 'pending', created_at: iso(60 * 6) },
];

export const PREVIEW_BANK_ACCOUNTS = [
  { id: 'ba1', bank_name: 'Monzo', last_four: '7741', is_default: true },
];

/* -------------------------------------------------------------------------- */
/* Misc                                                                       */
/* -------------------------------------------------------------------------- */

export const PREVIEW_FAVOURITES: FavoritePlace[] = [
  {
    id: 'fav1',
    user_id: PREVIEW_USERS.rider.id,
    label: 'Home',
    address: PLACES.home.address,
    latitude: PLACES.home.lat,
    longitude: PLACES.home.lng,
    icon: 'home',
  },
  {
    id: 'fav2',
    user_id: PREVIEW_USERS.rider.id,
    label: 'Work',
    address: PLACES.work.address,
    latitude: PLACES.work.lat,
    longitude: PLACES.work.lng,
    icon: 'work',
  },
  {
    id: 'fav3',
    user_id: PREVIEW_USERS.rider.id,
    label: 'Gym',
    address: 'PureGym Islington, London N1',
    latitude: 51.5362,
    longitude: -0.1033,
  },
];

export const PREVIEW_NOTIFICATIONS: Notification[] = [
  {
    id: 'n1',
    user_id: PREVIEW_USERS.rider.id,
    type: 'ride_accepted',
    title: 'Omar is on the way',
    body: 'Pearl White Toyota Prius · LM71 XKD. Arriving in about 4 minutes.',
    is_read: false,
    created_at: iso(4),
  },
  {
    id: 'n2',
    user_id: PREVIEW_USERS.rider.id,
    type: 'promo',
    title: '£200 for every driver you refer',
    body: 'Know someone who drives in London? Share your code and you both get paid.',
    is_read: false,
    created_at: iso(180),
  },
  {
    id: 'n3',
    user_id: PREVIEW_USERS.rider.id,
    type: 'payment',
    title: 'Receipt for your trip to Heathrow',
    body: '£62.50 charged to Visa •••• 4242.',
    is_read: true,
    created_at: iso(60 * 26),
  },
  {
    id: 'n4',
    user_id: PREVIEW_USERS.rider.id,
    type: 'rating',
    title: 'How was your trip with Omar?',
    body: 'Leave a rating to help other riders.',
    is_read: true,
    created_at: iso(60 * 50),
  },
];

export const PREVIEW_RIDE_TYPES = [
  { id: 'rt-standard', name: 'AC7 Go', description: 'Affordable everyday rides', capacity: 4 },
  { id: 'rt-comfort', name: 'AC7 Comfort', description: 'Newer cars, more legroom', capacity: 4 },
  { id: 'rt-xl', name: 'AC7 XL', description: 'Up to six seats', capacity: 6 },
  { id: 'rt-exec', name: 'AC7 Executive', description: 'Premium saloons', capacity: 4 },
];

export const PREVIEW_ESTIMATES = [
  { ride_type_id: 'rt-standard', estimated_fare: 18.4, currency_code: 'GBP', surge_multiplier: 1 },
  { ride_type_id: 'rt-comfort', estimated_fare: 24.9, currency_code: 'GBP', surge_multiplier: 1 },
  { ride_type_id: 'rt-xl', estimated_fare: 31.2, currency_code: 'GBP', surge_multiplier: 1.2 },
  { ride_type_id: 'rt-exec', estimated_fare: 44.5, currency_code: 'GBP', surge_multiplier: 1 },
];

export const PREVIEW_REFERRAL_CODE = {
  id: 'rc1',
  user_id: PREVIEW_USERS.rider.id,
  code: 'AMINA200',
  total_referrals: 3,
  total_earnings: 400,
  created_at: iso(60 * 24 * 60),
};

export const PREVIEW_REFERRAL_EARNINGS = {
  total_referrals: 3,
  completed_referrals: 2,
  total_earnings: 400,
  pending_referrals: 1,
  pending_earnings: 200,
};

export const PREVIEW_EMERGENCY_CONTACTS = [
  {
    id: 'ec1',
    name: 'Fatima Yusuf',
    phone_number: '+44 7700 900123',
    relationship: 'Sister',
    is_verified: true,
  },
  {
    id: 'ec2',
    name: 'Hassan Ali',
    phone_number: '+44 7700 900456',
    relationship: 'Friend',
    is_verified: false,
  },
];

/* -------------------------------------------------------------------------- */
/* Admin                                                                      */
/* -------------------------------------------------------------------------- */

export const PREVIEW_ADMIN_STATS = {
  total_users: 18432,
  total_drivers: 1247,
  total_rides: 96218,
  active_rides: 214,
  total_revenue: 1284630.5,
  revenue_today: 18240.75,
  currency_code: 'GBP',
};

/* -------------------------------------------------------------------------- */
/* Booking Shifts                                                             */
/* -------------------------------------------------------------------------- */


/** Hours from now, rounded to the next quarter hour — realistic booking times. */
const soon = (hours: number) => {
  const d = new Date(now + hours * 3_600_000);
  d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0);
  return d.toISOString();
};

function shift(
  id: string,
  from: { lat: number; lng: number; address: string },
  to: { lat: number; lng: number; address: string },
  o: {
    hours: number;
    fare: number;
    distance: number;
    duration: number;
    airport?: boolean;
    passengers?: number;
    luggage?: number;
    notes?: string;
    claimed?: boolean;
  },
): Shift {
  return {
    id,
    rider_id: PREVIEW_USERS.rider.id,
    driver_id: o.claimed ? PREVIEW_USERS.driver.id : null,
    /* A shift only gains a ride once it starts, which no fixture has. */
    ride_id: null,
    status: o.claimed ? 'assigned' : 'open',
    pickup_address: from.address,
    pickup_latitude: from.lat,
    pickup_longitude: from.lng,
    dropoff_address: to.address,
    dropoff_latitude: to.lat,
    dropoff_longitude: to.lng,
    scheduled_for: soon(o.hours),
    estimated_distance: o.distance,
    estimated_duration: o.duration,
    estimated_fare: o.fare,
    currency_code: 'GBP',
    is_airport: o.airport ?? false,
    passenger_count: o.passengers ?? 1,
    luggage_count: o.luggage ?? 0,
    notes: o.notes ?? null,
    created_at: iso(120),
    claimed_at: o.claimed ? iso(30) : null,
  };
}

export const PREVIEW_SHIFTS_AVAILABLE: Shift[] = [
  shift('sh-1', PLACES.home, PLACES.heathrow, {
    hours: 14,
    fare: 68.0,
    distance: 29.4,
    duration: 62,
    airport: true,
    passengers: 2,
    luggage: 3,
    notes: 'Early flight — please be prompt. Two large suitcases.',
  }),
  shift('sh-2', PLACES.canaryWharf, PLACES.kingsCross, {
    hours: 20,
    fare: 26.5,
    distance: 10.8,
    duration: 34,
    passengers: 1,
  }),
  shift('sh-3', PLACES.shoreditch, PLACES.heathrow, {
    hours: 32,
    fare: 74.2,
    distance: 32.1,
    duration: 71,
    airport: true,
    passengers: 3,
    luggage: 4,
    notes: 'Family of three, needs an XL.',
  }),
  shift('sh-4', PLACES.work, PLACES.camden, {
    hours: 41,
    fare: 19.8,
    distance: 7.9,
    duration: 28,
    passengers: 2,
  }),
  shift('sh-5', PLACES.stratford, PLACES.southBank, {
    hours: 60,
    fare: 23.4,
    distance: 9.6,
    duration: 31,
    passengers: 1,
    luggage: 1,
  }),
];

export const PREVIEW_SHIFTS_CLAIMED: Shift[] = [
  shift('sh-mine-1', PLACES.camden, PLACES.heathrow, {
    hours: 9,
    fare: 71.5,
    distance: 30.2,
    duration: 66,
    airport: true,
    passengers: 2,
    luggage: 2,
    claimed: true,
    notes: 'Terminal 5, departures drop-off.',
  }),
];
