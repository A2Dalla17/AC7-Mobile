/// AC7 — authentication
///
/// Wraps Supabase Auth and the `public.users` profile that sits beside it.
/// Behaviour is deliberately identical to the web client, because the same
/// accounts sign in to both and a rule enforced in one place and not the other
/// is a bug waiting for whichever user picks the wrong app.
library;

import 'package:supabase_flutter/supabase_flutter.dart';

import '../../../core/supabase/supabase_client.dart';
import '../domain/app_user.dart';

/// A failure worth showing a person.
///
/// Supabase's own messages are written for developers — "Invalid login
/// credentials", "AuthApiError" — and putting those in front of a rider at a
/// bus stop at midnight helps nobody.
class AuthFailure implements Exception {
  const AuthFailure(this.message);
  final String message;

  @override
  String toString() => message;
}

class AuthRepository {
  /// Sign in with email and password.
  Future<AppUser> signIn({required String email, required String password}) async {
    try {
      final response = await supabase.auth.signInWithPassword(
        email: email.trim(),
        password: password,
      );

      if (response.user == null) {
        throw const AuthFailure('Could not sign you in. Please try again.');
      }

      final profile = await fetchProfile(response.user!.id);
      if (profile == null) {
        /* Authenticated but no profile row. The signup trigger should make
           this impossible; if it happens the account is unusable, and leaving
           the session active would strand them on a broken screen with no way
           back. */
        await supabase.auth.signOut();
        throw const AuthFailure(
          'Your account is not set up correctly. Please contact the control room.',
        );
      }

      if (!profile.isActive) {
        await supabase.auth.signOut();
        throw const AuthFailure(
          'This account has been suspended. Please contact the control room.',
        );
      }

      return profile;
    } on AuthException catch (e) {
      throw AuthFailure(_friendly(e.message));
    }
  }

  /// Create an account.
  ///
  /// The profile row is NOT written here. A database trigger creates it from
  /// the metadata below, which is what keeps the web and the app producing
  /// identical records — two clients each inserting their own version is how
  /// the columns drift apart.
  Future<AppUser?> register({
    required String email,
    required String password,
    required String firstName,
    required String lastName,
    String? phoneNumber,
    UserRole role = UserRole.rider,
  }) async {
    try {
      final response = await supabase.auth.signUp(
        email: email.trim(),
        password: password,
        data: {
          'first_name': firstName.trim(),
          'last_name': lastName.trim(),
          'phone_number': phoneNumber?.trim(),
          'role': role.wire,
        },
      );

      final user = response.user;
      if (user == null) return null;

      /* With email confirmation switched on there is no session yet, so there
         is nothing to fetch and nothing has gone wrong. Returning null lets the
         screen say "check your email" rather than showing a failure. */
      if (response.session == null) return null;

      return fetchProfile(user.id);
    } on AuthException catch (e) {
      throw AuthFailure(_friendly(e.message));
    }
  }

  Future<void> signOut() => supabase.auth.signOut();

  Future<void> sendPasswordReset(String email) async {
    try {
      await supabase.auth.resetPasswordForEmail(email.trim());
    } on AuthException catch (e) {
      throw AuthFailure(_friendly(e.message));
    }
  }

  /// Load the profile for a Supabase Auth user id.
  ///
  /// Queried by `auth_id`, not `id` — see the note in AppUser. Using the wrong
  /// one returns nothing rather than erroring, which reads exactly like a
  /// missing account.
  Future<AppUser?> fetchProfile(String authUserId) async {
    final row = await supabase
        .from('users')
        .select()
        .eq('auth_id', authUserId)
        .maybeSingle();

    return row == null ? null : AppUser.fromMap(row);
  }

  /// The profile for whoever is signed in now, or null.
  Future<AppUser?> currentProfile() async {
    final user = currentUser;
    return user == null ? null : fetchProfile(user.id);
  }

  /// Turn a Supabase error into something worth reading.
  ///
  /// Deliberately does NOT distinguish "no such account" from "wrong password".
  /// Telling an attacker which emails are registered is a free list of valid
  /// accounts, and the rider does not benefit from the difference either.
  String _friendly(String raw) {
    final message = raw.toLowerCase();

    if (message.contains('invalid login credentials')) {
      return 'That email and password do not match.';
    }
    if (message.contains('email not confirmed')) {
      return 'Please confirm your email address first — check your inbox.';
    }
    if (message.contains('user already registered') ||
        message.contains('already been registered')) {
      return 'An account with that email already exists. Try signing in.';
    }
    if (message.contains('password should be at least')) {
      return 'Your password needs to be at least 6 characters.';
    }
    if (message.contains('rate limit') || message.contains('too many')) {
      return 'Too many attempts. Please wait a minute and try again.';
    }
    if (message.contains('network') || message.contains('socket')) {
      return 'No connection. Check your signal and try again.';
    }
    return 'Something went wrong. Please try again.';
  }
}
