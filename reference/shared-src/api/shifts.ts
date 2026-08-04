import { supabase } from '@shared/lib/supabase';

/**
 * Booking Shifts — jobs booked in advance that drivers claim.
 *
 * ── The race is the whole design ───────────────────────────────────────────
 * Two drivers will tap "Claim" on the same Heathrow run in the same second.
 * Read-then-write loses that race silently and tells both of them they won, so
 * claiming goes through claim_shift(), a database function whose UPDATE carries
 * `status = 'open' and driver_id is null` in its WHERE clause. Postgres settles
 * it: exactly one UPDATE matches a row, the other matches none and raises
 * 40001. The loser is told another driver was faster, which is the truth and
 * not an error worth a red alert.
 *
 * Every read is filtered by RLS, so `available` returns nothing at all to a
 * signed-in rider — that policy requires current_driver_id() to be non-null.
 */

export type ShiftStatus = 'open' | 'claimed' | 'assigned' | 'completed' | 'cancelled';

export interface Shift {
  id: string;
  rider_id: string | null;
  driver_id: string | null;
  ride_id: string | null;
  status: ShiftStatus;
  scheduled_for: string;
  pickup_address: string;
  pickup_latitude: number | null;
  pickup_longitude: number | null;
  dropoff_address: string;
  dropoff_latitude: number | null;
  dropoff_longitude: number | null;
  estimated_distance: number | null;
  estimated_duration: number | null;
  estimated_fare: number | null;
  currency_code: string;
  passenger_count: number;
  luggage_count: number;
  is_airport: boolean;
  notes: string | null;
  claimed_at: string | null;
  created_at: string;
}

export interface CreateShiftInput {
  scheduled_for: string;
  pickup_address: string;
  dropoff_address: string;
  pickup_latitude?: number | null;
  pickup_longitude?: number | null;
  dropoff_latitude?: number | null;
  dropoff_longitude?: number | null;
  estimated_distance?: number | null;
  estimated_duration?: number | null;
  estimated_fare?: number | null;
  passenger_count?: number;
  luggage_count?: number;
  is_airport?: boolean;
  notes?: string | null;
}

const COLUMNS = '*';

/** Raised when claim_shift reports that someone else won the race. */
export class ShiftTakenError extends Error {
  readonly status = 409;
  constructor() {
    super('Another driver claimed that shift first.');
    this.name = 'ShiftTakenError';
  }
}

export const shiftsApi = {
  /** Unclaimed future work. Visible only to drivers, by policy. */
  async available(): Promise<Shift[]> {
    const { data, error } = await supabase
      .from('shifts')
      .select(COLUMNS)
      .eq('status', 'open')
      // A shift in the past is not "available" in any useful sense — a driver
      // cannot drive backwards in time — so it is noise on the list.
      .gte('scheduled_for', new Date().toISOString())
      .order('scheduled_for', { ascending: true });

    if (error) throw new Error(error.message);
    return data ?? [];
  },

  /** Shifts the signed-in driver has claimed. */
  async claimed(): Promise<Shift[]> {
    const { data, error } = await supabase
      .from('shifts')
      .select(COLUMNS)
      .in('status', ['claimed', 'assigned'])
      .order('scheduled_for', { ascending: true });

    if (error) throw new Error(error.message);
    return data ?? [];
  },

  /** Everything the caller can see — a rider's own bookings, a driver's own jobs. */
  async mine(): Promise<Shift[]> {
    const { data, error } = await supabase
      .from('shifts')
      .select(COLUMNS)
      .order('scheduled_for', { ascending: false });

    if (error) throw new Error(error.message);
    return data ?? [];
  },

  async create(input: CreateShiftInput): Promise<Shift> {
    const { data: userId, error: whoError } = await supabase.rpc('current_user_id');
    if (whoError) throw new Error(whoError.message);

    const { data, error } = await supabase
      .from('shifts')
      .insert({
        ...input,
        rider_id: userId,
        status: 'open',
        passenger_count: input.passenger_count ?? 1,
        luggage_count: input.luggage_count ?? 0,
        is_airport: input.is_airport ?? false,
      })
      .select(COLUMNS)
      .single();

    if (error) throw new Error(error.message);
    return data;
  },

  async claim(shiftId: string): Promise<Shift> {
    const { data, error } = await supabase.rpc('claim_shift', { p_shift_id: shiftId });

    if (error) {
      if (error.code === '40001' || /already taken/i.test(error.message)) {
        throw new ShiftTakenError();
      }
      throw new Error(error.message);
    }
    return data as Shift;
  },

  async release(shiftId: string): Promise<Shift> {
    const { data, error } = await supabase.rpc('release_shift', { p_shift_id: shiftId });
    if (error) throw new Error(error.message);
    return data as Shift;
  },

  /** Admin dispatch view — every shift regardless of state. */
  async all(): Promise<Shift[]> {
    const { data, error } = await supabase
      .from('shifts')
      .select(COLUMNS)
      .order('scheduled_for', { ascending: true });

    if (error) throw new Error(error.message);
    return data ?? [];
  },
};
