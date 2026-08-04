/// AC7 — password reset request.
///
/// ── Why it always says "sent" ──────────────────────────────────────────────
/// The confirmation is identical whether or not the address has an account.
/// Saying "no account with that email" turns this screen into a free tool for
/// discovering which of a list of addresses are AC7 customers. The person who
/// genuinely mistyped their address finds out when no email arrives, which is
/// a small cost next to handing out a customer list.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/tokens.dart';
import '../data/auth_providers.dart';

class ForgotPasswordScreen extends ConsumerStatefulWidget {
  const ForgotPasswordScreen({super.key});

  @override
  ConsumerState<ForgotPasswordScreen> createState() =>
      _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends ConsumerState<ForgotPasswordScreen> {
  final _formKey = GlobalKey<FormState>();
  final _email = TextEditingController();
  bool _busy = false;
  bool _sent = false;

  @override
  void dispose() {
    _email.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    FocusScope.of(context).unfocus();
    setState(() => _busy = true);

    try {
      await ref.read(authRepositoryProvider).sendPasswordReset(_email.text);
    } catch (_) {
      /* Swallowed on purpose. Surfacing the failure would leak whether the
         address exists, which is the whole thing this screen avoids. */
    } finally {
      if (mounted) {
        setState(() {
          _busy = false;
          _sent = true;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.pop(),
        ),
      ),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(AC7Spacing.gutter),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 440),
              child: _sent
                  ? Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        const Icon(
                          Icons.mark_email_read_outlined,
                          size: 56,
                          color: AC7Colors.success,
                        ),
                        const SizedBox(height: AC7Spacing.lg),
                        Text('Check your email',
                            textAlign: TextAlign.center,
                            style: theme.textTheme.headlineSmall),
                        const SizedBox(height: AC7Spacing.sm),
                        Text(
                          'If there is an AC7 account for ${_email.text.trim()}, '
                          'a reset link is on its way.',
                          textAlign: TextAlign.center,
                          style: theme.textTheme.bodyMedium?.copyWith(
                            color: theme.colorScheme.onSurfaceVariant,
                          ),
                        ),
                        const SizedBox(height: AC7Spacing.xl),
                        FilledButton(
                          onPressed: () => context.pop(),
                          child: const Text('Back to sign in'),
                        ),
                      ],
                    )
                  : Form(
                      key: _formKey,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Text('Reset your password',
                              style: theme.textTheme.headlineMedium),
                          const SizedBox(height: AC7Spacing.sm),
                          Text(
                            'We will email you a link to set a new one.',
                            style: theme.textTheme.bodyMedium?.copyWith(
                              color: theme.colorScheme.onSurfaceVariant,
                            ),
                          ),
                          const SizedBox(height: AC7Spacing.xl),
                          TextFormField(
                            controller: _email,
                            keyboardType: TextInputType.emailAddress,
                            textCapitalization: TextCapitalization.none,
                            autocorrect: false,
                            autofillHints: const [AutofillHints.email],
                            onFieldSubmitted: (_) => _submit(),
                            decoration:
                                const InputDecoration(labelText: 'Email'),
                            validator: (v) {
                              final value = v?.trim() ?? '';
                              if (value.isEmpty) return 'Enter your email';
                              if (!value.contains('@')) {
                                return 'That does not look like an email';
                              }
                              return null;
                            },
                          ),
                          const SizedBox(height: AC7Spacing.xl),
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
                                : const Text('Send reset link'),
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
