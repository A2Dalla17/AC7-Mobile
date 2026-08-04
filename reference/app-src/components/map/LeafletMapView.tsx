import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import { env } from '@shared/config/env';
import { decodePolyline } from '@shared/lib/googleMaps';
import { cn } from '@shared/lib/utils';
import { useTheme } from '@shared/providers/ThemeProvider';

import type { MapViewProps } from './types';

/**
 * AC7 Ride — map canvas
 *
 * Leaflet with CARTO raster tiles. Chosen over the Google Maps JS API for one
 * decisive reason: Google requires an API key tied to a billing account, so
 * without one the map is a grey box. CARTO needs no key, so the map is real
 * from the first render — actual streets, actual buildings, actual parks.
 *
 * ── Why Voyager, and why labels are a separate layer ───────────────────────
 * The obvious choice is CARTO Positron (`light_all`). It is also why most
 * hobby maps look flat: Positron is a deliberately muted *analytics* basemap,
 * designed to disappear behind data. For a ride-hailing app the map IS the
 * product, so we use Voyager instead — coloured parks, blue water, a real
 * road hierarchy.
 *
 * The second half matters more than the tileset. Every tile provider ships
 * two variants: `_nolabels` and `_only_labels`. Stacking them with our route
 * and markers in between is what makes a map look professional:
 *
 *   1. base tiles      roads, parks, water          (pane: tile,   z 200)
 *   2. route line      the crimson polyline         (pane: overlay,z 400)
 *   3. LABELS          street and place names       (pane: labels, z 450)
 *   4. markers         pickup, destination, cars    (pane: marker, z 600)
 *
 * Street names therefore sit ON TOP of the route rather than being painted
 * over by it — so a rider can still read which road they are being taken
 * down. Google and Uber both do exactly this. Drawing the route above the
 * labels, which is what a single combined tile layer forces, is the single
 * biggest reason a Leaflet map reads as amateur.
 *
 * Overlays are mutated in place rather than recreated. Rebuilding markers on
 * every driver-location frame is what makes tracking screens stutter.
 */

const CARTO = 'https://{s}.basemaps.cartocdn.com';
const ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';

/**
 * Retina, done the way CARTO documents it.
 *
 * Leaflet's `detectRetina` option and the `{r}` URL placeholder look like they
 * belong together. They do not, and pairing them is why so many Leaflet maps
 * look wrong on a phone:
 *
 *   detectRetina  →  request tiles one zoom level DEEPER, and shrink the tile
 *                    box from 256 to 128 CSS px
 *   {r} → "@2x"   →  ask CARTO to render that tile at 512 px
 *
 * Both at once puts a 512 px image inside a 128 px box. The map is sharp, but
 * every street name is drawn at a quarter of its designed size and the road
 * hierarchy comes from a zoom level the user is not actually at. It reads as a
 * cheap map even though the tiles are fine.
 *
 * The correct pairing is one 512 px @2x tile in the normal 256 px box: exactly
 * 2x device pixels, labels at the size the cartographer intended.
 */
const SCALE = L.Browser.retina ? '@2x' : '';

const TILES = {
  light: {
    base: `${CARTO}/rastertiles/voyager_nolabels/{z}/{x}/{y}${SCALE}.png`,
    labels: `${CARTO}/rastertiles/voyager_only_labels/{z}/{x}/{y}${SCALE}.png`,
    attribution: ATTRIBUTION,
  },
  dark: {
    base: `${CARTO}/dark_nolabels/{z}/{x}/{y}${SCALE}.png`,
    labels: `${CARTO}/dark_only_labels/{z}/{x}/{y}${SCALE}.png`,
    attribution: ATTRIBUTION,
  },
} as const;

/** Labels sit above the route (400) but below the markers (600). */
const LABEL_PANE = 'ac7-labels';
const LABEL_PANE_Z = 450;

const BRAND = '#8B0000';
const BRAND_DEEP = '#5E0000';
/* Lifted for dark mode — #8B0000 on a near-black map is almost invisible. */
const BRAND_ON_DARK = '#E5484D';

/* -------------------------------------------------------------------------- */
/* Markers — divIcon so they can be styled with CSS and animated              */
/* -------------------------------------------------------------------------- */

function pickupIcon() {
  return L.divIcon({
    className: '',
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    html: `<span style="
      display:block;width:22px;height:22px;border-radius:50%;
      border:4px solid ${BRAND};background:#fff;
      box-shadow:0 2px 8px rgba(0,0,0,.35);
    "></span>`,
  });
}

function destinationIcon() {
  return L.divIcon({
    className: '',
    iconSize: [30, 38],
    iconAnchor: [15, 38],
    html: `<svg width="30" height="38" viewBox="0 0 30 38" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M15 0C6.716 0 0 6.716 0 15c0 10.5 15 23 15 23s15-12.5 15-23C30 6.716 23.284 0 15 0z"
            fill="${BRAND}"/>
      <circle cx="15" cy="14.5" r="5.5" fill="#fff"/>
    </svg>`,
  });
}

/** Arrow glyph rotated to the driver's heading — direction readable at a glance. */
function driverIcon(heading = 0) {
  return L.divIcon({
    className: '',
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    html: `<span style="
      width:34px;height:34px;border-radius:50%;
      background:#111;border:2.5px solid #fff;
      box-shadow:0 3px 10px rgba(0,0,0,.4);
      display:flex;align-items:center;justify-content:center;
      transform:rotate(${heading}deg);transition:transform .4s cubic-bezier(.32,.72,0,1);
    ">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="#fff">
        <path d="M12 2 L19 20 L12 16 L5 20 Z"/>
      </svg>
    </span>`,
  });
}

/** Soft halo behind the driver's own position on the driver dashboard. */
function haloIcon() {
  return L.divIcon({
    className: '',
    iconSize: [180, 180],
    iconAnchor: [90, 90],
    html: `<span style="
      display:block;width:180px;height:180px;border-radius:50%;
      background:radial-gradient(circle, ${BRAND}55 0%, ${BRAND}22 45%, transparent 70%);
      pointer-events:none;
    "></span>`,
  });
}

/* -------------------------------------------------------------------------- */


export function LeafletMapView({
  center,
  zoom = env.defaultMapZoom,
  pickup,
  destination,
  drivers = [],
  routePolyline,
  fallbackLine = true,
  halo = false,
  fitBounds = true,
  minimal = false,
  className,
}: MapViewProps) {
  const { theme } = useTheme();

  const holder = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const tiles = useRef<L.TileLayer | null>(null);

  const pickupMarker = useRef<L.Marker | null>(null);
  const destMarker = useRef<L.Marker | null>(null);
  const haloMarker = useRef<L.Marker | null>(null);
  const driverMarkers = useRef<globalThis.Map<string, L.Marker>>(new globalThis.Map());
  const routeLine = useRef<L.Polyline | null>(null);
  const routeCasing = useRef<L.Polyline | null>(null);
  const labelTiles = useRef<L.TileLayer | null>(null);

  /* -- Create ------------------------------------------------------------- */
  useEffect(() => {
    if (!holder.current || map.current) return;

    const instance = L.map(holder.current, {
      center: [center?.lat ?? env.defaultMapCenter.lat, center?.lng ?? env.defaultMapCenter.lng],
      zoom,
      zoomControl: false,
      // The tile layer is the whole world; London is only where the camera
      // starts. Riders can pan and search anywhere.
      worldCopyJump: true,
      minZoom: 2,
      attributionControl: !minimal,
      // Keyboard panning stays on — a map you cannot move without a mouse is
      // not usable for everyone.
      keyboard: true,
      preferCanvas: true,
    });

    if (!minimal) L.control.zoom({ position: 'bottomleft' }).addTo(instance);

    map.current = instance;
    const markers = driverMarkers.current;

    return () => {
      instance.remove();
      map.current = null;
      tiles.current = null;
      pickupMarker.current = null;
      destMarker.current = null;
      haloMarker.current = null;
      routeLine.current = null;
      routeCasing.current = null;
      labelTiles.current = null;
      markers.clear();
    };
    // Created once; later prop changes are handled by the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* -- Tile layers follow the theme --------------------------------------- */
  useEffect(() => {
    if (!map.current) return;

    const style = theme === 'dark' ? TILES.dark : TILES.light;

    /* The labels pane is created once and reused. Its z-index puts street
       names above the route polyline but below the markers. */
    if (!map.current.getPane(LABEL_PANE)) {
      const pane = map.current.createPane(LABEL_PANE);
      pane.style.zIndex = String(LABEL_PANE_Z);
      /* Labels are decoration — clicks must fall through to the map. */
      pane.style.pointerEvents = 'none';
    }

    if (tiles.current) map.current.removeLayer(tiles.current);
    if (labelTiles.current) map.current.removeLayer(labelTiles.current);

    tiles.current = L.tileLayer(style.base, {
      attribution: style.attribution,
      subdomains: 'abcd',
      maxZoom: 20,
      /* Hold the previous zoom's tiles until the new ones decode, so a pinch
         never exposes the empty grey grid underneath. */
      keepBuffer: 4,
      updateWhenZooming: false,
      className: 'ac7-base-tiles',
    }).addTo(map.current);

    labelTiles.current = L.tileLayer(style.labels, {
      subdomains: 'abcd',
      maxZoom: 20,
      keepBuffer: 4,
      updateWhenZooming: false,
      pane: LABEL_PANE,
    }).addTo(map.current);
  }, [theme]);

  /* -- Centre ------------------------------------------------------------- */
  useEffect(() => {
    if (!map.current || !center) return;
    if (fitBounds && (pickup || destination)) return;

    map.current.panTo([center.lat, center.lng], { animate: true, duration: 0.6 });
  }, [center, fitBounds, pickup, destination]);

  /* -- Pickup and destination -------------------------------------------- */
  useEffect(() => {
    if (!map.current) return;
    const m = map.current;

    if (pickup) {
      if (pickupMarker.current) pickupMarker.current.setLatLng([pickup.lat, pickup.lng]);
      else
        pickupMarker.current = L.marker([pickup.lat, pickup.lng], {
          icon: pickupIcon(),
          zIndexOffset: 500,
          title: 'Pickup',
        }).addTo(m);
    } else if (pickupMarker.current) {
      m.removeLayer(pickupMarker.current);
      pickupMarker.current = null;
    }

    if (destination) {
      if (destMarker.current) destMarker.current.setLatLng([destination.lat, destination.lng]);
      else
        destMarker.current = L.marker([destination.lat, destination.lng], {
          icon: destinationIcon(),
          zIndexOffset: 500,
          title: 'Destination',
        }).addTo(m);
    } else if (destMarker.current) {
      m.removeLayer(destMarker.current);
      destMarker.current = null;
    }
  }, [pickup, destination]);

  /* -- Drivers ------------------------------------------------------------ */
  useEffect(() => {
    if (!map.current) return;
    const m = map.current;
    const seen = new Set<string>();

    drivers.forEach((d, index) => {
      seen.add(d.driver_id);
      const pos: L.LatLngTuple = [d.latitude, d.longitude];

      const existing = driverMarkers.current.get(d.driver_id);
      if (existing) {
        existing.setLatLng(pos);
        existing.setIcon(driverIcon(d.heading ?? 0));
      } else {
        driverMarkers.current.set(
          d.driver_id,
          L.marker(pos, {
            icon: driverIcon(d.heading ?? 0),
            zIndexOffset: 300,
            title: d.vehicle_model ?? 'Driver',
          }).addTo(m),
        );
      }

      if (halo && index === 0) {
        if (haloMarker.current) haloMarker.current.setLatLng(pos);
        else
          haloMarker.current = L.marker(pos, {
            icon: haloIcon(),
            interactive: false,
            zIndexOffset: -1000,
          }).addTo(m);
      }
    });

    for (const [id, marker] of driverMarkers.current) {
      if (!seen.has(id)) {
        m.removeLayer(marker);
        driverMarkers.current.delete(id);
      }
    }

    if (!halo && haloMarker.current) {
      m.removeLayer(haloMarker.current);
      haloMarker.current = null;
    }
  }, [drivers, halo]);

  /* -- Route -------------------------------------------------------------- */
  useEffect(() => {
    if (!map.current) return;
    const m = map.current;

    [routeCasing, routeLine].forEach((ref) => {
      if (ref.current) {
        m.removeLayer(ref.current);
        ref.current = null;
      }
    });

    let path: L.LatLngTuple[] = [];

    if (routePolyline) {
      path = decodePolyline(routePolyline).map((p) => [p.lat, p.lng] as L.LatLngTuple);
    } else if (fallbackLine && pickup && destination) {
      // A dashed straight line is honest about being an approximation — it is
      // clearly not a road — and still shows roughly where the trip goes while
      // the routing service is unavailable.
      path = [
        [pickup.lat, pickup.lng],
        [destination.lat, destination.lng],
      ];
    }

    if (path.length < 2) return;

    // Two lines: a darker casing under a brighter core. That is what makes a
    // route read clearly over both dark and light basemaps.
    /* Two strokes, drawn in order. The casing is a darker, wider line that
       reads as the route's edge; without it the core colour bleeds into the
       road underneath and the line looks painted on rather than laid over.
       Dark mode swaps to the lifted red, since #8B0000 on near-black is
       almost invisible. */
    const isDark = document.documentElement.classList.contains('dark');
    const core = isDark ? BRAND_ON_DARK : BRAND;
    const casing = isDark ? '#000000' : BRAND_DEEP;

    routeCasing.current = L.polyline(path, {
      color: casing,
      weight: 11,
      opacity: isDark ? 0.55 : 0.28,
      lineCap: 'round',
      lineJoin: 'round',
    }).addTo(m);

    routeLine.current = L.polyline(path, {
      color: core,
      weight: 6,
      opacity: 1,
      lineCap: 'round',
      lineJoin: 'round',
      /* A dashed line signals an estimate: we are drawing a straight hop
         because no real road geometry came back, and the driver should not
         read it as the actual route. */
      ...(routePolyline ? {} : { dashArray: '2 14' }),
    }).addTo(m);
  }, [routePolyline, pickup, destination, fallbackLine]);

  /* -- Fit bounds --------------------------------------------------------- */
  useEffect(() => {
    if (!map.current || !fitBounds) return;
    if (!pickup && !destination) return;

    const points: L.LatLngTuple[] = [];
    if (pickup) points.push([pickup.lat, pickup.lng]);
    if (destination) points.push([destination.lat, destination.lng]);
    if (routePolyline) decodePolyline(routePolyline).forEach((p) => points.push([p.lat, p.lng]));

    if (points.length === 0) return;

    map.current.fitBounds(L.latLngBounds(points), {
      // Generous bottom padding: the booking sheet covers the lower half.
      paddingTopLeft: [48, 72],
      paddingBottomRight: [48, minimal ? 72 : 300],
      animate: true,
      maxZoom: 16,
    });
  }, [pickup, destination, routePolyline, fitBounds, minimal]);

  /* -- Keep Leaflet in step with container resizes ------------------------ */
  useEffect(() => {
    const el = holder.current;
    if (!el) return;

    const observer = new ResizeObserver(() => map.current?.invalidateSize());
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={holder}
      role="application"
      aria-label="Map showing your trip"
      className={cn('h-full w-full', className)}
    />
  );
}
