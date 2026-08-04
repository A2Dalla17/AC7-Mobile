import { useEffect, useId, useRef, useState } from 'react';
import { MapPin, Search, X } from 'lucide-react';

import { searchPlaces, SEARCH_DEBOUNCE_MS, type PlaceSuggestion } from '@shared/lib/geocode';
import type { LatLng } from '@shared/api/types';
import { Spinner } from '@shared/components/ui/Spinner';
import { cn } from '@shared/lib/utils';

export interface SelectedPlace {
  address: string;
  position: LatLng;
}

/**
 * Destination search
 * Backed by OpenStreetMap's Nominatim (see lib/geocode.ts), not the Go geo
 * service — that one is deployed nowhere and every search failed silently.
 *
 * Deliberately not using the Google Places JS widget: routing every lookup
 * through the backend keeps the privileged key server-side and gives you one
 * place to cache, rate-limit and log address searches.
 *
 * Implemented as an ARIA combobox so screen readers announce results and the
 * arrow keys work as expected.
 */
export function PlaceSearch({
  label,
  placeholder,
  value,
  onSelect,
  onClear,
  near,
  autoFocus = false,
  leadingDot,
}: {
  label: string;
  placeholder: string;
  value: SelectedPlace | null;
  onSelect: (place: SelectedPlace) => void;
  onClear?: () => void;
  /** Biases results toward the user's current position. */
  near?: LatLng | null;
  autoFocus?: boolean;
  /** Small coloured dot rendered in place of the search icon. */
  leadingDot?: 'pickup' | 'destination';
}) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [error, setError] = useState<string | null>(null);

  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  /* -- Debounced autocomplete --------------------------------------------- */
  useEffect(() => {
    const trimmed = query.trim();

    if (trimmed.length < 3) {
      setSuggestions([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    const timer = setTimeout(() => {
      /* Was geoApi.autocomplete on the Go backend, which is deployed nowhere:
         the request returned the SPA shell and failed on a JSON parse, so the
         box accepted typing and then did nothing. Now OpenStreetMap's own
         geocoder — the same data as the map tiles, so a pin and its label
         agree. */
      searchPlaces(trimmed)
        .then((results) => {
          if (cancelled) return;
          setSuggestions(results ?? []);
          setActiveIndex(-1);
          setOpen(true);
        })
        .catch(() => {
          if (cancelled) return;
          setSuggestions([]);
          setError('Address search is unavailable right now.');
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, near]);

  /* -- Close on outside click --------------------------------------------- */
  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, []);

  async function choose(suggestion: PlaceSuggestion) {
    setOpen(false);
    setLoading(true);

    try {
      /* The search result already carries coordinates, so the old second
         round trip for "place details" is gone — one fewer request, one fewer
         thing to fail, and it keeps us inside the rate limit. */
      onSelect({
        address: [suggestion.label, suggestion.address].filter(Boolean).join(', '),
        position: { lat: suggestion.lat, lng: suggestion.lng },
      });
      setQuery('');
      setSuggestions([]);
    } catch {
      setError('Could not load that address. Please pick another.');
    } finally {
      setLoading(false);
    }
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || suggestions.length === 0) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((i) => (i + 1) % suggestions.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (event.key === 'Enter' && activeIndex >= 0) {
      event.preventDefault();
      const chosen = suggestions[activeIndex];
      if (chosen) void choose(chosen);
    } else if (event.key === 'Escape') {
      setOpen(false);
    }
  }

  /* -- Selected state ------------------------------------------------------ */
  if (value) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-line bg-bg px-4 py-3">
        <Dot kind={leadingDot} />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-ink-muted">{label}</p>
          <p className="truncate text-body font-medium text-ink">{value.address}</p>
        </div>
        {onClear && (
          <button
            type="button"
            onClick={onClear}
            aria-label={`Clear ${label.toLowerCase()}`}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-ink-subtle transition-colors hover:bg-card hover:text-ink"
          >
            <X size={16} />
          </button>
        )}
      </div>
    );
  }

  /* -- Search state -------------------------------------------------------- */
  return (
    <div ref={containerRef} className="relative">
      <label htmlFor={`${listId}-input`} className="sr-only">
        {label}
      </label>

      <div className="relative">
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2">
          {leadingDot ? <Dot kind={leadingDot} /> : <Search size={18} className="text-ink-subtle" />}
        </span>

        <input
          ref={inputRef}
          id={`${listId}-input`}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={activeIndex >= 0 ? `${listId}-option-${activeIndex}` : undefined}
          autoComplete="off"
          autoFocus={autoFocus}
          value={query}
          placeholder={placeholder}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          onKeyDown={onKeyDown}
          className="h-13 w-full rounded-xl border border-line bg-bg py-3.5 pl-11 pr-11 text-body text-ink placeholder:text-ink-subtle focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand-ink/20"
        />

        {loading && (
          <span className="absolute right-4 top-1/2 -translate-y-1/2">
            <Spinner size="sm" className="text-ink-subtle" />
          </span>
        )}
      </div>

      {error && <p className="mt-1.5 px-1 text-sm text-danger-ink">{error}</p>}

      {open && suggestions.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          aria-label={`${label} suggestions`}
          className="absolute inset-x-0 top-full z-20 mt-2 max-h-72 overflow-y-auto rounded-xl border border-line bg-bg py-1 shadow-lifted"
        >
          {suggestions.map((suggestion, index) => (
            <li key={suggestion.id} id={`${listId}-option-${index}`} role="option" aria-selected={index === activeIndex}>
              <button
                type="button"
                onClick={() => void choose(suggestion)}
                onMouseEnter={() => setActiveIndex(index)}
                className={cn(
                  'flex w-full items-start gap-3 px-4 py-3 text-left transition-colors',
                  index === activeIndex ? 'bg-surface' : 'hover:bg-surface',
                )}
              >
                <MapPin size={17} className="mt-0.5 shrink-0 text-ink-subtle" aria-hidden />
                <span className="min-w-0">
                  <span className="block truncate text-body font-medium text-ink">
                    {suggestion.label}
                  </span>
                  {suggestion.address && (
                    <span className="block truncate text-sm text-ink-muted">
                      {suggestion.address}
                    </span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Dot({ kind }: { kind?: 'pickup' | 'destination' }) {
  if (!kind) return null;

  return (
    <span
      aria-hidden
      className={cn(
        'grid h-[18px] w-[18px] shrink-0 place-items-center',
        kind === 'pickup' ? 'text-brand-ink' : 'text-ink',
      )}
    >
      <span
        className={cn(
          'h-2.5 w-2.5 rounded-full',
          kind === 'pickup' ? 'border-[2.5px] border-current bg-bg' : 'bg-current',
        )}
      />
    </span>
  );
}
