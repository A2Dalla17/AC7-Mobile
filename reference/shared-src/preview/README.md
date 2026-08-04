# Preview mode

**Temporary. Delete `src/preview/` and `src/dev/` before launch.**

A build flag that makes the app run entirely from fixtures, with no backend.

## Why it exists

The Go services are not deployed yet. Without this, a Vercel build gives you a
login screen that cannot succeed, and every screen behind it stuck in its error
state — useless for judging the design on a phone.

The demo skip-login in `src/dev/` does not help here: it is gated on
`import.meta.env.DEV`, so it is stripped from any production build.

## Switching it on

Set **`VITE_PREVIEW_MODE=true`** at build time. Nothing else.

Set it on the Vercel preview project and nowhere else. It is off by default,
including in local dev.

## What it does

| | |
|---|---|
| `flag.ts` | The compile-time flag and the role switcher's storage key |
| `fixtures.ts` | Realistic London data — real streets, real coordinates |
| `mockApi.ts` | Matches request paths to fixtures |

`lib/http.ts` checks the flag before every request. On a match it returns the
fixture; on no match it falls through to the real network, so an unmocked
endpoint degrades to that screen's normal empty state rather than throwing.

`AuthProvider` bootstraps a session instead of redirecting to `/login`, and a
yellow **PREVIEW** pill sits at the bottom of the screen with a rider / driver /
admin switcher.

Mutations return `{ ok: true }` without persisting. The preview is a read-only
showcase; making edits stick would need a store and would leave the fixtures
inconsistent with each other.

## What it does not do

It changes no authentication logic and relaxes no check. The fabricated token
is unsigned — the Go backend verifies HS256 against `JWT_SECRET` and rejects it
on sight. This is a display fixture, not a bypass.

## The flag has to be a `define` — this bit is load-bearing

`__PREVIEW_BUILD__` comes from Vite's `define` in `vite.config.ts`. That
substitutes a bare `true` / `false` **literal** at every use site, so each
`if (PREVIEW_BUILD)` becomes statically dead and the dynamic `import()` of the
fixtures inside it is never emitted as a reachable chunk.

Two earlier attempts here did **not** achieve that, and both shipped ~20 kB of
fake London trips into a production bundle:

```ts
env.previewMode                       // property access on a runtime object
import.meta.env['VITE_PREVIEW_MODE']  // bracket access — Vite only
                                      // substitutes DOT notation
```

Both leave a runtime lookup the minifier will not fold.

### Verify it, do not assume it

After changing anything in this directory, run both builds and grep:

```bash
cd frontend

# Must be ABSENT
npx vite build
grep -r "Canary Wharf\|AMINA200\|Toyota Prius" dist/assets/*.js && echo LEAK || echo clean

# Must be PRESENT
rm -rf dist && VITE_PREVIEW_MODE=true npx vite build
grep -rq "Canary Wharf" dist/assets/*.js && echo ok || echo broken
```

Current measurement: preview adds **20 kB** to the bundle; a normal build
contains none of it.

## Removing it

1. Delete `src/preview/` and `src/dev/`
2. Remove `define: { __PREVIEW_BUILD__ }` from `vite.config.ts`
3. Remove `previewMode` from `config/env.ts`
4. `grep -rn "PREVIEW_BUILD\|DEMO_MODE" src/` and clear what is left
5. `npx tsc --noEmit` will point at anything missed
