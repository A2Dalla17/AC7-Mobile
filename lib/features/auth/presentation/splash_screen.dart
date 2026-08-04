/// Shown only while the stored session is being resolved.
///
/// Not a branded loading screen with a timer — it disappears the moment auth
/// resolves, usually in well under a second. Anything more elaborate would be
/// a delay added for its own sake.

import 'package:flutter/material.dart';

import '../../../core/theme/tokens.dart';

class SplashScreen extends StatelessWidget {
  const SplashScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      body: Center(
        child: SizedBox(
          height: 28,
          width: 28,
          child: CircularProgressIndicator(
            strokeWidth: 2.5,
            color: AC7Colors.brand,
          ),
        ),
      ),
    );
  }
}
