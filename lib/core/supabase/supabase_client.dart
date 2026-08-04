/// AC7 — Supabase
///
/// The same project, tables, RLS policies and RPCs the web app uses. Nothing
/// here creates or migrates anything: this is a second client onto a backend
/// that already exists and is already in production.
///
/// That is the whole reason the migration is affordable. The expensive,
/// dangerous part of a rewrite is the data layer and its security rules, and
/// none of that is being rewritten — `users`, `drivers`, `rides`,
/// `driver_compliance`, the advert tables, the feature flags, and every policy
/// guarding them stay exactly as they are.
library;

import 'package:supabase_flutter/supabase_flutter.dart';

import '../config/env.dart';

/// Initialise Supabase. Call once, before runApp.
Future<void> initSupabase() async {
  Env.assertConfigured();

  await Supabase.initialize(
    url: Env.supabaseUrl,
    anonKey: Env.supabaseAnonKey,
    authOptions: const FlutterAuthClientOptions(
      /// Sessions persist in secure storage between launches.
      ///
      /// A minicab app that signs the rider out every time iOS reclaims memory
      /// is a minicab app nobody uses. This is also why the router waits for
      /// the session to resolve before deciding where to send anyone.
      autoRefreshToken: true,
    ),
    realtimeClientOptions: const RealtimeClientOptions(
      /// Driver positions arrive continuously during a trip. Ten events a
      /// second is more than the map can usefully draw, and on a phone the
      /// difference is battery rather than smoothness.
      eventsPerSecond: 10,
    ),
  );
}

/// Shorthand used across the app.
SupabaseClient get supabase => Supabase.instance.client;

/// The signed-in user, or null.
User? get currentUser => supabase.auth.currentUser;

/// Stream of authentication changes — what the router listens to so a sign-out
/// on one screen redirects every other.
Stream<AuthState> get authChanges => supabase.auth.onAuthStateChange;
