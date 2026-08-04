/**
 * ACT — the map contract
 *
 * One set of props, two renderers. Google draws the map; Leaflet takes over
 * only when Google cannot. Both implement exactly this interface, which is
 * what lets MapView swap between them without a single call site knowing.
 *
 * If a prop is added here it must be honoured by both, or the fallback stops
 * being a fallback and becomes a different screen.
 */

import type { LatLng, NearbyDriver } from '@shared/api/types';

export interface MapViewProps {
  center?: LatLng;
  zoom?: number;
  pickup?: LatLng | null;
  destination?: LatLng | null;
  drivers?: NearbyDriver[];
  /** Encoded polyline for the driving route. */
  routePolyline?: string | null;
  /** Straight dashed line when no route is available. */
  fallbackLine?: boolean;
  /** Demand halo under the first driver — used on the driver dashboard. */
  halo?: boolean;
  fitBounds?: boolean;
  /** Hide zoom control and attribution for small embedded maps. */
  minimal?: boolean;
  className?: string;
}
