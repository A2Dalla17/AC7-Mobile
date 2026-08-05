/// AC7 — navigation
///
/// Routes mirror the web app's, so a deep link works the same in both and a
/// support conversation can name a screen without asking which one you are on.
///
/// ── Why redirect and not a widget guard ────────────────────────────────────
/// GoRouter's redirect runs before anything builds, so a signed-out user never
/// gets a frame of the rider home before being bounced. Guarding inside the
/// widget means building the protected screen first and hiding it, which
/// flickers and, worse, fires whatever data fetches that screen starts.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../features/auth/data/auth_providers.dart';
import '../../features/auth/domain/app_user.dart';
import '../../features/auth/presentation/login_screen.dart';
import '../../features/auth/presentation/register_screen.dart';
import '../../features/auth/presentation/forgot_password_screen.dart';
import '../../features/driver/presentation/driver_dashboard.dart';
import '../../features/splash/presentation/brand_splash.dart';
import '../widgets/placeholder_screen.dart';

abstract final class Routes {
  static const splash = '/';
  static const login = '/login';
  static const register = '/register';
  static const forgotPassword = '/forgot-password';
  static const onboarding = '/onboarding';
  static const rider = '/rider';
  static const driver = '/driver';
  static const admin = '/admin';
}

/// Where each role belongs after signing in.
String homeFor(UserRole role) => switch (role) {
      UserRole.rider => Routes.rider,
      UserRole.driver => Routes.driver,
      UserRole.admin => Routes.admin,
    };

final routerProvider = Provider<GoRouter>((ref) {
  /* Rebuilding the router on every auth change would lose the navigation
     stack. Instead the router is built once and told to re-evaluate its
     redirect when auth changes. */
  final notifier = ValueNotifier<AuthState>(const AuthLoading());
  ref.listen(authControllerProvider, (_, next) => notifier.value = next);
  ref.onDispose(notifier.dispose);

  return GoRouter(
    initialLocation: Routes.splash,
    refreshListenable: notifier,
    redirect: (context, state) {
      final auth = ref.read(authControllerProvider);
      final path = state.matchedLocation;

      final onAuthScreen = path == Routes.login ||
          path == Routes.register ||
          path == Routes.forgotPassword;

      /* Still restoring the session: hold on the splash and decide nothing.
         Sending someone to sign-in here is the flash-of-login-screen bug. */
      if (auth is AuthLoading) {
        return path == Routes.splash ? null : Routes.splash;
      }

      /// Auth has resolved but the splash is still playing: let it finish.
      /// Redirecting here would cut the animation off mid-way, which looks
      /// like a glitch rather than a brand moment.
      if (path == Routes.splash) return null;

      if (auth is AuthSignedOut) {
        return onAuthScreen ? null : Routes.login;
      }

      if (auth is AuthSignedIn) {
        final home = homeFor(auth.user.role);

        /* Signed in but sitting on splash or an auth screen — go home. */
        if (path == Routes.splash || onAuthScreen) return home;

        /* Riders who have not finished setting up are sent to onboarding, but
           only from their own section: a driver or admin has no onboarding
           step, and bouncing them there would strand them. */
        if (auth.user.role == UserRole.rider &&
            auth.user.needsOnboarding &&
            path.startsWith(Routes.rider)) {
          return Routes.onboarding;
        }

        /* Role boundaries. A rider who deep-links into /admin is redirected
           home rather than shown a screen that would fail on RLS anyway —
           the database is the real guard; this is only about not showing
           somebody a broken page. */
        if (path.startsWith(Routes.admin) && auth.user.role != UserRole.admin) {
          return home;
        }
        if (path.startsWith(Routes.driver) &&
            auth.user.role == UserRole.rider) {
          return home;
        }
      }

      return null;
    },
    routes: [
      /// The brand splash. It calls back when its animation is done; the
      /// redirect above then sends the user wherever they belong, which by
      /// that point auth has had time to resolve.
      GoRoute(
        path: Routes.splash,
        builder: (context, state) => BrandSplash(
          onFinished: () {
            final auth = ref.read(authControllerProvider);
            if (auth is AuthSignedIn) {
              context.go(homeFor(auth.user.role));
            } else if (auth is AuthSignedOut) {
              context.go(Routes.login);
            }
            /// Still AuthLoading: do nothing. The refreshListenable fires the
            /// redirect the moment the session resolves, so staying put is
            /// correct rather than guessing and bouncing the user twice.
          },
        ),
      ),
      GoRoute(path: Routes.login, builder: (_, __) => const LoginScreen()),
      GoRoute(path: Routes.register, builder: (_, __) => const RegisterScreen()),
      GoRoute(
        path: Routes.forgotPassword,
        builder: (_, __) => const ForgotPasswordScreen(),
      ),

      /* Phase 2 replaces these. Named placeholders rather than a single
         "coming soon" screen, so it is obvious which module is missing when
         you land on one during testing. */
      GoRoute(
        path: Routes.onboarding,
        builder: (_, __) => const PlaceholderScreen(
          title: 'Finish setting up',
          detail: 'Phone number and messaging consent — Phase 2.',
        ),
      ),
      GoRoute(
        path: Routes.rider,
        builder: (_, __) => const PlaceholderScreen(
          title: 'Rider',
          detail: 'Map, booking and trips — Phase 2 and 3.',
          showSignOut: true,
        ),
      ),
      GoRoute(path: Routes.driver, builder: (_, __) => const DriverDashboard()),
      GoRoute(
        path: Routes.admin,
        builder: (_, __) => const PlaceholderScreen(
          title: 'Control centre',
          detail: 'Users, drivers and compliance — Phase 2.',
          showSignOut: true,
        ),
      ),
    ],
  );
});
