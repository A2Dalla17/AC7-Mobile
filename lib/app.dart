/// AC7 Taxi — the application shell.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'core/router/app_router.dart';
import 'core/theme/app_theme.dart';

class AC7App extends ConsumerWidget {
  const AC7App({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(routerProvider);

    return MaterialApp.router(
      title: 'AC7 Taxi',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light(),
      darkTheme: AppTheme.dark(),

      /// Follows the phone.
      ///
      /// A taxi app is used at night more than most, and overriding the
      /// system choice is how you blind somebody at 2am. The in-app override
      /// lives in Settings, where a person can find it deliberately.
      themeMode: ThemeMode.system,

      routerConfig: router,

      /// Cap text scaling.
      ///
      /// Accessibility settings can push text to 3x, which breaks fare
      /// figures out of their cards and hides the Book button below the fold.
      /// 1.3 is generous and still laid out correctly; refusing to scale at
      /// all would be worse.
      builder: (context, child) {
        final scale = MediaQuery.textScalerOf(context).clamp(
          minScaleFactor: 1.0,
          maxScaleFactor: 1.3,
        );
        return MediaQuery(
          data: MediaQuery.of(context).copyWith(textScaler: scale),
          child: child ?? const SizedBox.shrink(),
        );
      },
    );
  }
}
