/**
 * The preview-build flag, and nothing else.
 *
 * ── Why this is its own file ───────────────────────────────────────────────
 * It has to be a COMPILE-TIME constant, not a runtime lookup.
 *
 * `__PREVIEW_BUILD__` is substituted by Vite's `define` (see vite.config.ts)
 * with a bare `true` or `false` literal at every use site, so each
 * `if (PREVIEW_BUILD)` becomes statically dead and is removed along with the
 * dynamic import of the fixtures inside it.
 *
 * Two earlier attempts did NOT achieve this and both shipped the fixtures:
 *
 *   env.previewMode                        property access on a runtime object
 *   import.meta.env['VITE_PREVIEW_MODE']   bracket access; Vite only
 *                                          substitutes dot notation
 *
 * Both left a runtime lookup the minifier would not fold. Only `define`
 * produces a literal. If you change this, re-run the grep in
 * docs/PREVIEW-MODE.md against a built bundle — do not assume.
 *
 * So: use PREVIEW_BUILD to guard imports and branches. Use `env.previewMode`
 * only for things that are already inside a guarded branch, like banner copy.
 */
declare const __PREVIEW_BUILD__: boolean;

export const PREVIEW_BUILD = __PREVIEW_BUILD__;

/** Where the role switcher stores its choice. Shared, so no import cycle. */
export const PREVIEW_ROLE_KEY = 'ac7.preview.role';

export type PreviewRole = 'rider' | 'driver' | 'admin';

export function getPreviewRole(): PreviewRole {
  const stored = localStorage.getItem(PREVIEW_ROLE_KEY);
  return stored === 'driver' || stored === 'admin' ? stored : 'rider';
}

export function setPreviewRole(role: PreviewRole): void {
  localStorage.setItem(PREVIEW_ROLE_KEY, role);
}
