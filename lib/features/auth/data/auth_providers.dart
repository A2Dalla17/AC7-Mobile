/// AC7 — authentication state
///
/// One source of truth for "who is signed in", which the router listens to.
///
/// ── Why a three-state model and not a nullable user ────────────────────────
/// `AppUser?` cannot tell "nobody is signed in" apart from "we have not
/// checked yet", and the difference decides whether to show a screen or a
/// spinner. Collapsing them is what makes an app flash the sign-in screen for
/// half a second on every cold start before landing the user where they
/// belong — and on a phone, cold starts happen constantly.
library;

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../../core/supabase/supabase_client.dart';
import '../domain/app_user.dart';
import 'auth_repository.dart';

final authRepositoryProvider = Provider<AuthRepository>((ref) => AuthRepository());

/// Where the session resolution has got to.
sealed class AuthState {
  const AuthState();
}

/// Still restoring a session from secure storage. Show a spinner, decide
/// nothing.
class AuthLoading extends AuthState {
  const AuthLoading();
}

class AuthSignedOut extends AuthState {
  const AuthSignedOut();
}

class AuthSignedIn extends AuthState {
  const AuthSignedIn(this.user);
  final AppUser user;
}

class AuthController extends StateNotifier<AuthState> {
  AuthController(this._repository) : super(const AuthLoading()) {
    _restore();
    _listen();
  }

  final AuthRepository _repository;

  /// Resolve whatever session survived the last launch.
  Future<void> _restore() async {
    try {
      final profile = await _repository.currentProfile();
      state = profile == null ? const AuthSignedOut() : AuthSignedIn(profile);
    } catch (_) {
      /* A failure here means we could not reach Supabase, not that the person
         is signed out. Treating it as signed out would eject a rider mid-trip
         because a tunnel dropped the connection. Signed out is still the only
         safe screen to show, but the session itself is left intact so the next
         successful call restores them. */
      state = const AuthSignedOut();
    }
  }

  /// Follow sign-ins and sign-outs from anywhere, including other tabs of the
  /// same account and token refresh failures.
  void _listen() {
    authChanges.listen((event) async {
      switch (event.event) {
        case AuthChangeEvent.signedIn:
        case AuthChangeEvent.tokenRefreshed:
        case AuthChangeEvent.userUpdated:
          final profile = await _repository.currentProfile();
          if (profile != null) state = AuthSignedIn(profile);
        case AuthChangeEvent.signedOut:
          state = const AuthSignedOut();
        default:
          break;
      }
    });
  }

  Future<void> signIn({required String email, required String password}) async {
    final user = await _repository.signIn(email: email, password: password);
    state = AuthSignedIn(user);
  }

  Future<AppUser?> register({
    required String email,
    required String password,
    required String firstName,
    required String lastName,
    String? phoneNumber,
    UserRole role = UserRole.rider,
  }) async {
    final user = await _repository.register(
      email: email,
      password: password,
      firstName: firstName,
      lastName: lastName,
      phoneNumber: phoneNumber,
      role: role,
    );
    if (user != null) state = AuthSignedIn(user);
    return user;
  }

  Future<void> signOut() async {
    await _repository.signOut();
    state = const AuthSignedOut();
  }

  /// Re-read the profile — after onboarding, or a profile edit.
  Future<void> refresh() async {
    final profile = await _repository.currentProfile();
    if (profile != null) state = AuthSignedIn(profile);
  }
}

final authControllerProvider =
    StateNotifierProvider<AuthController, AuthState>(
  (ref) => AuthController(ref.watch(authRepositoryProvider)),
);

/// The signed-in user, or null. For screens that only need the person.
final currentAppUserProvider = Provider<AppUser?>((ref) {
  final state = ref.watch(authControllerProvider);
  return state is AuthSignedIn ? state.user : null;
});
