/**
 * ACT — rider home
 *
 * The map, where you are, and where you are going.
 *
 * ── Map above, sheet below ─────────────────────────────────────────────────
 * The first attempt floated cards over a full-bleed map. On a phone that left
 * the controls stranded in the middle of nowhere; on a desktop the cards
 * stretched the full width of the window. Uber and Bolt both solve it the
 * same way and for the same reason: the map takes the top, a sheet owns the
 * bottom, and the sheet can be dragged up when the rider needs more room —
 * for a list of search results — or pushed down when they want to see where
 * they are.
 *
 * The sheet is capped at max-w-lg so a wide monitor gets a panel rather than
 * a control strip two feet across.
 *
 * ── Why location is asked for with a button, not on load ───────────────────
 * A permission prompt that fires the instant a page opens gets refused, and
 * once refused the browser will not ask again — the rider has to dig through
 * site settings to undo it. Asking after a deliberate tap, with the reason
 * visible above it, is the difference between a yes and a permanent no.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronRight,
  Crosshair,
  Loader2,
  Lock,
  MapPin,
  Navigation,
  Plane,
  Search,
  ShoppingBag,
  TrainFront,
} from 'lucide-react';

import { MapView } from '@/components/map/MapView';
import { DragSheet } from '@shared/components/ui/DragSheet';
import { env } from '@shared/config/env';
import { useGeolocation } from '@shared/hooks/useGeolocation';
import {
  AutocompleteSession,
  resolve,
  reverseGeocode,
  searchPlaces,
  SEARCH_DEBOUNCE_MS,
  type PlaceSuggestion,
} from '@shared/lib/geocode';
import { useAuth } from '@shared/providers/AuthProvider';

import { QUICK_DESTINATIONS } from './quickDestinations';

export function HomePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { position, permission, isLocating, error: geoError } = useGeolocation();

  const [askedForLocation, setAskedForLocation] = useState(false);
  const [pickupLabel, setPickupLabel] = useState<string | null>(null);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PlaceSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  /* Raising the sheet on focus rather than on results means the list has room
     the moment it arrives, instead of appearing under the fold and then
     jumping. It also gets the field clear of the on-screen keyboard. */
  const [searchFocused, setSearchFocused] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  /**
   * The billing session for this search.
   *
   * Google groups every Autocomplete request carrying the same token, plus the
   * one Place Details call that closes it, into a single billable session — so
   * typing "Heathrow Terminal 5" costs the same as typing "T5". Without a
   * token each debounced keystroke is billed on its own.
   *
   * A ref rather than state: changing it must not re-render, and it has to
   * survive the renders that happen while the rider types. It is replaced only
   * when a session ends, which is what keeps one search on one token.
   */
  const sessionRef = useRef<AutocompleteSession>(new AutocompleteSession());
  const [resolving, setResolving] = useState<string | null>(null);

  const centre = position ?? env.defaultMapCenter;
  const hasLocation = Boolean(position);

  /**
   * Latest position, held where an effect can read it without depending on it.
   *
   * ── The bug this fixes ────────────────────────────────────────────────────
   * The search is debounced, and the debounce lives in an effect. Adding
   * `position` to that effect's dependencies looked harmless — the search
   * biases results toward where the rider is — but useGeolocation runs
   * `watchPosition`, which fires on every GPS update and builds a NEW
   * `{lat, lng}` object each time.
   *
   * A new object is a new dependency identity, so the effect tore down and
   * rebuilt on every fix, and its cleanup cleared the pending timer. With
   * fixes arriving faster than the 1100 ms debounce, the timeout was reset
   * before it could ever fire: typing produced no request at all, no error,
   * and nothing on screen. Confirmed by watching the network — zero calls to
   * Google or Nominatim while typing.
   *
   * A ref carries the value without participating in the dependency list, so
   * the search still biases to the rider's location and the timer is only
   * reset by what should reset it: the query changing.
   */
  const positionRef = useRef(position);
  positionRef.current = position;

  /**
   * Name the pickup once a fix arrives.
   *
   * ── Why this depends on a COARSE position, not the exact one ─────────────
   * This is a billed Geocoding call. useGeolocation runs `watchPosition`, so
   * depending on the position object re-ran this on every GPS update — and in
   * a moving car that is roughly one paid call per second. Three hours of
   * driving would have burned the entire monthly free tier, and the only
   * symptom would have been a bill.
   *
   * Rounding to three decimal places is about 110 m, so the effect fires when
   * the rider has actually moved somewhere with a different name, not when
   * the GPS jitters by a few metres while they stand still. The cache in
   * lib/maps/cache.ts rounds harder still (~11 m) and catches the rest.
   *
   * Cosmetic either way — the coordinates work regardless of the label — so a
   * failure here is swallowed rather than surfaced.
   */
  const coarseLat = position ? Math.round(position.lat * 1000) / 1000 : null;
  const coarseLng = position ? Math.round(position.lng * 1000) / 1000 : null;

  useEffect(() => {
    if (coarseLat === null || coarseLng === null) return;
    let cancelled = false;
    void reverseGeocode(coarseLat, coarseLng).then((place) => {
      if (!cancelled && place) setPickupLabel(place.label);
    });
    return () => {
      cancelled = true;
    };
  }, [coarseLat, coarseLng]);

  /* Debounced search. The delay is Nominatim's rate limit rather than a UX
     choice, and the previous request is aborted so a slow early response
     cannot overwrite a newer one. */
  useEffect(() => {
    if (query.trim().length < 3) {
      setResults([]);
      setSearchError(null);
      return;
    }

    const timer = setTimeout(() => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setSearching(true);
      setSearchError(null);

      searchPlaces(query, controller.signal, sessionRef.current, positionRef.current ?? undefined)
        .then(setResults)
        .catch((e: unknown) => {
          if (e instanceof DOMException && e.name === 'AbortError') return;
          setSearchError('Address search is unavailable right now.');
        })
        .finally(() => {
          if (!controller.signal.aborted) setSearching(false);
        });
    }, SEARCH_DEBOUNCE_MS);

    /* `query` ONLY. Anything else in here that changes on a timer — and a GPS
       position does exactly that — cancels the pending search before it can
       fire. See the note on positionRef above. */
    return () => clearTimeout(timer);
  }, [query]);

  /**
   * Commit to a destination.
   *
   * A Google suggestion arrives with a place ID and no coordinates — fetching
   * them for all six results would be six paid calls to fill a list the rider
   * takes one item from. `resolve` fetches the one they chose and closes the
   * billing session. A Nominatim suggestion already has its coordinates, so
   * resolve returns it untouched and nothing is spent.
   */
  /**
   * Send the rider to booking with a destination already known.
   *
   * Shared by the search results and the popular-destination list, which is
   * the point: a hard-coded airport and a searched address arrive at booking
   * through exactly the same door, so there is only one place for that
   * handover to be wrong.
   */
  const goTo = useCallback(
    (label: string, lat: number, lng: number) => {
      const params = new URLSearchParams({ to: label, lat: String(lat), lng: String(lng) });
      navigate(`/rider/book?${params.toString()}`);
    },
    [navigate],
  );

  const choose = useCallback(
    async (place: PlaceSuggestion) => {
      setResolving(place.id);
      try {
        const resolved = await resolve(place, sessionRef.current);

        /* The session is spent either way, so the next search starts a new
           one. Reusing a closed token is billed by Google as though no token
           had been sent at all — full price, per keystroke, with nothing on
           screen to indicate it. */
        sessionRef.current = new AutocompleteSession();

        if (!resolved) {
          setSearchError('That address could not be located. Try another.');
          return;
        }

        goTo(resolved.label, resolved.lat, resolved.lng);
      } finally {
        setResolving(null);
      }
    },
    [goTo],
  );

  return (
    /*
      Phone: map strip on top, sheet below — column order, sheet last.
      Desktop: panel on the left, map filling the rest — row order REVERSED,
      because the sheet is written second in the markup but belongs first on a
      wide screen. Reversing the flex direction gets the visual order right
      without duplicating the whole tree for two layouts.
    */
    <div className="fixed inset-0 flex flex-col md:flex-row-reverse">
      {/*
        Map takes the top and is never covered by the sheet.

        `isolate` is load-bearing. Leaflet assigns its own z-indexes — tile
        pane 200, markers 600, popups 700, controls 800, up to 1000 — and
        those are absolute values in whatever stacking context they land in.
        Without isolation they painted over the entire interface, leaving only
        Leaflet's own zoom control visible. Isolating scopes those numbers
        inside this element so ordinary application layering works again.
      */}
      <div className="relative isolate z-0 min-h-0 min-w-0 flex-1">
        <MapView
          center={centre}
          zoom={hasLocation ? 15 : 12}
          {...(position ? { pickup: position } : {})}
          halo={hasLocation}
          fitBounds={false}
          className="h-full w-full"
        />

        {user?.rider_code && (
          <span className="absolute left-3 top-3 z-10 inline-flex items-center gap-1.5 rounded-pill bg-card/90 px-3 py-1.5 text-caption font-semibold shadow-card backdrop-blur">
            <span className="text-ink-subtle">Your code</span>
            <span className="font-mono text-brand-ink">{user.rider_code}</span>
          </span>
        )}
      </div>

      <DragSheet expandWhen={searchFocused || results.length > 0}>
        {/*
          Bolt's home screen, and why this is arranged the way it is.

          The previous version was a search box and two loose cards above a
          large empty white area. Empty space on the main screen of a booking
          app is the most valuable space there is — it is exactly where the
          rider's likely next action belongs — and leaving it blank is what
          made the screen feel unfinished rather than calm.

          Order is by how often it is used:
            1. where you are      — one line, confirmation, not a card
            2. where are you going — the reason the screen exists
            3. the six places Londoners actually book
            4. everything else
        */}
        <div className="space-y-5">
          {/* ---- Pickup ---------------------------------------------------- */}
          {hasLocation && (
            <p className="flex items-center gap-2 text-body-sm text-ink-muted">
              <span aria-hidden className="h-2 w-2 shrink-0 rounded-full bg-accent" />
              <span className="truncate">{pickupLabel ?? 'Your current location'}</span>
            </p>
          )}

          {/* ---- Where to -------------------------------------------------- */}
          <div>
            <h1 className="mb-3 text-h3 font-bold tracking-[-0.02em] text-ink">
              Where are you going?
            </h1>

            <label className="flex h-13 items-center gap-2.5 rounded-control border border-line bg-surface px-4 transition-colors focus-within:border-brand-ink/40">
              <Search size={19} className="shrink-0 text-ink-subtle" aria-hidden />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                placeholder="Enter a postcode or address"
                aria-label="Where to?"
                className="h-full w-full bg-transparent text-body text-ink outline-none placeholder:text-ink-subtle"
              />
              {searching && (
                <Loader2 size={16} className="shrink-0 animate-spin text-ink-subtle" aria-hidden />
              )}
            </label>

            {searchError && (
              <p role="alert" className="mt-2 text-body-sm text-danger-ink">
                {searchError}
              </p>
            )}
          </div>

          {/* ---- Results --------------------------------------------------- */}
          {results.length > 0 && (
            <ul className="-mx-2 divide-y divide-line">
              {results.map((place) => (
                <li key={place.id}>
                  <button
                    type="button"
                    onClick={() => void choose(place)}
                    disabled={resolving !== null}
                    className="flex min-h-14 w-full items-center gap-3.5 rounded-tile px-2 py-3 text-left transition-colors hover:bg-surface disabled:opacity-60"
                  >
                    <span
                      aria-hidden
                      className="grid h-10 w-10 shrink-0 place-items-center rounded-tile bg-surface text-ink-subtle"
                    >
                      {resolving === place.id ? (
                        <Loader2 size={17} className="animate-spin" />
                      ) : (
                        <MapPin size={17} />
                      )}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-body font-medium text-ink">
                        {place.label}
                      </span>
                      <span className="block truncate text-body-sm text-ink-muted">
                        {place.address}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* ---- Everything below is hidden while searching ----------------
              A rider mid-search wants the list and nothing else competing
              with it for the screen. */}
          {results.length === 0 && (
            <>
              {/* Popular destinations.
                  Hard-coded coordinates, so tapping one is instant and costs
                  no Google call at all — see quickDestinations.ts. */}
              <section>
                <h2 className="mb-2 text-caption font-semibold uppercase tracking-wide text-ink-subtle">
                  Popular destinations
                </h2>

                <ul className="divide-y divide-line overflow-hidden rounded-card border border-line">
                  {QUICK_DESTINATIONS.map((place) => (
                    <li key={place.id}>
                      <button
                        type="button"
                        onClick={() => goTo(place.label, place.lat, place.lng)}
                        className="flex min-h-14 w-full items-center gap-3.5 bg-surface px-4 py-3 text-left transition-colors hover:bg-card"
                      >
                        <span
                          aria-hidden
                          className="grid h-10 w-10 shrink-0 place-items-center rounded-tile bg-card text-ink-muted"
                        >
                          {place.kind === 'airport' ? <Plane size={17} /> : <TrainFront size={17} />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-body font-medium text-ink">
                            {place.label}
                          </span>
                          <span className="block truncate text-body-sm text-ink-muted">
                            {place.hint}
                          </span>
                        </span>
                        <ChevronRight size={17} className="shrink-0 text-ink-subtle" aria-hidden />
                      </button>
                    </li>
                  ))}
                </ul>
              </section>

              {/* Location.
                  A single row, not the large card it used to be. Typing an
                  address works with or without it, so it is a convenience and
                  should not look like a barrier standing between the rider
                  and a taxi. */}
              {!hasLocation && (
                <div className="rounded-card border border-line bg-surface p-4">
                  <div className="flex items-start gap-3">
                    <span
                      aria-hidden
                      className="grid h-10 w-10 shrink-0 place-items-center rounded-tile bg-brand-soft text-brand-ink"
                    >
                      <Navigation size={18} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-body-sm font-semibold text-ink">
                        {permission === 'denied' ? 'Location is switched off' : 'Use my location'}
                      </p>
                      <p className="mt-0.5 text-body-sm text-ink-muted">
                        {permission === 'denied'
                          ? 'Turn it on in your browser settings, or just type your pickup address.'
                          : 'Sets your pickup automatically and finds the nearest car.'}
                      </p>
                    </div>
                  </div>

                  {permission !== 'denied' && (
                    <button
                      type="button"
                      disabled={askedForLocation && isLocating}
                      onClick={() => setAskedForLocation(true)}
                      className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-control border border-brand-ink/35 text-body-sm font-semibold text-brand-ink transition-colors hover:bg-brand-soft disabled:opacity-60"
                    >
                      {askedForLocation && isLocating ? (
                        <>
                          <Loader2 size={16} className="animate-spin" aria-hidden />
                          Finding you
                        </>
                      ) : (
                        <>
                          <Crosshair size={16} aria-hidden />
                          Allow location
                        </>
                      )}
                    </button>
                  )}

                  {geoError && askedForLocation && (
                    <p className="mt-2 text-body-sm text-danger-ink">{geoError}</p>
                  )}
                </div>
              )}

              {/* Deliveries.
                  Last, and visibly inactive. A locked row placed above live
                  features reads as the app being unfinished; placed below
                  them it reads as something on the way. */}
              <div className="flex items-center gap-3 rounded-card border border-line border-dashed bg-surface/60 p-3.5">
                <span
                  aria-hidden
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-tile bg-card text-ink-subtle"
                >
                  <ShoppingBag size={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-body-sm font-semibold text-ink-muted">
                    AC7 Deliveries
                    <span className="inline-flex items-center gap-1 rounded-pill bg-card px-2 py-0.5 text-micro font-medium text-ink-subtle">
                      <Lock size={10} aria-hidden />
                      Coming soon
                    </span>
                  </p>
                  <p className="mt-0.5 text-body-sm text-ink-subtle">
                    Food, shops and parcels across London.
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      </DragSheet>
    </div>
  );
}
