/// Galeyr — driver data.
///
/// Reads and writes `public.drivers`. Nothing here creates or alters a table:
/// this is the same row the website and the control centre already work with.
library;

import '../../../core/supabase/supabase_client.dart';
import '../domain/driver.dart';

class DriverRepository {
  /// The driver record for the signed-in user.
  ///
  /// Looked up by `user_id`, which is the profile id from `public.users` — not
  /// the Supabase Auth id. Getting those two confused returns an empty result
  /// rather than an error, which reads exactly like "you are not a driver".
  Future<Driver?> forUser(String userId) async {
    final row = await supabase
        .from('drivers')
        .select()
        .eq('user_id', userId)
        .maybeSingle();

    return row == null ? null : Driver.fromMap(row);
  }

  /// Go online, or go offline.
  ///
  /// ── Why this does not silently fail ───────────────────────────────────────
  /// An approval gate on the table rejects going ONLINE while an application is
  /// unapproved or suspended. Going OFFLINE is always allowed — a suspended
  /// driver who could not go offline would sit in the dispatch pool, which is
  /// the exact bug the web version had.
  ///
  /// Postgres errors are surfaced rather than swallowed. A toggle that appears
  /// to work and does not is worse than one that says why: a driver would sit
  /// waiting for jobs the dispatcher was never sending.
  Future<Driver> setOnline(String driverId, {required bool online}) async {
    final row = await supabase
        .from('drivers')
        .update({
          'is_online': online,
          /* Going offline must also clear availability. Leaving is_available
             true on an offline driver is how a job gets offered to someone who
             has finished for the night. */
          'is_available': online,
          'presence': online ? 'available' : 'offline',
          'presence_updated_at': DateTime.now().toUtc().toIso8601String(),
        })
        .eq('id', driverId)
        .select()
        .single();

    return Driver.fromMap(row);
  }

  /// Today's earnings and completed trips.
  ///
  /// Counted from midnight in the driver's own day rather than a rolling 24
  /// hours: a driver checks "what have I made today", and a figure that
  /// silently drops trips from this morning as the day goes on destroys trust
  /// in every other number on the screen.
  Future<({double earnings, int trips})> todaySummary(String driverId) async {
    final startOfDay = DateTime.now();
    final midnight = DateTime(startOfDay.year, startOfDay.month, startOfDay.day);

    final rows = await supabase
        .from('rides')
        .select('final_fare, estimated_fare, status, completed_at')
        .eq('driver_id', driverId)
        .eq('status', 'completed')
        .gte('completed_at', midnight.toUtc().toIso8601String());

    var earnings = 0.0;
    for (final r in rows as List) {
      final m = r as Map<String, dynamic>;
      /* final_fare is what was actually charged; estimated_fare is the quote.
         Falling back to the quote keeps the figure roughly right on a trip
         that has not been reconciled yet, rather than counting it as zero. */
      final fare = (m['final_fare'] as num?) ?? (m['estimated_fare'] as num?) ?? 0;
      earnings += fare.toDouble();
    }

    return (earnings: earnings, trips: (rows as List).length);
  }

  /// Jobs waiting to be accepted.
  Future<List<Map<String, dynamic>>> availableRides() async {
    final rows = await supabase
        .from('rides')
        .select()
        .eq('status', 'requested')
        .isFilter('driver_id', null)
        .order('created_at', ascending: true)
        .limit(5);

    return (rows as List).cast<Map<String, dynamic>>();
  }
}
