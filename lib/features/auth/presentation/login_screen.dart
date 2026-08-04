/// AC7 — sign in
///
/// ── Why there is no rider/driver choice here ───────────────────────────────
/// The web version asked. It should not have: the role is on the account, so
/// asking meant a driver could pick "rider", get sent to the wrong home, and
/// conclude the app was broken. The account knows what it is. The router reads
/// the role and routes accordingly.
library;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/config/env.dart';
import '../../../core/router/app_router.dart';
import '../../../core/theme/tokens.dart';
import '../data/auth_providers.dart';
import '../data/auth_repository.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _email = TextEditingController();
  final _password = TextEditingController();

  bool _obscure = true;
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;

    /// Dismiss the keyboard first. On a short phone it covers the error we may
    /// be about to show, and the rider reads "nothing happened".
    FocusScope.of(context).unfocus();

    setState(() {
      _busy = true;
      _error = null;
    });

    try {
      await ref.read(authControllerProvider.notifier).signIn(
            email: _email.text,
            password: _password.text,
          );
      /* No navigation here. The router's redirect sees the auth change and
         moves us — routing from two places is how you get a screen that
         pushes twice and a back button that returns to a signed-in login. */
    } on AuthFailure catch (e) {
      if (mounted) setState(() => _error = e.message);
    } catch (_) {
      if (mounted) {
        setState(() => _error = 'Something went wrong. Please try again.');
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(AC7Spacing.gutter),
            child: ConstrainedBox(
              /// Capped so the form does not stretch across a tablet or a
              /// foldable, where a full-width text field looks like a mistake.
              constraints: const BoxConstraints(maxWidth: 440),
              child: Form(
                key: _formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const SizedBox(height: AC7Spacing.xxl),
                    Text('Welcome back', style: theme.textTheme.displaySmall),
                    const SizedBox(height: AC7Spacing.sm),
                    Text(
                      'Sign in to book a car or start your shift.',
                      style: theme.textTheme.bodyMedium?.copyWith(
                        color: theme.colorScheme.onSurfaceVariant,
                      ),
                    ),
                    const SizedBox(height: AC7Spacing.xxl),

                    if (_error != null) ...[
                      _ErrorBanner(message: _error!),
                      const SizedBox(height: AC7Spacing.lg),
                    ],

                    TextFormField(
                      controller: _email,
                      keyboardType: TextInputType.emailAddress,
                      textInputAction: TextInputAction.next,
                      autofillHints: const [AutofillHints.email],
                      /// Off, deliberately. Phone keyboards capitalise the
                      /// first letter and an email is then rejected for a
                      /// reason nobody can see.
                      textCapitalization: TextCapitalization.none,
                      autocorrect: false,
                      decoration: const InputDecoration(
                        labelText: 'Email',
                        hintText: 'you@example.com',
                      ),
                      validator: (v) {
                        final value = v?.trim() ?? '';
                        if (value.isEmpty) return 'Enter your email';
                        if (!value.contains('@') || !value.contains('.')) {
                          return 'That does not look like an email';
                        }
                        return null;
                      },
                    ),
                    const SizedBox(height: AC7Spacing.lg),

                    TextFormField(
                      controller: _password,
                      obscureText: _obscure,
                      textInputAction: TextInputAction.done,
                      autofillHints: const [AutofillHints.password],
                      onFieldSubmitted: (_) => _submit(),
                      decoration: InputDecoration(
                        labelText: 'Password',
                        suffixIcon: IconButton(
                          icon: Icon(_obscure
                              ? Icons.visibility_outlined
                              : Icons.visibility_off_outlined),
                          /// Being able to see what you typed is the single
                          /// biggest reduction in failed sign-ins on a phone
                          /// keyboard.
                          tooltip: _obscure ? 'Show password' : 'Hide password',
                          onPressed: () => setState(() => _obscure = !_obscure),
                        ),
                      ),
                      validator: (v) =>
                          (v ?? '').isEmpty ? 'Enter your password' : null,
                    ),

                    Align(
                      alignment: Alignment.centerRight,
                      child: TextButton(
                        onPressed: _busy
                            ? null
                            : () => context.push(Routes.forgotPassword),
                        child: const Text('Forgot password?'),
                      ),
                    ),
                    const SizedBox(height: AC7Spacing.sm),

                    FilledButton(
                      onPressed: _busy ? null : _submit,
                      child: _busy
                          ? const SizedBox(
                              height: 22,
                              width: 22,
                              child: CircularProgressIndicator(
                                strokeWidth: 2.5,
                                color: Colors.white,
                              ),
                            )
                          : const Text('Sign in'),
                    ),
                    const SizedBox(height: AC7Spacing.lg),

                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text(
                          'New to AC7?',
                          style: theme.textTheme.bodyMedium?.copyWith(
                            color: theme.colorScheme.onSurfaceVariant,
                          ),
                        ),
                        TextButton(
                          onPressed:
                              _busy ? null : () => context.push(Routes.register),
                          child: const Text('Create an account'),
                        ),
                      ],
                    ),

                    const SizedBox(height: AC7Spacing.xl),

                    /// The phone number, always reachable.
                    ///
                    /// A good share of AC7's customers will always prefer to
                    /// ring, and someone locked out of their account has no
                    /// other way to get a car. Hiding this behind a signed-in
                    /// screen turns them away at the door.
                    OutlinedButton.icon(
                      onPressed: () => Clipboard.setData(
                        const ClipboardData(text: Env.controlCentreTel),
                      ).then((_) {
                        if (!context.mounted) return;
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(
                            content: Text('Control room number copied'),
                          ),
                        );
                      }),
                      icon: const Icon(Icons.phone_outlined, size: 18),
                      label: const Text(
                        'Control room — ${Env.controlCentreDisplay}',
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _ErrorBanner extends StatelessWidget {
  const _ErrorBanner({required this.message});
  final String message;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Container(
      padding: const EdgeInsets.all(AC7Spacing.md),
      decoration: BoxDecoration(
        color: AC7Colors.danger.withValues(alpha: 0.10),
        borderRadius: BorderRadius.circular(AC7Radius.control),
        border: Border.all(color: AC7Colors.danger.withValues(alpha: 0.30)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.error_outline, color: AC7Colors.danger, size: 20),
          const SizedBox(width: AC7Spacing.md),
          Expanded(
            child: Text(
              message,
              /// Announced to screen readers when it appears, rather than
              /// sitting there silently for somebody who cannot see it.
              semanticsLabel: 'Error: $message',
              style: theme.textTheme.bodyMedium?.copyWith(
                color: AC7Colors.danger,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
