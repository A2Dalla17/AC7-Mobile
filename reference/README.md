# Reference — the React app this Flutter app replaces

**Nothing here is compiled, imported or shipped.** It is the working
specification the Flutter rewrite is written from.

## Why it is here

Dart cannot run TypeScript, so none of this converts. What it gives you is the
answer to every question that comes up while writing a screen: what fields the
form has, what the empty state says, when the button is disabled, what happens
when the network fails. Those were decided carefully once — re-deciding them
from memory is how a rewrite ends up quietly worse than the thing it replaced.

Read the file, then write the Dart.

## Files worth reading before writing any Dart

| File | Why |
|---|---|
| `shared-src/lib/pricing.ts` | The fare formula. Base + per mile + per minute, minimum fare, surge on distance and time but never on base. **The rates are placeholders and must be replaced with AC7's real tariff.** |
| `shared-src/lib/geocode.ts` | Address search, and the fallback from Google to OpenStreetMap when the key is missing or the budget is spent. |
| `shared-src/lib/maps/budget.ts` | Why the app counts its own Google calls: each Essentials SKU gets 10,000 free a month and they do **not** pool. |
| `shared-src/lib/maps/cache.ts` | The 30-day cap is Google's licence term, not a tuning choice. Reverse geocoding keyed on coordinates rounded to ~11 m — the single biggest cost saving in the product. |
| `shared-src/api/` | Every table and RPC the app touches. The Flutter repositories should call exactly these. |

## What must NOT be carried over

- **Routing.** The web app used `/taxi/app/*`; Flutter uses GoRouter with its
  own paths.
- **The rider/driver choice on sign-in.** A mistake — the account already knows
  its role, and asking let a driver pick "rider" and land in the wrong place.
- **Leaflet.** Flutter uses `google_maps_flutter`.
- **Anything under `preview/`.** Fixtures for a demo build with no backend.

## Deleting this

Once Flutter reaches parity, delete the folder. Two descriptions of one product,
with no way to tell which is true, is worse than none.
