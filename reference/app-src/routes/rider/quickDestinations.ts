/**
 * ACT — the places Londoners actually book
 *
 * ── Why these are hard-coded and not searched ──────────────────────────────
 * Airports and the big termini are most of a London minicab firm's bookings,
 * and they do not move. Searching for them would spend an Autocomplete session
 * and a Place Details call to rediscover a coordinate that has been the same
 * since the terminal was built.
 *
 * Tapping one of these costs nothing: no Google call, no quota, no debounce,
 * no waiting. It is both the fastest path for the rider and the cheapest for
 * the business — the rare case where those point the same way.
 *
 * ── Why they fill the sheet ────────────────────────────────────────────────
 * The rider home had a search box, two cards and then a large empty white
 * area. Empty space on the main screen of a booking app is a wasted
 * opportunity: it is exactly where the most likely next action belongs. Bolt
 * puts recent and suggested destinations here for the same reason.
 *
 * Coordinates are the passenger drop-off points, not the centre of the
 * property. For Heathrow that difference is over a mile and the wrong side of
 * a perimeter road.
 */

export interface QuickDestination {
  id: string;
  label: string;
  hint: string;
  lat: number;
  lng: number;
  kind: 'airport' | 'rail';
}

export const QUICK_DESTINATIONS: QuickDestination[] = [
  {
    id: 'lhr',
    label: 'Heathrow Airport',
    hint: 'All terminals',
    lat: 51.4700,
    lng: -0.4543,
    kind: 'airport',
  },
  {
    id: 'lgw',
    label: 'Gatwick Airport',
    hint: 'North & South',
    lat: 51.1537,
    lng: -0.1821,
    kind: 'airport',
  },
  {
    id: 'stn',
    label: 'Stansted Airport',
    hint: 'Essex',
    lat: 51.8860,
    lng: 0.2389,
    kind: 'airport',
  },
  {
    id: 'ltn',
    label: 'Luton Airport',
    hint: 'Bedfordshire',
    lat: 51.8747,
    lng: -0.3683,
    kind: 'airport',
  },
  {
    id: 'kgx',
    label: "King's Cross St Pancras",
    hint: 'Eurostar & national rail',
    lat: 51.5308,
    lng: -0.1238,
    kind: 'rail',
  },
  {
    id: 'vic',
    label: 'Victoria Station',
    hint: 'Rail & coach',
    lat: 51.4952,
    lng: -0.1441,
    kind: 'rail',
  },
];
