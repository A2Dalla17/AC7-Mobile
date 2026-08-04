import { supabase, unwrap } from '@shared/lib/supabase';

/**
 * Driver codes — the public "who is this driver?" lookup.
 *
 * Every driver has a permanent code of the form AC7 + five digits, issued by a
 * database sequence when their account is created and never reissued. A driver
 * prints it on a card in the windscreen, so the code identifies a physical
 * object in the world and cannot be allowed to change.
 *
 * The lookup runs against a SECURITY DEFINER function rather than the drivers
 * table. That matters: the landing page is unauthenticated, and granting the
 * anon role SELECT on drivers would expose licence numbers and live coordinates
 * and let anyone page through the whole fleet. The function takes a code and
 * returns at most one row, so there is nothing to enumerate — you have to
 * already know the code — and it physically cannot return a column we did not
 * list in its signature.
 */

export type DriverPresence = 'offline' | 'available' | 'on_trip' | 'on_break';

export interface DriverPublicProfile {
  driver_code: string;
  first_name: string;
  last_initial: string;
  profile_image: string | null;
  rating: number | null;
  total_rides: number | null;
  vehicle_model: string | null;
  vehicle_color: string | null;
  presence: DriverPresence;
  accepts_direct_requests: boolean;
  years_experience: number | null;
  bio: string | null;
  member_since: string;
}

/** The signed-in driver's own row — everything the driver app needs about itself. */
export interface DriverRecord {
  id: string;
  driver_code: string;
  presence: DriverPresence;
  is_online: boolean;
  is_available: boolean;
  rating: number | null;
  total_rides: number | null;
  vehicle_model: string | null;
  vehicle_plate: string | null;
  vehicle_color: string | null;
  vehicle_year: number | null;
  accepts_direct_requests: boolean;
  bio: string | null;
  years_experience: number | null;
  created_at: string;
}

/** AC7 followed by exactly five digits. */
const CODE_PATTERN = /^AC7\d{5}$/i;

export function isDriverCode(value: string): boolean {
  return CODE_PATTERN.test(value.trim());
}

/**
 * Tidy whatever the person typed or the camera read into a canonical code.
 *
 * People type "ac7 00042" and "AC7-00042"; a QR scan may hand back a whole URL
 * like https://ac7ride.com/d/AC700042. All three mean the same driver, so all
 * three are accepted rather than shown an error for a formatting difference
 * they did not know existed.
 */
export function normaliseDriverCode(raw: string): string {
  let value = raw.trim();

  // A scanned QR usually contains a deep link, not a bare code.
  const fromUrl = value.match(/\/d\/(AC7\d{5})/i);
  if (fromUrl?.[1]) return fromUrl[1].toUpperCase();

  value = value.replace(/[\s\-_.]/g, '').toUpperCase();

  // "00042" alone is unambiguous once we know we are looking for a driver.
  if (/^\d{5}$/.test(value)) return `AC7${value}`;

  return value;
}

/** The canonical deep link encoded into a driver's QR code. */
export function driverCodeUrl(code: string, origin?: string): string {
  const base = origin ?? (typeof window !== 'undefined' ? window.location.origin : '');
  return `${base}/d/${code.toUpperCase()}`;
}

/* -------------------------------------------------------------------------- */

export const driversApi = {
  /**
   * Look up a driver by code. Returns null when no such code exists, which is
   * an ordinary outcome rather than an error — most mistyped codes land here.
   */
  async lookupByCode(code: string): Promise<DriverPublicProfile | null> {
    const normalised = normaliseDriverCode(code);
    if (!isDriverCode(normalised)) return null;

    const rows = unwrap(
      await supabase.rpc('lookup_driver_by_code', { p_code: normalised }),
    ) as DriverPublicProfile[] | null;

    return rows?.[0] ?? null;
  },

  /**
   * The signed-in driver's own record, including their code.
   *
   * RLS restricts this to the caller's own row, so no filter is needed — and
   * adding one would be misleading, implying the guard lives here rather than
   * in the policy.
   *
   * The result is typed explicitly rather than inferred. Supabase can only
   * infer a shape from a generated schema, which this project does not check
   * in; without one it widens the select to an error union and every field
   * access fails to compile.
   */
  async me(): Promise<DriverRecord | null> {
    const { data, error } = await supabase
      .from('drivers')
      .select(
        'id, driver_code, presence, is_online, is_available, rating, total_rides, ' +
          'vehicle_model, vehicle_plate, vehicle_color, vehicle_year, accepts_direct_requests, ' +
          'bio, years_experience, created_at',
      )
      .maybeSingle();

    if (error) throw new Error(error.message);
    return (data as DriverRecord | null) ?? null;
  },

  /**
   * Set availability.
   *
   * Only `presence` is written. The legacy is_online/is_available booleans are
   * kept in step by a database trigger, so there is exactly one writer and the
   * two representations cannot drift apart.
   */
  async setPresence(driverId: string, presence: DriverPresence) {
    const { data, error } = await supabase
      .from('drivers')
      .update({ presence })
      .eq('id', driverId)
      .select('id, presence, is_online, is_available, presence_updated_at')
      .single();

    if (error) throw new Error(error.message);
    return data;
  },
};

/* -------------------------------------------------------------------------- */
/* Presentation helpers                                                       */
/* -------------------------------------------------------------------------- */

export interface PresenceLook {
  label: string;
  detail: string;
  /** Semantic tone consumed by Badge and the status dot. */
  tone: 'success' | 'warning' | 'muted' | 'info';
}

/**
 * How each state is described to a rider standing at the kerb.
 *
 * "on_trip" deliberately does not say "busy" — a rider wants to know whether
 * waiting is worth it, and "with a passenger" answers that where "busy" does not.
 */
export function describePresence(presence: DriverPresence): PresenceLook {
  switch (presence) {
    case 'available':
      return { label: 'Available now', detail: 'Ready to take a job', tone: 'success' };
    case 'on_trip':
      return { label: 'On a trip', detail: 'With a passenger right now', tone: 'warning' };
    case 'on_break':
      return { label: 'On a break', detail: 'Back shortly', tone: 'info' };
    case 'offline':
    default:
      return { label: 'Offline', detail: 'Not working at the moment', tone: 'muted' };
  }
}
