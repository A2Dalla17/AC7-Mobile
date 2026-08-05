/// Galeyr — driver state.

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../auth/data/auth_providers.dart';
import '../domain/driver.dart';
import 'driver_repository.dart';

final driverRepositoryProvider = Provider<DriverRepository>((ref) => DriverRepository());

/// The signed-in user's driver record.
///
/// Depends on the auth provider rather than reading the session directly, so a
/// sign-out invalidates this automatically instead of leaving one driver's row
/// on screen while another signs in.
final driverProvider = FutureProvider<Driver?>((ref) async {
  final user = ref.watch(currentAppUserProvider);
  if (user == null) return null;
  return ref.watch(driverRepositoryProvider).forUser(user.id);
});

/// Today's earnings and trip count.
final todaySummaryProvider =
    FutureProvider<({double earnings, int trips})>((ref) async {
  final driver = await ref.watch(driverProvider.future);
  if (driver == null) return (earnings: 0.0, trips: 0);
  return ref.watch(driverRepositoryProvider).todaySummary(driver.id);
});

/// Jobs waiting for a driver.
///
/// Only polled while online. Polling offline would burn battery on a phone in
/// somebody's pocket to fetch jobs they cannot accept.
final availableRidesProvider =
    FutureProvider<List<Map<String, dynamic>>>((ref) async {
  final driver = await ref.watch(driverProvider.future);
  if (driver == null || !driver.isOnline) return [];
  return ref.watch(driverRepositoryProvider).availableRides();
});

/// Going online and offline.
///
/// A separate notifier rather than a method on the screen, because the toggle
/// is optimistic: the switch moves immediately and rolls back if the database
/// refuses. A driver at a junction cannot wait for a round trip to find out
/// whether they are working.
class OnlineController extends StateNotifier<AsyncValue<bool>> {
  OnlineController(this._ref) : super(const AsyncValue.data(false));

  final Ref _ref;

  Future<void> toggle(Driver driver) async {
    final target = !driver.isOnline;
    state = const AsyncValue.loading();

    try {
      await _ref.read(driverRepositoryProvider).setOnline(driver.id, online: target);
      /* Refetch rather than patching local state. The database applies its own
         rules on the way through - the approval gate can refuse an online
         request - so what it returns is the truth and what we hoped for is not. */
      _ref.invalidate(driverProvider);
      _ref.invalidate(availableRidesProvider);
      state = AsyncValue.data(target);
    } catch (e, st) {
      state = AsyncValue.error(_readable(e), st);
    }
  }

  /// Postgres errors are written for developers. A driver needs to know what to
  /// do about it, and "PostgrestException(code: P0001)" tells them nothing.
  String _readable(Object e) {
    final s = e.toString().toLowerCase();
    if (s.contains('approv')) {
      return 'Your account is not approved yet. Ring the control room.';
    }
    if (s.contains('suspend')) {
      return 'Your account is suspended. Ring the control room.';
    }
    if (s.contains('socket') || s.contains('network') || s.contains('failed host')) {
      return 'No connection. Check your signal and try again.';
    }
    return 'Could not change your status. Try again.';
  }
}

final onlineControllerProvider =
    StateNotifierProvider<OnlineController, AsyncValue<bool>>(
  (ref) => OnlineController(ref),
);
