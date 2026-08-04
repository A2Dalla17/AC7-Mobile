/// AC7 — create an account
///
/// ── Why riders only ────────────────────────────────────────────────────────
/// Self-registration creates a rider. A driver account requires a TfL private
/// hire licence, insurance, a vehicle and right-to-work documents, all checked
/// by the control centre — that is an application, not a signup form, and it
/// cannot be self-served. Offering "sign up as a driver" here would let someone
/// create an account that can never be approved and then wonder why.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/tokens.dart';
import '../data/auth_providers.dart';
import '../data/auth_repository.dart';

class RegisterScreen extends ConsumerStatefulWidget {
  const RegisterScreen({super.key});

  @override
  ConsumerState<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends ConsumerState<RegisterScreen> {
  final _formKey = GlobalKey<FormState>();
  final _firstName = TextEditingController();
  final _lastName = TextEditingController();
  final _email = TextEditingController();
  final _password = TextEditingController();

  bool _obscure = true;
  bool _busy = false;
  String? _error;
  String? _notice;

  @override
  void dispose() {
    _firstName.dispose();
    _lastName.dispose();
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    FocusScope.of(context).unfocus();

    setState(() {
      _busy = true;
      _error = null;
      _notice = null;
    });

    try {
      final user = await ref.read(authControllerProvider.notifier).register(
            email: _email.text,
            password: _password.text,
            firstName: _firstName.text,
            lastName: _lastName.text,
          );

      /* Null with no exception means the project requires email confirmation,
         so there is no session yet. That is success, not failure, and saying
         so is the difference between the person checking their inbox and
         trying to register again. */
      if (user == null && mounted) {
        setState(() => _notice =
            'Almost there — check your email to confirm your address, then sign in.');
      }
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
              child: Form(
                key: _formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text('Create your account', style: theme.textTheme.displaySmall),
                    const SizedBox(height: AC7Spacing.sm),
                    Text(
                      'Book licensed AC7 minicabs across London.',
                      style: theme.textTheme.bodyMedium?.copyWith(
                        color: theme.colorScheme.onSurfaceVariant,
                      ),
                    ),
                    const SizedBox(height: AC7Spacing.xl),

                    if (_error != null) ...[
                      _Banner(message: _error!, tone: _Tone.error),
                      const SizedBox(height: AC7Spacing.lg),
                    ],
                    if (_notice != null) ...[
                      _Banner(message: _notice!, tone: _Tone.success),
                      const SizedBox(height: AC7Spacing.lg),
                    ],

                    Row(
                      children: [
                        Expanded(
                          child: TextFormField(
                            controller: _firstName,
                            textCapitalization: TextCapitalization.words,
                            textInputAction: TextInputAction.next,
                            autofillHints: const [AutofillHints.givenName],
                            decoration: const InputDecoration(labelText: 'First name'),
                            validator: (v) => (v?.trim() ?? '').isEmpty
                                ? 'Required'
                                : null,
                          ),
                        ),
                        const SizedBox(width: AC7Spacing.md),
                        Expanded(
                          child: TextFormField(
                            controller: _lastName,
                            textCapitalization: TextCapitalization.words,
                            textInputAction: TextInputAction.next,
                            autofillHints: const [AutofillHints.familyName],
                            decoration: const InputDecoration(labelText: 'Last name'),
                            validator: (v) => (v?.trim() ?? '').isEmpty
                                ? 'Required'
                                : null,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: AC7Spacing.lg),

                    TextFormField(
                      controller: _email,
                      keyboardType: TextInputType.emailAddress,
                      textInputAction: TextInputAction.next,
                      textCapitalization: TextCapitalization.none,
                      autocorrect: false,
                      autofillHints: const [AutofillHints.email],
                      decoration: const InputDecoration(labelText: 'Email'),
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
                      autofillHints: const [AutofillHints.newPassword],
                      onFieldSubmitted: (_) => _submit(),
                      decoration: InputDecoration(
                        labelText: 'Password',
                        helperText: 'At least 8 characters',
                        suffixIcon: IconButton(
                          icon: Icon(_obscure
                              ? Icons.visibility_outlined
                              : Icons.visibility_off_outlined),
                          tooltip: _obscure ? 'Show password' : 'Hide password',
                          onPressed: () => setState(() => _obscure = !_obscure),
                        ),
                      ),
                      /* Eight, not Supabase's six. Six is the floor the API
                         enforces; asking for a little more at the one moment
                         someone is choosing costs nothing and is the cheapest
                         security this app will ever buy. */
                      validator: (v) {
                        final value = v ?? '';
                        if (value.isEmpty) return 'Choose a password';
                        if (value.length < 8) return 'At least 8 characters';
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
                          : const Text('Create account'),
                    ),
                    const SizedBox(height: AC7Spacing.lg),

                    Text(
                      'Driving for AC7? Speak to the control room — a driver '
                      'account needs your licence, insurance and vehicle '
                      'documents checked first.',
                      textAlign: TextAlign.center,
                      style: theme.textTheme.bodySmall,
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

enum _Tone { error, success }

class _Banner extends StatelessWidget {
  const _Banner({required this.message, required this.tone});
  final String message;
  final _Tone tone;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colour = tone == _Tone.error ? AC7Colors.danger : AC7Colors.success;

    return Container(
      padding: const EdgeInsets.all(AC7Spacing.md),
      decoration: BoxDecoration(
        color: colour.withValues(alpha: 0.10),
        borderRadius: BorderRadius.circular(AC7Radius.control),
        border: Border.all(color: colour.withValues(alpha: 0.30)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(
            tone == _Tone.error ? Icons.error_outline : Icons.check_circle_outline,
            color: colour,
            size: 20,
          ),
          const SizedBox(width: AC7Spacing.md),
          Expanded(
            child: Text(
              message,
              style: theme.textTheme.bodyMedium?.copyWith(color: colour),
            ),
          ),
        ],
      ),
    );
  }
}
