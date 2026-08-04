/**
 * ACT — the map
 *
 * Google draws it. Leaflet exists only so the app is never without a map.
 *
 * ── Why there is a fallback at all ─────────────────────────────────────────
 * Google's Dynamic Maps SKU gives 10,000 map loads a month and then charges.
 * The daily quota cap in Cloud Console is what stops that becoming a bill, and
 * when it trips, Google refuses. If Google were the only renderer, the rider
 * would be staring at a grey rectangle at the exact moment they were trying to
 * get home — a cost control taking the product down is a bad trade for a
 * minicab firm.
 *
 * So Leaflet stays, dormant. It renders when, and only when:
 *   - no Google key is configured
 *   - the Maps script fails to load (offline, blocked, wrong referrer)
 *   - the monthly map-load budget is spent
 *
 * The rider is not told which one they are looking at, because it is not their
 * problem and there is nothing they could do about it.
 *
 * ── Why the script is loaded here rather than in index.html ────────────────
 * A <script> tag in the document head downloads the Maps library for everyone,
 * including a visitor who only reads the terms page and never sees a map. The
 * library is large. Loading it from the first component that actually needs a
 * map means the landing site stays light, and it is the only way the "no key
 * configured" path can avoid the request entirely.
 */

import { useEffect, useState } from 'react';

import { hasGoogleMapsKey } from '@shared/config/env';
import { loadGoogleMaps } from '@shared/lib/googleMaps';

import { GoogleMapView } from './GoogleMapView';
import { canCreateMap } from './googleMapInstance';
import { LeafletMapView } from './LeafletMapView';
import type { MapViewProps } from './types';

export type { MapViewProps };

type Renderer = 'deciding' | 'google' | 'leaflet';

export function MapView(props: MapViewProps) {
  const [renderer, setRenderer] = useState<Renderer>(() =>
    /* Decided synchronously where possible so there is no flash of the wrong
       map. Only the script-loading case has to be resolved asynchronously. */
    hasGoogleMapsKey() && canCreateMap() ? 'deciding' : 'leaflet',
  );

  useEffect(() => {
    if (renderer !== 'deciding') return;

    let cancelled = false;

    loadGoogleMaps()
      .then(() => {
        if (!cancelled) setRenderer('google');
      })
      .catch(() => {
        /* Deliberately quiet. Every reason to land here — no key, blocked
           script, referrer rejected, offline — has the same correct response,
           which is to draw the map another way. Logging an error would put a
           red line in the console for behaviour that is working as designed. */
        if (!cancelled) setRenderer('leaflet');
      });

    return () => {
      cancelled = true;
    };
  }, [renderer]);

  if (renderer === 'google') {
    return (
      <GoogleMapView
        {...props}
        /* Reached when the budget runs out mid-session: the script is loaded
           and the key is fine, but no further map may be constructed. */
        onUnavailable={() => setRenderer('leaflet')}
      />
    );
  }

  if (renderer === 'leaflet') return <LeafletMapView {...props} />;

  /* Loading. A neutral surface rather than a spinner — the map appears within
     a few hundred milliseconds, and a spinner that brief reads as a glitch. */
  return <div className={props.className} aria-busy="true" />;
}
