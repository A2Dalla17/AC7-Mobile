/// A named stand-in for a module not yet built.
///
/// Named rather than generic on purpose: during Phase 1 testing you need to
/// know WHICH module you landed on, so that a redirect sending a driver to the
/// rider section is visible rather than looking like the same empty screen.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../features/auth/data/auth_providers.dart';
import '../theme/tokens.dart';

class PlaceholderScreen extends ConsumerWidget {
  const PlaceholderScreen({
    required this.title,
    required this.detail,
    this.showSignOut = false,
    super.key,
  });

  final String title;
  final String detail;
  final bool showSignOut;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final user = ref.watch(currentAppUserProvider);

    return Scaffold(
      appBar: AppBar(title: Text(title)),
      body: Padding(
        padding: const EdgeInsets.all(AC7Spacing.gutter),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (user != null) ...[
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(AC7Spacing.lg),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Signed in', style: theme.textTheme.labelSmall),
                      const SizedBox(height: AC7Spacing.xs),
                      Text(user.fullName, style: theme.textTheme.titleMedium),
                      Text(user.email, style: theme.textTheme.bodySmall),
                      const SizedBox(height: AC7Spacing.md),
                      Wrap(
                        spacing: AC7Spacing.sm,
                        runSpacing: AC7Spacing.sm,
                        children: [
                          _Chip(label: 'Role', value: user.role.name),
                          if (user.riderCode != null)
                            _Chip(label: 'Code', value: user.riderCode!),
                          _Chip(
                            label: 'Onboarded',
                            value: user.needsOnboarding ? 'no' : 'yes',
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: AC7Spacing.lg),
            ],
            Text(detail, style: theme.textTheme.bodyMedium),
            const Spacer(),
            if (showSignOut)
              OutlinedButton(
                onPressed: () => ref.read(authControllerProvider.notifier).signOut(),
                child: const Text('Sign out'),
              ),
          ],
        ),
      ),
    );
  }
}

class _Chip extends StatelessWidget {
  const _Chip({required this.label, required this.value});
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AC7Spacing.md,
        vertical: AC7Spacing.xs,
      ),
      decoration: BoxDecoration(
        color: theme.colorScheme.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(AC7Radius.pill),
      ),
      child: Text('$label: $value', style: theme.textTheme.bodySmall),
    );
  }
}
