/**
 * AC7 Ride — shared utilities
 */

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

import { env } from '@shared/config/env';

/** Merge Tailwind classes, later ones winning conflicts. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/* -------------------------------------------------------------------------- */
/* Formatting                                                                  */
/* -------------------------------------------------------------------------- */

/** Currency, using the record's own code where present. */
export function formatCurrency(
  amount: number | null | undefined,
  currencyCode?: string | null,
): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return '—';

  const code = currencyCode || env.defaultCurrency;
  try {
    return new Intl.NumberFormat(env.locale, {
      style: 'currency',
      currency: code,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${code} ${amount.toFixed(2)}`;
  }
}

/** Distance in km, switching to metres under 1 km. */
export function formatDistance(km: number | null | undefined): string {
  if (km === null || km === undefined || Number.isNaN(km)) return '—';
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

/** Duration from minutes → "1h 24m". */
export function formatDuration(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined || Number.isNaN(minutes)) return '—';

  const total = Math.round(minutes);
  if (total < 60) return `${total} min`;

  const hours = Math.floor(total / 60);
  const rest = total % 60;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

/** Seconds → minutes, for ETA responses which come back in seconds. */
export function secondsToMinutes(seconds: number | null | undefined): number | null {
  if (seconds === null || seconds === undefined || Number.isNaN(seconds)) return null;
  return Math.round(seconds / 60);
}

/** "Today, 14:05" / "Yesterday, 09:30" / "12 Mar, 18:44". */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';

  const time = date.toLocaleTimeString(env.locale, { hour: '2-digit', minute: '2-digit' });

  const today = new Date();
  const isSameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

  if (isSameDay(date, today)) return `Today, ${time}`;

  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (isSameDay(date, yesterday)) return `Yesterday, ${time}`;

  const day = date.toLocaleDateString(env.locale, { day: 'numeric', month: 'short' });
  return `${day}, ${time}`;
}

/** "2 min ago", "3 h ago". */
export function formatRelative(iso: string | null | undefined): string {
  if (!iso) return '—';

  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '—';

  const seconds = Math.round((Date.now() - then) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)} h ago`;
  return `${Math.floor(seconds / 86_400)} d ago`;
}

export function fullName(user: { first_name?: string; last_name?: string } | null): string {
  if (!user) return '';
  return [user.first_name, user.last_name].filter(Boolean).join(' ').trim();
}

export function initials(user: { first_name?: string; last_name?: string } | null): string {
  if (!user) return '?';
  const first = user.first_name?.[0] ?? '';
  const last = user.last_name?.[0] ?? '';
  return (first + last).toUpperCase() || '?';
}

/* -------------------------------------------------------------------------- */
/* Geo                                                                         */
/* -------------------------------------------------------------------------- */

/** Great-circle distance in km. Used for client-side sorting only — the
 *  backend is authoritative for anything that affects pricing. */
export function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;

  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Waze deep link for driver navigation.
 * Opens the app when installed and falls back to waze.com in the browser.
 */
export function wazeLink(destination: { lat: number; lng: number }): string {
  return `https://waze.com/ul?ll=${destination.lat},${destination.lng}&navigate=yes`;
}

/** Google Maps turn-by-turn deep link, as the alternative to Waze. */
export function googleMapsNavLink(destination: { lat: number; lng: number }): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${destination.lat},${destination.lng}&travelmode=driving`;
}

/* -------------------------------------------------------------------------- */
/* Misc                                                                        */
/* -------------------------------------------------------------------------- */

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Trailing-edge debounce, for search-as-you-type. */
export function debounce<A extends unknown[]>(
  fn: (...args: A) => void,
  waitMs: number,
): (...args: A) => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return (...args: A) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), waitMs);
  };
}
