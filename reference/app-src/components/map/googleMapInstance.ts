/**
 * ACT — one Google map, reused everywhere
 *
 * ── Why this exists ────────────────────────────────────────────────────────
 * Google bills a "map load" every time `new google.maps.Map()` runs. Not per
 * minute, not per tile — per construction. A rider taking one journey passes
 * through the home screen, the booking screen and the tracking screen, and the
 * naive React implementation builds a fresh map on each: four billable loads
 * for one fare, and four more if they go back and forth.
 *
 * At 10,000 free loads a month that is the difference between roughly 2,500
 * journeys and roughly 10,000. So the map is constructed once and the same
 * instance is moved between screens.
 *
 * ── How the DOM part works ─────────────────────────────────────────────────
 * The map lives in a container div that this module owns. React components do
 * not render the map; they render an empty holder and ask for the container to
 * be moved into it. `appendChild` MOVES an existing node rather than copying
 * it, so the map is detached from the old screen and attached to the new one
 * without Google ever being asked to build another.
 *
 * This works because the app only ever shows one map at a time. If two maps
 * were ever visible together this approach would break — the second would
 * steal the container from the first. That constraint is checked below rather
 * than left as a comment nobody reads.
 *
 * ── Why the map is not destroyed ───────────────────────────────────────────
 * There is no `map.destroy()` in the Maps JS API, and even if there were,
 * destroying it would guarantee the next screen pays for a new one. The
 * instance is deliberately kept alive for the whole session. It costs a few
 * megabytes of memory and saves most of the bill.
 */

import { env } from '@shared/config/env';
import { canSpend, record } from '@shared/lib/maps/budget';

/** Container holding the live map. Created once, moved between screens. */
let container: HTMLDivElement | null = null;
let instance: google.maps.Map | null = null;
let holdersAttached = 0;

/**
 * Restrained styling: soft greys, muted labels, no competing colour, so the
 * brand maroon on markers and the route line reads instantly.
 *
 * Note these are legacy JSON styles, which require the map to have NO map ID.
 * Setting both a mapId and `styles` makes Google ignore `styles` silently and
 * render the default blue-and-beige map — a confusing failure that looks like
 * the styling code never ran.
 */
const MAP_STYLE: google.maps.MapTypeStyle[] = [
  { elementType: 'geometry', stylers: [{ color: '#f5f5f7' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#6b7280' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#ffffff' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi', elementType: 'labels.text', stylers: [{ visibility: 'on' }] },
  { featureType: 'poi.business', stylers: [{ visibility: 'on' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#e8ebe8' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#ececec' }] },
  { featureType: 'transit', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#dfe3e8' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#9ca3af' }] },
];

const DARK_STYLE: google.maps.MapTypeStyle[] = [
  { elementType: 'geometry', stylers: [{ color: '#1f2023' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#9aa0a6' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#17181a' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi', elementType: 'labels.text', stylers: [{ visibility: 'on' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#23282a' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2c2e33' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#35383d' }] },
  { featureType: 'transit', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#15181c' }] },
];

export function mapStyleFor(theme: 'light' | 'dark'): google.maps.MapTypeStyle[] {
  return theme === 'dark' ? DARK_STYLE : MAP_STYLE;
}

/** True when a map already exists, so attaching it costs nothing. */
export function mapAlreadyLoaded(): boolean {
  return instance !== null;
}

/**
 * Whether a NEW map may be constructed.
 *
 * Only the first construction is billable — after that the instance is reused
 * — so an existing map is always allowed through regardless of budget. Getting
 * this the wrong way round would blank the map for the rest of the month the
 * moment the budget ran out, having already paid for it.
 */
export function canCreateMap(): boolean {
  return instance !== null || canSpend('dynamic-maps');
}

/**
 * Get the shared map, creating it on first call.
 *
 * Returns null when the budget for new map loads is spent and no map exists
 * yet — the caller renders Leaflet instead. Throwing here would take the
 * screen down over a cost control, which is the wrong trade for a rider trying
 * to get home.
 */
export function acquireMap(theme: 'light' | 'dark'): {
  container: HTMLDivElement;
  map: google.maps.Map;
} | null {
  if (instance && container) {
    instance.setOptions({ styles: mapStyleFor(theme) });
    return { container, map: instance };
  }

  if (!canSpend('dynamic-maps')) return null;

  container = document.createElement('div');
  container.style.width = '100%';
  container.style.height = '100%';

  instance = new google.maps.Map(container, {
    center: env.defaultMapCenter,
    zoom: env.defaultMapZoom,
    styles: mapStyleFor(theme),
    disableDefaultUI: true,
    gestureHandling: 'greedy',
    /* POI icons off but their labels on: a rider looking for "Tesco Extra"
       needs to read the name, and the clickable icons open Google's own
       info windows over the booking sheet. */
    clickableIcons: false,
    keyboardShortcuts: true,
    maxZoom: 20,
    minZoom: 3,
  });

  /* Counted here, once, at the only moment Google actually bills. Counting on
     every attach would show a session as four loads and exhaust the budget
     four times faster than the real spend. */
  record('dynamic-maps');

  return { container, map: instance };
}

/**
 * Move the shared map into a screen's holder.
 *
 * `appendChild` moves rather than copies, which is the entire trick: the node
 * leaves whatever screen had it and joins this one, and Google is never asked
 * for another map.
 */
export function attachMap(holder: HTMLElement, node: HTMLDivElement): void {
  if (node.parentElement !== holder) holder.appendChild(node);

  holdersAttached += 1;
  if (holdersAttached > 1 && env.isDev) {
    console.warn(
      '[map] Two map screens are mounted at once. The shared instance can only ' +
        'live in one of them, so the other will be blank. Give the second screen ' +
        'its own map or unmount the first.',
    );
  }
}

/** Called on unmount so the warning above stays accurate. */
export function releaseMap(): void {
  holdersAttached = Math.max(0, holdersAttached - 1);
}
