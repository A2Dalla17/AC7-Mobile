/// AC7 Taxi — entry point.
///
/// Deliberately thin: initialise, then hand over. Anything that can fail lives
/// in a function that says why it failed, because a crash before the first
/// frame gives the user a blank screen and gives you nothing to debug.

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'app.dart';
import 'core/supabase/supabase_client.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  /// Portrait only.
  ///
  /// Every screen in this product is a phone screen used one-handed, often
  /// while standing. Landscape would need a second layout for each and buys a
  /// rider nothing.
  await SystemChrome.setPreferredOrientations([
    DeviceOrientation.portraitUp,
    DeviceOrientation.portraitDown,
  ]);

  await initSupabase();

  runApp(const ProviderScope(child: AC7App()));
}
