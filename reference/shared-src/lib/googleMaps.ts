/**
 * AC7 Ride — Google Maps JavaScript API loader
 *
 * The browser key renders tiles only. Routing, ETA, traffic data, geocoding
 * and place search all go through the Go `maps` and `geo` services, which hold
 * the server-side key. That keeps the privileged key off the client and puts
 * every Google call behind your own caching and rate limiting.
 *
 * The loader is idempotent: many components can call `loadGoogleMaps()` and
 * only one script tag is ever injected.
 */

import { env, hasGoogleMapsKey } from '@shared/config/env';

export class MapsKeyMissingError extends Error {
  constructor() {
    super('VITE_GOOGLE_MAPS_BROWSER_KEY is not configured.');
    this.name = 'MapsKeyMissingError';
  }
}

let loadPromise: Promise<typeof google.maps> | null = null;

export function isGoogleMapsLoaded(): boolean {
  return typeof window !== 'undefined' && typeof window.google?.maps?.Map === 'function';
}

/**
 * Load the Maps JS API once and resolve with the `google.maps` namespace.
 * Rejects with MapsKeyMissingError when no browser key is configured, which
 * callers use to render the fallback rather than an error.
 */
export function loadGoogleMaps(): Promise<typeof google.maps> {
  if (isGoogleMapsLoaded()) return Promise.resolve(window.google.maps);
  if (loadPromise) return loadPromise;

  if (!hasGoogleMapsKey()) {
    return Promise.reject(new MapsKeyMissingError());
  }

  loadPromise = new Promise((resolve, reject) => {
    const callbackName = '__ac7MapsReady';

    const params = new URLSearchParams({
      key: env.googleMapsBrowserKey,
      libraries: env.googleMapsLibraries.join(','),
      callback: callbackName,
      loading: 'async',
      v: 'weekly',
    });

    (window as unknown as Record<string, unknown>)[callbackName] = () => {
      delete (window as unknown as Record<string, unknown>)[callbackName];
      resolve(window.google.maps);
    };

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
    script.async = true;
    script.defer = true;

    script.onerror = () => {
      loadPromise = null;
      reject(new Error('Failed to load Google Maps. Check the key and its referrer restrictions.'));
    };

    document.head.appendChild(script);
  });

  return loadPromise;
}

/* -------------------------------------------------------------------------- */
/* Map styling                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Restrained map style: soft greys, muted labels, no competing colour. The
 * brand maroon is reserved for markers and the route line so those read
 * instantly against the base map.
 */
export const AC7_MAP_STYLE: google.maps.MapTypeStyle[] = [
  { elementType: 'geometry', stylers: [{ color: '#f5f5f7' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#6b7280' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#ffffff' }] },

  { featureType: 'administrative', elementType: 'geometry', stylers: [{ visibility: 'off' }] },
  {
    featureType: 'administrative.land_parcel',
    elementType: 'labels',
    stylers: [{ visibility: 'off' }],
  },

  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  {
    featureType: 'poi.park',
    elementType: 'geometry',
    stylers: [{ color: '#e8ebe8' }, { visibility: 'on' }],
  },

  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { featureType: 'road.arterial', elementType: 'labels', stylers: [{ visibility: 'simplified' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#ececec' }] },
  { featureType: 'road.local', elementType: 'labels', stylers: [{ visibility: 'off' }] },

  { featureType: 'transit', stylers: [{ visibility: 'off' }] },

  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#dfe3e8' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#9ca3af' }] },
];

/** Default options applied to every AC7 map instance. */
export const AC7_MAP_OPTIONS: google.maps.MapOptions = {
  styles: AC7_MAP_STYLE,
  disableDefaultUI: true,
  gestureHandling: 'greedy',
  clickableIcons: false,
  zoomControl: false,
  keyboardShortcuts: true,
  maxZoom: 19,
  minZoom: 3,
};

/* -------------------------------------------------------------------------- */
/* Marker factories                                                            */
/* -------------------------------------------------------------------------- */

/** Pickup: hollow maroon ring. Destination: solid maroon pin. */
export function pinIcon(kind: 'pickup' | 'destination'): google.maps.Symbol {
  const brand = '#8A1538';

  if (kind === 'pickup') {
    return {
      path: google.maps.SymbolPath.CIRCLE,
      scale: 7,
      fillColor: '#FFFFFF',
      fillOpacity: 1,
      strokeColor: brand,
      strokeWeight: 3.5,
    };
  }

  return {
    path: google.maps.SymbolPath.CIRCLE,
    scale: 7,
    fillColor: brand,
    fillOpacity: 1,
    strokeColor: '#FFFFFF',
    strokeWeight: 3,
  };
}

/** Driver marker: a rotated arrow so heading is legible at a glance. */
export function driverIcon(heading = 0): google.maps.Symbol {
  return {
    path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
    scale: 5,
    fillColor: '#1F1F1F',
    fillOpacity: 1,
    strokeColor: '#FFFFFF',
    strokeWeight: 2,
    rotation: heading,
  };
}

/** Route polyline styling — brand maroon, rounded caps. */
export const ROUTE_POLYLINE_OPTIONS: google.maps.PolylineOptions = {
  strokeColor: '#8A1538',
  strokeOpacity: 0.9,
  strokeWeight: 5,
  geodesic: true,
};

/* -------------------------------------------------------------------------- */
/* Polyline decoding                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Decode a Google encoded polyline.
 *
 * Implemented here rather than relying on `google.maps.geometry.encoding` so
 * that route data from the backend can be decoded before the Maps script has
 * finished loading, and so tests do not need the Google namespace.
 */
export function decodePolyline(encoded: string): Array<{ lat: number; lng: number }> {
  const points: Array<{ lat: number; lng: number }> = [];

  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let result = 0;
    let shift = 0;
    let byte: number;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    lat += result & 1 ? ~(result >> 1) : result >> 1;

    result = 0;
    shift = 0;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    lng += result & 1 ? ~(result >> 1) : result >> 1;

    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }

  return points;
}
