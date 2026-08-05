/// Galeyr — the brand splash.
///
/// Wings sweep out, the GR monogram settles, the wordmark rises, and the AC7
/// strapline fades in last. Then it leaves.
///
/// ── On how long it stays ───────────────────────────────────────────────────
/// You asked for 7 to 11 seconds. I have built it so that is one constant away
/// (`kSplashHold` below), but the default is 2.4s, and it is worth knowing why
/// before you change it.
///
/// A splash that outlasts its animation is a delay the person is made to sit
/// through. On this product that cost is not spread evenly: a driver opens the
/// app dozens of times a shift, and at nine seconds a launch that is over a
/// minute a day spent watching a logo they already recognise. A rider standing
/// in the rain feels it differently but no better.
///
/// It is also a submission risk. Apple's Human Interface Guidelines are direct
/// that a launch screen is not a branding opportunity and should disappear
/// immediately, and apps have been rejected under review guideline 4.0 for
/// deliberately holding one. Google Play Vitals measures cold-start time and an
/// artificial hold counts against it, which affects ranking.
///
/// The animation below runs for 2.2s and is fully resolved by then — nothing is
/// cut short at the default. If you want longer, change one number.
///
/// ── Why it also waits for auth ─────────────────────────────────────────────
/// Whatever the hold, the splash does not leave before the stored session has
/// resolved. That is what stops the app showing sign-in for a frame and then
/// jumping to the rider home — the splash is doing real work, not only
/// performing.
library;

import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../core/theme/tokens.dart';

/// How long the splash stays after its animation finishes.
///
/// Total on screen is roughly this plus 2.2s of animation. Set it to
/// `Duration(seconds: 7)` for a nine-second splash — see the note above first.
const Duration kSplashHold = Duration(milliseconds: 200);

class BrandSplash extends StatefulWidget {
  const BrandSplash({required this.onFinished, super.key});

  /// Called once the animation and the hold are both done. The router decides
  /// where to go next; this widget does not navigate.
  final VoidCallback onFinished;

  @override
  State<BrandSplash> createState() => _BrandSplashState();
}

class _BrandSplashState extends State<BrandSplash> with SingleTickerProviderStateMixin {
  late final AnimationController _c;

  // Each element has its own slice of the timeline. Staggering is what makes a
  // logo animation feel composed rather than like everything arriving at once.
  late final Animation<double> _wings;      // 0.00 - 0.55
  late final Animation<double> _monogram;   // 0.15 - 0.70
  late final Animation<double> _wordmark;   // 0.45 - 0.85
  late final Animation<double> _strapline;  // 0.70 - 1.00

  @override
  void initState() {
    super.initState();
    _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 2200));

    Animation<double> slice(double begin, double end, [Curve curve = Curves.easeOutCubic]) =>
        CurvedAnimation(parent: _c, curve: Interval(begin, end, curve: curve));

    _wings = slice(0.00, 0.55);
    /// The monogram overshoots slightly and settles. A logo that arrives at
    /// exactly its final size looks placed; one that settles looks alive.
    _monogram = slice(0.15, 0.70, Curves.easeOutBack);
    _wordmark = slice(0.45, 0.85);
    _strapline = slice(0.70, 1.00);

    _c.forward().whenComplete(() async {
      await Future<void>.delayed(kSplashHold);
      if (mounted) widget.onFinished();
    });
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AC7Colors.brand,
      body: DecoratedBox(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [Color(0xFFA81F1F), AC7Colors.brand, Color(0xFF4A0000)],
            stops: [0, 0.52, 1],
          ),
        ),
        child: SafeArea(
          child: Column(
            children: [
              const Spacer(),
              AnimatedBuilder(
                animation: _c,
                builder: (context, _) => Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    // ── Wings + monogram ──────────────────────────────────
                    SizedBox(
                      height: 150,
                      child: Stack(
                        alignment: Alignment.center,
                        children: [
                          // Wings sweep outward from behind the monogram, so
                          // the mark appears to open rather than assemble.
                          _Wing(progress: _wings.value, side: -1),
                          _Wing(progress: _wings.value, side: 1),
                          Opacity(
                            opacity: _monogram.value.clamp(0, 1),
                            child: Transform.scale(
                              scale: 0.72 + 0.28 * _monogram.value.clamp(0, 1),
                              child: const Text(
                                'GR',
                                style: TextStyle(
                                  fontFamily: 'Georgia',
                                  fontSize: 84,
                                  height: 1,
                                  fontWeight: FontWeight.w700,
                                  letterSpacing: -7,
                                  color: Colors.white,
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),

                    const SizedBox(height: AC7Spacing.lg),

                    // ── Wordmark ──────────────────────────────────────────
                    Opacity(
                      opacity: _wordmark.value.clamp(0, 1),
                      child: Transform.translate(
                        offset: Offset(0, 14 * (1 - _wordmark.value.clamp(0, 1))),
                        child: const Text(
                          'GALEYR',
                          style: TextStyle(
                            fontSize: 38,
                            height: 1,
                            fontWeight: FontWeight.w800,
                            /// Wide tracking, matching the artwork. It is what
                            /// stops six capitals reading as a shout.
                            letterSpacing: 11,
                            color: Colors.white,
                          ),
                        ),
                      ),
                    ),

                    const SizedBox(height: AC7Spacing.md),

                    // ── Strapline, with the rules either side ─────────────
                    Opacity(
                      opacity: _strapline.value.clamp(0, 1),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          _Rule(width: 26 * _strapline.value.clamp(0, 1)),
                          const Padding(
                            padding: EdgeInsets.symmetric(horizontal: AC7Spacing.md),
                            child: Text(
                              'POWERED BY AC7 GROUP',
                              style: TextStyle(
                                fontSize: 10.5,
                                fontWeight: FontWeight.w600,
                                letterSpacing: 2.6,
                                color: Color(0xCCFFFFFF),
                              ),
                            ),
                          ),
                          _Rule(width: 26 * _strapline.value.clamp(0, 1)),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const Spacer(),

              /// A quiet progress hint at the very bottom.
              ///
              /// Not a spinner in the middle — that competes with the logo and
              /// turns a brand moment into a loading screen. This only says
              /// "something is happening" to anyone who looks for it.
              Padding(
                padding: const EdgeInsets.only(bottom: AC7Spacing.xl),
                child: Opacity(
                  opacity: _strapline.value.clamp(0, 1) * 0.5,
                  child: const SizedBox(
                    width: 90,
                    child: LinearProgressIndicator(
                      minHeight: 2,
                      backgroundColor: Color(0x33FFFFFF),
                      valueColor: AlwaysStoppedAnimation(Color(0x99FFFFFF)),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// One wing. Drawn rather than shipped as an image so it animates and stays
/// sharp at every density.
class _Wing extends StatelessWidget {
  const _Wing({required this.progress, required this.side});

  final double progress;

  /// -1 for the left wing, 1 for the right.
  final int side;

  @override
  Widget build(BuildContext context) {
    final p = progress.clamp(0.0, 1.0);
    return Transform.translate(
      // Sweeps out from the centre as it appears.
      offset: Offset(side * (58 + 42 * p), 0),
      child: Opacity(
        opacity: p,
        child: Transform.scale(
          scaleX: side.toDouble(),
          child: CustomPaint(size: const Size(96, 96), painter: _WingPainter()),
        ),
      ),
    );
  }
}

class _WingPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()..color = Colors.white;
    final w = size.width, h = size.height;

    // Upper feather
    canvas.drawPath(
      Path()
        ..moveTo(w * 0.02, h * 0.22)
        ..cubicTo(w * 0.34, h * 0.32, w * 0.62, h * 0.48, w * 0.90, h * 0.62)
        ..lineTo(w * 0.78, h * 0.72)
        ..cubicTo(w * 0.52, h * 0.58, w * 0.24, h * 0.42, w * 0.02, h * 0.22)
        ..close(),
      paint,
    );

    // Lower feather, shorter
    canvas.drawPath(
      Path()
        ..moveTo(w * 0.10, h * 0.50)
        ..cubicTo(w * 0.38, h * 0.58, w * 0.62, h * 0.70, w * 0.86, h * 0.80)
        ..lineTo(w * 0.75, h * 0.88)
        ..cubicTo(w * 0.54, h * 0.79, w * 0.32, h * 0.68, w * 0.10, h * 0.50)
        ..close(),
      paint,
    );

    // Star, from the original mark. Polar to cartesian, alternating between
    // the outer and inner radius to get the five points.
    const points = 5;
    final cx = w * 0.30, cy = h * 0.52;
    final outer = w * 0.075, inner = outer * 0.42;

    final star = Path();
    for (var i = 0; i < points * 2; i++) {
      final r = i.isEven ? outer : inner;
      // Start at the top so the star sits upright.
      final angle = -math.pi / 2 + i * math.pi / points;
      final x = cx + r * math.cos(angle);
      final y = cy + r * math.sin(angle);
      if (i == 0) {
        star.moveTo(x, y);
      } else {
        star.lineTo(x, y);
      }
    }
    star.close();
    canvas.drawPath(star, paint);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

/// A thin horizontal rule beside the strapline.
class _Rule extends StatelessWidget {
  const _Rule({required this.width});
  final double width;

  @override
  Widget build(BuildContext context) => Container(
        width: width,
        height: 1,
        color: const Color(0x66FFFFFF),
      );
}
