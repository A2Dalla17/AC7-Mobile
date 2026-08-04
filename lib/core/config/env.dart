/// AC7 — runtime configuration
///
/// ── Why compile-time constants and not a .env file ─────────────────────────
/// A `.env` bundled as a Flutter asset is not a secret: anyone can unzip an APK
/// and read the assets folder. `--dart-define` bakes values into the binary,
/// which is no more secret, but is at least honest about it — and it makes the
/// values available at compile time so `const` works and dead branches are
/// removed.
///
/// Nothing here is sensitive. The Supabase anon key is designed to be public;
/// row-level security is what protects the data. The service-role key must
/// never appear in this file or anywhere else in this app.
///
/// ── How to build ───────────────────────────────────────────────────────────
/// Passing six --dart-define flags by hand every time is how one gets
/// forgotten, so they live in a JSON file instead:
///
///   flutter run --dart-define-from-file=env/dev.json
///   flutter build appbundle --dart-define-from-file=env/prod.json
///
/// Those JSON files are gitignored. env/example.json is committed and shows the
/// shape.
library;

abstract final class Env {
  // ── Supabase ─────────────────────────────────────────────────────────────
  static const supabaseUrl = String.fromEnvironment('SUPABASE_URL');
  static const supabaseAnonKey = String.fromEnvironment('SUPABASE_ANON_KEY');

  // ── Google Maps ──────────────────────────────────────────────────────────
  // Places, Geocoding and Routes. The map itself is rendered by
  // google_maps_flutter, which reads its key from the Android manifest and the
  // iOS AppDelegate rather than from here — a platform requirement, not a
  // choice.
  static const googlePlacesKey = String.fromEnvironment('GOOGLE_PLACES_KEY');

  /// Self-imposed monthly ceiling per Google SKU.
  ///
  /// Each Essentials SKU gets 10,000 free calls a month and they do NOT pool.
  /// The default leaves headroom because this counter is per install and cannot
  /// see the global total. The real limit is the daily quota cap in Cloud
  /// Console — see docs/GOOGLE-MAPS-SETUP.md.
  static const googleMapsMonthlyBudget =
      int.fromEnvironment('GOOGLE_MAPS_MONTHLY_BUDGET', defaultValue: 8500);

  // ── Control centre ───────────────────────────────────────────────────────
  // The number for people who would rather ring than tap. Stored in E.164 so it
  // can be used as a tel: URI directly.
  static const controlCentreTel =
      String.fromEnvironment('CONTROL_CENTRE_TEL', defaultValue: '+447833172989');
  static const controlCentreDisplay =
      String.fromEnvironment('CONTROL_CENTRE_DISPLAY', defaultValue: '+44 7833 172989');

  // ── Where the map opens ──────────────────────────────────────────────────
  // Charing Cross: the point all distances from London are officially measured
  // from. A starting view, not a boundary.
  static const defaultLat =
      double.fromEnvironment('DEFAULT_MAP_LAT', defaultValue: 51.5074);
  static const defaultLng =
      double.fromEnvironment('DEFAULT_MAP_LNG', defaultValue: -0.1278);

  static const currency = String.fromEnvironment('CURRENCY', defaultValue: 'GBP');
  static const locale = String.fromEnvironment('LOCALE', defaultValue: 'en_GB');

  /// True when Google address search is configured. Mirrors hasGooglePlaces()
  /// on the web, and drives the same fallback: without it the app still works,
  /// it just searches addresses less well.
  static bool get hasGooglePlaces => googlePlacesKey.isNotEmpty;

  /// Fail loudly at startup rather than quietly at the first request.
  ///
  /// A build without Supabase credentials launches, renders every screen, and
  /// then fails on sign-in with a network error that says nothing about the
  /// cause. That exact deploy has already shipped once on the web side. Better
  /// to refuse to start.
  static void assertConfigured() {
    final missing = <String>[
      if (supabaseUrl.isEmpty) 'SUPABASE_URL',
      if (supabaseAnonKey.isEmpty) 'SUPABASE_ANON_KEY',
    ];

    if (missing.isNotEmpty) {
      throw StateError(
        'AC7 cannot start: missing ${missing.join(', ')}.\n'
        'Run with --dart-define-from-file=env/dev.json — see mobile/README.md.',
      );
    }
  }
}
