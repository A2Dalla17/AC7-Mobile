/// AC7 — Material theme built from the tokens.
///
/// Every colour, radius and size here comes from tokens.dart. Nothing in a
/// widget should reach for a raw Color — if a value is missing, add it to the
/// tokens rather than inlining it, or the app and the website drift apart one
/// hex at a time.
library;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'tokens.dart';

abstract final class AppTheme {
  static ThemeData light() => _build(Brightness.light);
  static ThemeData dark() => _build(Brightness.dark);

  static ThemeData _build(Brightness brightness) {
    final isDark = brightness == Brightness.dark;

    final bg = isDark ? AC7Colors.bgDark : AC7Colors.bgLight;
    final surface = isDark ? AC7Colors.surfaceDark : AC7Colors.surfaceLight;
    final card = isDark ? AC7Colors.cardDark : AC7Colors.cardLight;
    final line = isDark ? AC7Colors.lineDark : AC7Colors.lineLight;
    final ink = isDark ? AC7Colors.inkDark : AC7Colors.inkLight;
    final inkMuted = isDark ? AC7Colors.inkMutedDark : AC7Colors.inkMutedLight;

    /// The brand split, applied. `primary` is the FILL — white sits on it.
    /// Text and icons use brandInk, which lifts in dark mode because the deep
    /// red measures 1.97:1 on near-black and is simply unreadable.
    final brandInk = isDark ? AC7Colors.brandInkDark : AC7Colors.brandInkLight;

    final scheme = ColorScheme(
      brightness: brightness,
      primary: AC7Colors.brand,
      onPrimary: Colors.white,
      primaryContainer: isDark ? AC7Colors.brandSoftDark : AC7Colors.brandSoftLight,
      onPrimaryContainer: brandInk,
      secondary: brandInk,
      onSecondary: Colors.white,
      surface: card,
      onSurface: ink,
      surfaceContainerHighest: surface,
      onSurfaceVariant: inkMuted,
      outline: line,
      error: AC7Colors.danger,
      onError: Colors.white,
    );

    final textTheme = _textTheme(ink, inkMuted);

    return ThemeData(
      useMaterial3: true,
      brightness: brightness,
      colorScheme: scheme,
      scaffoldBackgroundColor: bg,
      textTheme: textTheme,

      /// Ripples off, a scale press on.
      ///
      /// Material's ink splash is the single strongest tell that an app was
      /// built in Flutter rather than natively, and it looks wrong on iOS
      /// entirely. Buttons use a press scale instead, which reads correctly on
      /// both platforms.
      splashFactory: NoSplash.splashFactory,
      highlightColor: Colors.transparent,

      appBarTheme: AppBarTheme(
        backgroundColor: bg,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        scrolledUnderElevation: 0,
        centerTitle: false,
        titleTextStyle: textTheme.titleLarge,
        iconTheme: IconThemeData(color: ink),
        systemOverlayStyle:
            isDark ? SystemUiOverlayStyle.light : SystemUiOverlayStyle.dark,
      ),

      cardTheme: CardThemeData(
        color: card,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AC7Radius.card),
          side: BorderSide(color: line),
        ),
      ),

      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: AC7Colors.brand,
          foregroundColor: Colors.white,
          minimumSize: const Size.fromHeight(AC7Sizes.primaryAction),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AC7Radius.pill),
          ),
          textStyle: textTheme.labelLarge,
        ),
      ),

      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: brandInk,
          minimumSize: const Size.fromHeight(AC7Sizes.control),
          side: BorderSide(color: brandInk.withValues(alpha: 0.35)),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AC7Radius.pill),
          ),
        ),
      ),

      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: brandInk,
          /// Even a text button must clear the 44dp accessibility floor.
          minimumSize: const Size(AC7Sizes.touchMin, AC7Sizes.touchMin),
        ),
      ),

      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: surface,
        contentPadding: const EdgeInsets.symmetric(
          horizontal: AC7Spacing.lg,
          vertical: AC7Spacing.md,
        ),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AC7Radius.control),
          borderSide: BorderSide(color: line),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AC7Radius.control),
          borderSide: BorderSide(color: line),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AC7Radius.control),
          borderSide: BorderSide(color: brandInk, width: 1.5),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AC7Radius.control),
          borderSide: const BorderSide(color: AC7Colors.danger),
        ),
        hintStyle: textTheme.bodyMedium?.copyWith(
          color: isDark ? AC7Colors.inkSubtleDark : AC7Colors.inkSubtleLight,
        ),
      ),

      bottomSheetTheme: BottomSheetThemeData(
        backgroundColor: bg,
        surfaceTintColor: Colors.transparent,
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(
            top: Radius.circular(AC7Radius.sheet),
          ),
        ),
        showDragHandle: true,
        dragHandleColor: isDark ? AC7Colors.lineStrongDark : AC7Colors.lineStrongLight,
      ),

      /// Brand red, filled, white content — matching the web tab bar, which was
      /// changed to solid red precisely so the map could not show through it.
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: AC7Colors.brand,
        indicatorColor: Colors.white.withValues(alpha: 0.18),
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        height: AC7Spacing.tabBar - 16,
        labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
        iconTheme: WidgetStateProperty.resolveWith(
          (states) => IconThemeData(
            color: states.contains(WidgetState.selected)
                ? Colors.white
                : Colors.white.withValues(alpha: 0.65),
            size: 22,
          ),
        ),
        labelTextStyle: WidgetStateProperty.resolveWith(
          (states) => TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w600,
            color: states.contains(WidgetState.selected)
                ? Colors.white
                : Colors.white.withValues(alpha: 0.65),
          ),
        ),
      ),

      dividerTheme: DividerThemeData(color: line, thickness: 1, space: 1),

      pageTransitionsTheme: const PageTransitionsTheme(
        builders: {
          /// Cupertino on both platforms. The Android default slides upward,
          /// which reads as a modal; a horizontal push matches how riders
          /// expect to move forward and back through a booking.
          TargetPlatform.android: CupertinoPageTransitionsBuilder(),
          TargetPlatform.iOS: CupertinoPageTransitionsBuilder(),
        },
      ),
    );
  }

  /// Type scale.
  ///
  /// Tight letter spacing on the large sizes only. Headlines set at default
  /// tracking look loose and amateur; body text set tight becomes hard to read
  /// at a glance, which matters when someone is checking a fare in a hurry.
  static TextTheme _textTheme(Color ink, Color inkMuted) => TextTheme(
        displaySmall: TextStyle(
          fontSize: 32, height: 1.15, fontWeight: FontWeight.w700,
          letterSpacing: -0.6, color: ink,
        ),
        headlineMedium: TextStyle(
          fontSize: 26, height: 1.2, fontWeight: FontWeight.w700,
          letterSpacing: -0.4, color: ink,
        ),
        headlineSmall: TextStyle(
          fontSize: 21, height: 1.25, fontWeight: FontWeight.w700,
          letterSpacing: -0.3, color: ink,
        ),
        titleLarge: TextStyle(
          fontSize: 18, height: 1.3, fontWeight: FontWeight.w600, color: ink,
        ),
        titleMedium: TextStyle(
          fontSize: 16, height: 1.35, fontWeight: FontWeight.w600, color: ink,
        ),
        bodyLarge: TextStyle(fontSize: 16, height: 1.45, color: ink),
        bodyMedium: TextStyle(fontSize: 15, height: 1.45, color: ink),
        bodySmall: TextStyle(fontSize: 13.5, height: 1.4, color: inkMuted),
        labelLarge: const TextStyle(
          fontSize: 16, fontWeight: FontWeight.w600,
        ),
        labelSmall: TextStyle(
          fontSize: 11, fontWeight: FontWeight.w600, color: inkMuted,
        ),
      );
}
