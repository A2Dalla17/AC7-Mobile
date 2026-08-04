/// AC7 — design tokens
///
/// Ported directly from packages/shared/tailwind.preset.js so the app and the
/// website are visibly the same product. When a token changes in one, change it
/// in the other; there is no build step that can keep them in sync, so the only
/// thing keeping them honest is that both files say so.
///
/// ── On the brand red ────────────────────────────────────────────────────────
/// The brand is #8B0000. It measures 10.0:1 against white, which is excellent,
/// and 1.97:1 against near-black, which is unreadable. So this splits what most
/// palettes conflate:
///
///   brand      the FILL. White text sits on it. Deep in both themes.
///   brandInk   brand-coloured TEXT and ICONS. Lifts in dark mode so links and
///              active tabs stay legible.
///   brandSoft  the wash behind selected rows and icon chips.
///
/// Using `brand` for text on a dark surface is the one mistake this split
/// exists to prevent.
library;

import 'package:flutter/material.dart';

abstract final class AC7Colors {
  // ── Brand ────────────────────────────────────────────────────────────────
  static const brand = Color(0xFF8B0000);
  static const brandHover = Color(0xFFA50C0C);
  static const brandPressed = Color(0xFF5E0000);

  /// Brand text/icons on a light surface.
  static const brandInkLight = Color(0xFF8B0000);

  /// Brand text/icons on a dark surface. Lifted to #E5484D, which measures
  /// 5.03:1 on #0B0B0B — the deep red does not pass at any size.
  static const brandInkDark = Color(0xFFE5484D);

  static const brandSoftLight = Color(0xFFFADEDE);
  static const brandSoftDark = Color(0xFF2B1416);

  /// Fixed ramp, for charts and gradients. Not theme-aware on purpose.
  static const brand50 = Color(0xFFFDF2F2);
  static const brand100 = Color(0xFFFADEDE);
  static const brand700 = Color(0xFF5E0000);
  static const brand900 = Color(0xFF2B0000);

  // ── Light surfaces ───────────────────────────────────────────────────────
  static const bgLight = Color(0xFFFFFFFF);
  static const surfaceLight = Color(0xFFF6F6F7);
  static const cardLight = Color(0xFFFFFFFF);
  static const lineLight = Color(0xFFE6E6E8);
  static const lineStrongLight = Color(0xFFD2D2D6);

  static const inkLight = Color(0xFF141416);
  static const inkMutedLight = Color(0xFF5C5C66);
  static const inkSubtleLight = Color(0xFF8E8E98);

  // ── Dark surfaces ────────────────────────────────────────────────────────
  // Stepped rather than flat, so a card reads as raised without a border.
  static const bgDark = Color(0xFF0B0B0B);
  static const surfaceDark = Color(0xFF121212);
  static const cardDark = Color(0xFF1A1A1A);
  static const lineDark = Color(0xFF262626);
  static const lineStrongDark = Color(0xFF383838);

  static const inkDark = Color(0xFFF4F4F5);
  static const inkMutedDark = Color(0xFFA1A1AA);
  static const inkSubtleDark = Color(0xFF71717A);

  // ── Status ───────────────────────────────────────────────────────────────
  static const success = Color(0xFF1B873F);
  static const warning = Color(0xFFB35309);
  static const danger = Color(0xFFCD2B31);
  static const accent = Color(0xFF1B873F);
}

/// Spacing, in logical pixels.
///
/// The scale is deliberately short. A long scale means every developer picks a
/// slightly different value and the interface drifts; six steps means the
/// choice is obvious and layouts line up by default.
abstract final class AC7Spacing {
  static const xs = 4.0;
  static const sm = 8.0;
  static const md = 12.0;
  static const lg = 16.0;
  static const xl = 24.0;
  static const xxl = 32.0;

  /// The standard screen inset. Matches `px-gutter` on the web.
  static const gutter = 20.0;

  /// Height the bottom navigation occupies, so content can clear it.
  static const tabBar = 96.0;
}

abstract final class AC7Radius {
  static const control = 12.0;
  static const tile = 14.0;
  static const card = 18.0;
  static const sheet = 28.0;
  static const pill = 999.0;
}

/// Minimum touch targets.
///
/// 44dp is the accessibility floor and is not negotiable — below it, people
/// with reduced dexterity simply cannot use the control. 56 is the primary
/// action height, and 52 sits between them for text fields so an input never
/// visually outweighs the button beside it.
abstract final class AC7Sizes {
  static const touchMin = 44.0;
  static const controlSm = 40.0;
  static const controlMd = 44.0;
  static const control = 48.0;
  static const field = 52.0;
  static const primaryAction = 56.0;
}

/// Motion.
///
/// One easing curve for the whole app. Mixing curves is what makes an interface
/// feel assembled from parts rather than designed.
abstract final class AC7Motion {
  static const fast = Duration(milliseconds: 150);
  static const normal = Duration(milliseconds: 250);
  static const slow = Duration(milliseconds: 350);

  /// Matches the web's `--ease`: cubic-bezier(0.32, 0.72, 0, 1).
  static const ease = Cubic(0.32, 0.72, 0, 1);
}
