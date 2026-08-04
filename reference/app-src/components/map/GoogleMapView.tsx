/**
 * ACT — Google map renderer
 *
 * Draws the same screen as LeafletMapView, from the same props, using Google's
 * tiles and place data. This is the map riders and drivers actually see.
 *
 * ── Why Google rather than the raster tiles it replaced ────────────────────
 * Two reasons, and only one of them is looks. The old tiles came from CARTO,
 * whose terms restrict the tile service to Enterprise customers and non-profit
 * grantees — a commercial minicab firm is neither, so that was a licensing
 * exposure sitting quietly in production. The OSM Foundation's own servers are
 * no better; their policy excludes commercial use too.
 *
 * The other reason is that Google knows the places. A rider looking for a
 * hospital entrance, a retail park unit or a named pub can see it on the map
 * instead of an unlabelled grey block, which is the difference between a
 * pickup that works and a phone call to the control room.
 *
 * ── Overlays are mutated, never rebuilt ───────────────────────────────────
 * A driver's position updates every few seconds. Recreating the marker each
 * time makes the icon flicker and drops the browser's frame rate on the
 * tracking screen — the one screen a rider stares at continuously. Markers and
 * the route line are created once and moved thereafter.
 */

import { useEffect, useRef, useState } from 'react';

import { env } from '@shared/config/env';
import { decodePolyline } from '@shared/lib/googleMaps';
import { cn } from '@shared/lib/utils';
import { useTheme } from '@shared/providers/ThemeProvider';

import { acquireMap, attachMap, mapStyleFor, releaseMap } from './googleMapInstance';
import type { MapViewProps } from './types';

const BRAND = '#8A1538';

/** Pickup: hollow ring. Destination: solid pin. Reads at a glance, unlabelled. */
function pinIcon(kind: 'pickup' | 'destination'): google.maps.Symbol {
  const filled = kind === 'destination';
  return {
    path: google.maps.SymbolPath.CIRCLE,
    scale: 7,
    fillColor: filled ? BRAND : '#FFFFFF',
    fillOpacity: 1,
    strokeColor: filled ? '#FFFFFF' : BRAND,
    strokeWeight: filled ? 3 : 3.5,
  };
}

function driverIcon(heading = 0): google.maps.Symbol {
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

/** Called when the map cannot be created, so MapView can fall back to Leaflet. */
export interface GoogleMapViewProps extends MapViewProps {
  onUnavailable: () => void;
}

export function GoogleMapView({
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
  onUnavailable,
}: GoogleMapViewProps) {
  const { theme } = useTheme();
  const holder = useRef<HTMLDivElement>(null);
  const map = useRef<google.maps.Map | null>(null);
  const [ready, setReady] = useState(false);

  const pickupMarker = useRef<google.maps.Marker | null>(null);
  const destMarker = useRef<google.maps.Marker | null>(null);
  const haloCircle = useRef<google.maps.Circle | null>(null);
  const driverMarkers = useRef<globalThis.Map<string, google.maps.Marker>>(new globalThis.Map());
  const routeLine = useRef<google.maps.Polyline | null>(null);

  /* -- Attach the shared map --------------------------------------------- */
  useEffect(() => {
    if (!holder.current) return;

    const acquired = acquireMap(theme === 'dark' ? 'dark' : 'light');
    if (!acquired) {
      /* Budget for new map loads is spent. Not an error — the cost control
         working — so hand over to Leaflet rather than showing a broken box. */
      onUnavailable();
      return;
    }

    attachMap(holder.current, acquired.container);
    map.current = acquired.map;
    setReady(true);

    /* The map was created while detached from the document, or moved between
       screens of different sizes, so it does not know its own dimensions.
       Without this the tiles render into the top-left corner and the rest is
       grey — the classic "half a map" symptom. */
    google.maps.event.trigger(acquired.map, 'resize');

    return () => {
      releaseMap();
      /* Overlays belong to this screen, not to the shared map, so they are
         removed while the map itself survives for the next screen. Leaving
         them attached would show the previous journey's route over the new
         one. */
      pickupMarker.current?.setMap(null);
      destMarker.current?.setMap(null);
      haloCircle.current?.setMap(null);
      routeLine.current?.setMap(null);
      driverMarkers.current.forEach((m) => m.setMap(null));
      driverMarkers.current.clear();

      pickupMarker.current = null;
      destMarker.current = null;
      haloCircle.current = null;
      routeLine.current = null;
      map.current = null;
    };
    // Attach once per mount. Theme is handled separately below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* -- Theme -------------------------------------------------------------- */
  useEffect(() => {
    if (!ready || !map.current) return;
    map.current.setOptions({ styles: mapStyleFor(theme === 'dark' ? 'dark' : 'light') });
  }, [theme, ready]);

  /* -- Controls ----------------------------------------------------------- */
  useEffect(() => {
    if (!ready || !map.current) return;
    map.current.setOptions({
      zoomControl: !minimal,
      zoomControlOptions: { position: google.maps.ControlPosition.LEFT_BOTTOM },
    });
  }, [minimal, ready]);

  /* -- Camera ------------------------------------------------------------- */
  useEffect(() => {
    if (!ready || !map.current || !center) return;
    map.current.setCenter(center);
    map.current.setZoom(zoom);
  }, [center?.lat, center?.lng, zoom, ready]);

  /* -- Pickup and destination --------------------------------------------- */
  useEffect(() => {
    if (!ready || !map.current) return;

    for (const [point, ref, kind] of [
      [pickup, pickupMarker, 'pickup'],
      [destination, destMarker, 'destination'],
    ] as const) {
      if (point) {
        if (ref.current) {
          ref.current.setPosition(point);
        } else {
          ref.current = new google.maps.Marker({
            map: map.current,
            position: point,
            icon: pinIcon(kind),
            /* Above the route line, below nothing else. */
            zIndex: 20,
          });
        }
      } else {
        ref.current?.setMap(null);
        ref.current = null;
      }
    }
  }, [pickup?.lat, pickup?.lng, destination?.lat, destination?.lng, ready]);

  /* -- Demand halo -------------------------------------------------------- */
  useEffect(() => {
    if (!ready || !map.current) return;

    const at = drivers[0] ? { lat: drivers[0].latitude, lng: drivers[0].longitude } : pickup;

    if (halo && at) {
      if (haloCircle.current) {
        haloCircle.current.setCenter(at);
      } else {
        haloCircle.current = new google.maps.Circle({
          map: map.current,
          center: at,
          radius: 700,
          strokeColor: BRAND,
          strokeOpacity: 0.25,
          strokeWeight: 1,
          fillColor: BRAND,
          fillOpacity: 0.1,
          clickable: false,
          zIndex: 1,
        });
      }
    } else {
      haloCircle.current?.setMap(null);
      haloCircle.current = null;
    }
  }, [halo, drivers[0]?.latitude, drivers[0]?.longitude, pickup?.lat, pickup?.lng, ready]);

  /* -- Drivers ------------------------------------------------------------ */
  useEffect(() => {
    if (!ready || !map.current) return;

    const seen = new Set<string>();

    for (const d of drivers) {
      seen.add(d.driver_id);
      const at = { lat: d.latitude, lng: d.longitude };
      const existing = driverMarkers.current.get(d.driver_id);

      if (existing) {
        /* Moved, not rebuilt — see the note at the top of this file. */
        existing.setPosition(at);
        existing.setIcon(driverIcon(d.heading ?? 0));
      } else {
        driverMarkers.current.set(
          d.driver_id,
          new google.maps.Marker({
            map: map.current,
            position: at,
            icon: driverIcon(d.heading ?? 0),
            zIndex: 15,
          }),
        );
      }
    }

    /* Drivers who have gone offline or out of range. */
    driverMarkers.current.forEach((marker, id) => {
      if (!seen.has(id)) {
        marker.setMap(null);
        driverMarkers.current.delete(id);
      }
    });
  }, [drivers, ready]);

  /* -- Route -------------------------------------------------------------- */
  useEffect(() => {
    if (!ready || !map.current) return;

    let path: google.maps.LatLngLiteral[] = [];
    let dashed = false;

    if (routePolyline) {
      path = decodePolyline(routePolyline);
    } else if (fallbackLine && pickup && destination) {
      /* No route from the server yet. A straight dashed line says "we know
         both ends, we are still working out the road" — an empty map between
         two pins reads as a failure. */
      path = [pickup, destination];
      dashed = true;
    }

    if (path.length < 2) {
      routeLine.current?.setMap(null);
      routeLine.current = null;
      return;
    }

    const options: google.maps.PolylineOptions = {
      path,
      strokeColor: BRAND,
      strokeOpacity: dashed ? 0 : 0.9,
      strokeWeight: 5,
      zIndex: 10,
      ...(dashed
        ? {
            icons: [
              {
                icon: { path: 'M 0,-1 0,1', strokeOpacity: 0.7, scale: 3 },
                offset: '0',
                repeat: '12px',
              },
            ],
          }
        : {}),
    };

    if (routeLine.current) {
      routeLine.current.setOptions(options);
    } else {
      routeLine.current = new google.maps.Polyline({ map: map.current, ...options });
    }
  }, [routePolyline, fallbackLine, pickup?.lat, pickup?.lng, destination?.lat, destination?.lng, ready]);

  /* -- Fit ---------------------------------------------------------------- */
  useEffect(() => {
    if (!ready || !map.current || !fitBounds) return;

    const points = [pickup, destination, ...drivers.map((d) => ({ lat: d.latitude, lng: d.longitude }))]
      .filter((p): p is { lat: number; lng: number } => Boolean(p));

    if (points.length < 2) return;

    const bounds = new google.maps.LatLngBounds();
    points.forEach((p) => bounds.extend(p));
    /* Padding keeps the pins clear of the bottom sheet and the header. */
    map.current.fitBounds(bounds, { top: 80, right: 56, bottom: 220, left: 56 });
  }, [fitBounds, pickup?.lat, pickup?.lng, destination?.lat, destination?.lng, drivers.length, ready]);

  return <div ref={holder} className={cn('relative h-full w-full', className)} />;
}
