/// Galeyr — driver dashboard.
///
/// The screen a driver looks at between jobs: am I online, what have I made
/// today, and is there work waiting.
///
/// ── Designed for a windscreen mount ────────────────────────────────────────
/// This is read at a glance, one-handed, often in daylight through a windscreen
/// and sometimes at 3am. So: large figures, high contrast, and the online
/// control given more room than anything else on the screen. Nothing here is
/// smaller than it needs to be.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/config/env.dart';
import '../../../core/theme/tokens.dart';
import '../../auth/data/auth_providers.dart';
import '../data/driver_providers.dart';
import '../domain/driver.dart';

class DriverDashboard extends ConsumerWidget {
  const DriverDashboard({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final driverAsync = ref.watch(driverProvider);

    return Scaffold(
      body: SafeArea(
        child: RefreshIndicator(
          color: AC7Colors.brand,
          onRefresh: () async {
            ref.invalidate(driverProvider);
            ref.invalidate(todaySummaryProvider);
            ref.invalidate(availableRidesProvider);
          },
          child: driverAsync.when(
            loading: () => const Center(
              child: CircularProgressIndicator(color: AC7Colors.brand),
            ),
            error: (e, _) => _Message(
              icon: Icons.wifi_off_outlined,
              title: 'Could not load your account',
              detail: 'Pull down to try again, or ring the control room.',
            ),
            data: (driver) => driver == null
                ? const _Message(
                    icon: Icons.badge_outlined,
                    title: 'No driver account',
                    detail:
                        'This login is not set up to drive. Ring the control room '
                        'if that is wrong.',
                  )
                : _Dashboard(driver: driver),
          ),
        ),
      ),
    );
  }
}

class _Dashboard extends ConsumerWidget {
  const _Dashboard({required this.driver});
  final Driver driver;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final user = ref.watch(currentAppUserProvider);
    final summary = ref.watch(todaySummaryProvider);
    final rides = ref.watch(availableRidesProvider);

    return ListView(
      /// Always scrollable, so pull-to-refresh works even when the content
      /// fits — otherwise the gesture only works on a busy day, which is
      /// exactly when a driver has least patience for it.
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(
        AC7Spacing.gutter, AC7Spacing.lg, AC7Spacing.gutter, AC7Spacing.xxl,
      ),
      children: [
        // ── Who, and what code ────────────────────────────────────────────
        Row(
          children: [
            CircleAvatar(
              radius: 24,
              backgroundColor: theme.colorScheme.primaryContainer,
              child: Text(
                user?.initials ?? '?',
                style: TextStyle(
                  fontWeight: FontWeight.w800,
                  color: theme.colorScheme.onPrimaryContainer,
                ),
              ),
            ),
            const SizedBox(width: AC7Spacing.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(_greeting(user?.firstName), style: theme.textTheme.titleMedium),
                  Text(
                    driver.driverCode,
                    style: theme.textTheme.bodySmall?.copyWith(
                      fontFeatures: const [],
                      letterSpacing: 1.2,
                      fontWeight: FontWeight.w700,
                      color: theme.colorScheme.secondary,
                    ),
                  ),
                ],
              ),
            ),
            _StatusPill(driver: driver),
          ],
        ),

        const SizedBox(height: AC7Spacing.xl),

        // ── Approval gate ─────────────────────────────────────────────────
        // Shown before anything else when the driver cannot work. Putting the
        // online control above an explanation of why it will not work is how
        // somebody spends a morning tapping it.
        if (!driver.applicationStatus.canDrive) ...[
          _ApprovalNotice(status: driver.applicationStatus),
          const SizedBox(height: AC7Spacing.xl),
        ],

        // ── Today ─────────────────────────────────────────────────────────
        Text('Today', style: theme.textTheme.labelSmall),
        const SizedBox(height: AC7Spacing.sm),
        summary.when(
          loading: () => const _StatsRow(earnings: null, trips: null, rating: null),
          error: (_, __) => const _StatsRow(earnings: null, trips: null, rating: null),
          data: (s) => _StatsRow(
            earnings: s.earnings,
            trips: s.trips,
            rating: driver.rating,
          ),
        ),

        const SizedBox(height: AC7Spacing.xl),

        // ── The online control ────────────────────────────────────────────
        _OnlineCard(driver: driver),

        const SizedBox(height: AC7Spacing.xl),

        // ── Work waiting ──────────────────────────────────────────────────
        if (driver.isOnline) ...[
          Text('Requests', style: theme.textTheme.labelSmall),
          const SizedBox(height: AC7Spacing.sm),
          rides.when(
            loading: () => const Padding(
              padding: EdgeInsets.all(AC7Spacing.xl),
              child: Center(child: CircularProgressIndicator(color: AC7Colors.brand)),
            ),
            error: (_, __) => const _Message(
              icon: Icons.wifi_off_outlined,
              title: 'Could not load requests',
              detail: 'Pull down to try again.',
              compact: true,
            ),
            data: (list) => list.isEmpty
                ? const _Message(
                    icon: Icons.schedule,
                    title: 'Waiting for requests',
                    detail: 'You are online and visible to riders nearby.',
                    compact: true,
                  )
                : Column(
                    children: [
                      for (final ride in list) ...[
                        _RideRequestCard(ride: ride),
                        const SizedBox(height: AC7Spacing.md),
                      ],
                    ],
                  ),
          ),
        ],

        const SizedBox(height: AC7Spacing.lg),

        // ── The control room, always reachable ────────────────────────────
        OutlinedButton.icon(
          onPressed: () => launchUrl(Uri.parse('tel:${Env.controlCentreTel}')),
          icon: const Icon(Icons.phone_outlined, size: 18),
          label: const Text('Control room — 24/7'),
        ),
      ],
    );
  }

  String _greeting(String? name) {
    final hour = DateTime.now().hour;
    final part = hour < 12 ? 'Good morning' : (hour < 18 ? 'Good afternoon' : 'Good evening');
    return name == null || name.isEmpty ? part : '$part, $name';
  }
}

/// Online / offline, at a glance.
class _StatusPill extends StatelessWidget {
  const _StatusPill({required this.driver});
  final Driver driver;

  @override
  Widget build(BuildContext context) {
    final online = driver.isOnline;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: AC7Spacing.md, vertical: 5),
      decoration: BoxDecoration(
        color: online
            ? AC7Colors.success.withValues(alpha: 0.14)
            : Theme.of(context).colorScheme.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(AC7Radius.pill),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          // A dot as well as a colour, so the state does not rest on colour
          // alone for a driver who cannot separate green from grey.
          Container(
            width: 7,
            height: 7,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: online
                  ? AC7Colors.success
                  : Theme.of(context).colorScheme.onSurfaceVariant,
            ),
          ),
          const SizedBox(width: 6),
          Text(
            online ? 'ONLINE' : 'OFFLINE',
            style: TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.w800,
              letterSpacing: 0.8,
              color: online
                  ? AC7Colors.success
                  : Theme.of(context).colorScheme.onSurfaceVariant,
            ),
          ),
        ],
      ),
    );
  }
}

class _StatsRow extends StatelessWidget {
  const _StatsRow({required this.earnings, required this.trips, required this.rating});
  final double? earnings;
  final int? trips;
  final double? rating;

  @override
  Widget build(BuildContext context) {
    final money = NumberFormat.currency(locale: 'en_GB', symbol: '£');
    return Row(
      children: [
        Expanded(child: _Stat(value: earnings == null ? '—' : money.format(earnings), label: 'Earned')),
        const SizedBox(width: AC7Spacing.sm),
        Expanded(child: _Stat(value: trips?.toString() ?? '—', label: 'Trips')),
        const SizedBox(width: AC7Spacing.sm),
        Expanded(
          child: _Stat(
            value: rating == null ? '—' : rating!.toStringAsFixed(1),
            label: 'Rating',
          ),
        ),
      ],
    );
  }
}

class _Stat extends StatelessWidget {
  const _Stat({required this.value, required this.label});
  final String value;
  final String label;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AC7Spacing.md, vertical: AC7Spacing.md,
      ),
      decoration: BoxDecoration(
        border: Border.all(color: theme.colorScheme.outline),
        borderRadius: BorderRadius.circular(AC7Radius.card),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          FittedBox(
            fit: BoxFit.scaleDown,
            alignment: Alignment.centerLeft,
            /// Scaled down rather than wrapped. £1,234.50 on a small phone
            /// would otherwise break onto two lines and shove the label out
            /// of the card.
            child: Text(value, style: theme.textTheme.headlineSmall),
          ),
          const SizedBox(height: 2),
          Text(label, style: theme.textTheme.labelSmall),
        ],
      ),
    );
  }
}

/// The online control — the most important thing on the screen.
class _OnlineCard extends ConsumerWidget {
  const _OnlineCard({required this.driver});
  final Driver driver;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final state = ref.watch(onlineControllerProvider);
    final busy = state.isLoading;
    final canDrive = driver.applicationStatus.canDrive;

    ref.listen(onlineControllerProvider, (_, next) {
      next.whenOrNull(
        error: (e, _) => ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(e.toString()),
            backgroundColor: AC7Colors.danger,
          ),
        ),
      );
    });

    return Container(
      padding: const EdgeInsets.all(AC7Spacing.lg),
      decoration: BoxDecoration(
        gradient: driver.isOnline
            ? const LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [Color(0xFFA81F1F), AC7Colors.brand, Color(0xFF4A0000)],
              )
            : null,
        color: driver.isOnline ? null : theme.colorScheme.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(AC7Radius.card),
      ),
      child: Column(
        children: [
          Text(
            driver.isOnline ? 'You are online' : 'You are offline',
            style: theme.textTheme.titleLarge?.copyWith(
              color: driver.isOnline ? Colors.white : theme.colorScheme.onSurface,
            ),
          ),
          const SizedBox(height: AC7Spacing.xs),
          Text(
            driver.isOnline
                ? 'Riders nearby can see you'
                : canDrive
                    ? 'Go online to start receiving jobs'
                    : 'You cannot go online until your account is approved',
            textAlign: TextAlign.center,
            style: theme.textTheme.bodySmall?.copyWith(
              color: driver.isOnline
                  ? Colors.white.withValues(alpha: 0.85)
                  : theme.colorScheme.onSurfaceVariant,
            ),
          ),
          const SizedBox(height: AC7Spacing.lg),

          SizedBox(
            width: double.infinity,
            height: AC7Sizes.primaryAction,
            child: FilledButton(
              /// Going OFFLINE is always allowed, even unapproved or suspended.
              /// A driver who cannot go offline sits in the dispatch pool being
              /// offered work they must refuse — which is precisely the bug the
              /// web version shipped.
              onPressed: busy || (!canDrive && !driver.isOnline)
                  ? null
                  : () => ref.read(onlineControllerProvider.notifier).toggle(driver),
              style: FilledButton.styleFrom(
                backgroundColor: driver.isOnline ? Colors.white : AC7Colors.brand,
                foregroundColor: driver.isOnline ? AC7Colors.brand700 : Colors.white,
                disabledBackgroundColor:
                    theme.colorScheme.onSurface.withValues(alpha: 0.12),
              ),
              child: busy
                  ? const SizedBox(
                      height: 22, width: 22,
                      child: CircularProgressIndicator(strokeWidth: 2.5),
                    )
                  : Text(driver.isOnline ? 'Go offline' : 'Go online'),
            ),
          ),
        ],
      ),
    );
  }
}

class _ApprovalNotice extends StatelessWidget {
  const _ApprovalNotice({required this.status});
  final ApplicationStatus status;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final bad = status == ApplicationStatus.rejected ||
        status == ApplicationStatus.suspended;
    final colour = bad ? AC7Colors.danger : AC7Colors.warning;

    return Container(
      padding: const EdgeInsets.all(AC7Spacing.lg),
      decoration: BoxDecoration(
        color: colour.withValues(alpha: 0.10),
        border: Border.all(color: colour.withValues(alpha: 0.30)),
        borderRadius: BorderRadius.circular(AC7Radius.card),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(bad ? Icons.error_outline : Icons.hourglass_empty, color: colour, size: 22),
          const SizedBox(width: AC7Spacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  status.label,
                  style: theme.textTheme.titleMedium?.copyWith(color: colour),
                ),
                const SizedBox(height: 2),
                Text(status.detail, style: theme.textTheme.bodySmall),
                const SizedBox(height: AC7Spacing.md),
                OutlinedButton.icon(
                  onPressed: () => launchUrl(Uri.parse('tel:${Env.controlCentreTel}')),
                  icon: const Icon(Icons.phone_outlined, size: 17),
                  label: const Text('Ring the control room'),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: colour,
                    side: BorderSide(color: colour.withValues(alpha: 0.4)),
                    minimumSize: const Size.fromHeight(AC7Sizes.controlMd),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// An incoming job.
///
/// The fare and the distance are the two things a driver decides on, so they
/// are the largest text on the card. Addresses matter but are read second.
class _RideRequestCard extends StatelessWidget {
  const _RideRequestCard({required this.ride});
  final Map<String, dynamic> ride;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final money = NumberFormat.currency(locale: 'en_GB', symbol: '£');

    final fare = (ride['estimated_fare'] as num?)?.toDouble() ?? 0;
    final distance = (ride['estimated_distance'] as num?)?.toDouble();
    final duration = (ride['estimated_duration'] as num?)?.toInt();
    final pickup = (ride['pickup_address'] as String?) ?? 'Pickup';
    final dropoff = (ride['dropoff_address'] as String?) ?? 'Destination';

    return Container(
      padding: const EdgeInsets.all(AC7Spacing.lg),
      decoration: BoxDecoration(
        color: theme.colorScheme.surface,
        border: Border.all(color: AC7Colors.brand, width: 1.6),
        borderRadius: BorderRadius.circular(AC7Radius.card),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            children: [
              Text(money.format(fare), style: theme.textTheme.headlineMedium),
              const SizedBox(width: AC7Spacing.sm),
              if (distance != null)
                Text(
                  '${(distance / 1609.344).toStringAsFixed(1)} mi'
                  '${duration != null ? ' · ${(duration / 60).round()} min' : ''}',
                  style: theme.textTheme.bodySmall,
                ),
            ],
          ),
          const SizedBox(height: AC7Spacing.md),
          _Leg(icon: Icons.trip_origin, text: pickup, muted: false),
          const SizedBox(height: AC7Spacing.xs),
          _Leg(icon: Icons.place_outlined, text: dropoff, muted: true),
          const SizedBox(height: AC7Spacing.lg),
          Row(
            children: [
              Expanded(
                flex: 2,
                child: OutlinedButton(
                  onPressed: () {},
                  child: const Text('Decline'),
                ),
              ),
              const SizedBox(width: AC7Spacing.sm),
              Expanded(
                flex: 3,
                child: FilledButton(
                  onPressed: () {},
                  child: const Text('Accept'),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _Leg extends StatelessWidget {
  const _Leg({required this.icon, required this.text, required this.muted});
  final IconData icon;
  final String text;
  final bool muted;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Row(
      children: [
        Icon(icon, size: 15, color: theme.colorScheme.onSurfaceVariant),
        const SizedBox(width: AC7Spacing.sm),
        Expanded(
          child: Text(
            text,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: muted ? theme.textTheme.bodySmall : theme.textTheme.bodyMedium,
          ),
        ),
      ],
    );
  }
}

class _Message extends StatelessWidget {
  const _Message({
    required this.icon,
    required this.title,
    required this.detail,
    this.compact = false,
  });

  final IconData icon;
  final String title;
  final String detail;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: EdgeInsets.all(compact ? AC7Spacing.xl : AC7Spacing.xxl),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(icon, size: 34, color: theme.colorScheme.onSurfaceVariant),
          const SizedBox(height: AC7Spacing.md),
          Text(title, style: theme.textTheme.titleMedium, textAlign: TextAlign.center),
          const SizedBox(height: AC7Spacing.xs),
          Text(detail, style: theme.textTheme.bodySmall, textAlign: TextAlign.center),
        ],
      ),
    );
  }
}
