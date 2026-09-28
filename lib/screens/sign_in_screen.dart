/// Screen 2 — Sign In (FR1.1; Contract 1, Cognito Google federation).
///
/// On success the screen pops back to the route the user was headed to. A
/// cancellation and a real failure read differently, and neither ever shows raw
/// OAuth text (functional-spec.md Screen 2 error state).
library;

import 'package:flutter/material.dart';

import '../services/auth_service.dart';
import '../state/auth_state.dart';
import '../state/localization_controller.dart';

class SignInScreen extends StatefulWidget {
  const SignInScreen({
    required this.authState,
    required this.strings,
    this.onSignedIn,
    this.showSignInRequiredNotice = false,
    super.key,
  });

  final AuthState authState;
  final LocalizationController strings;

  /// Called after a successful sign-in, so the shell can return the user to the
  /// route they were originally headed to.
  final VoidCallback? onSignedIn;

  /// True when the user arrived by being redirected off a gated screen, which
  /// adds the "please sign in to continue" line.
  final bool showSignInRequiredNotice;

  static const Key googleButtonKey = ValueKey('signIn.google');
  static const Key errorKey = ValueKey('signIn.error');
  static const Key noticeKey = ValueKey('signIn.required');

  @override
  State<SignInScreen> createState() => _SignInScreenState();
}

class _SignInScreenState extends State<SignInScreen> {
  String? _error;
  bool _inFlight = false;

  Future<void> _signIn() async {
    setState(() {
      _inFlight = true;
      _error = null;
    });
    try {
      await widget.authState.signIn();
      if (!mounted) return;
      setState(() => _inFlight = false);
      widget.onSignedIn?.call();
    } on AuthFailure catch (e) {
      if (!mounted) return;
      // Both kinds are already plain-language copy from `AuthService`; a
      // cancellation simply reads as a cancellation rather than as a failure.
      setState(() {
        _inFlight = false;
        _error = e.message;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final strings = widget.strings;
    return Scaffold(
      appBar: AppBar(title: Text(strings.t('signIn.title'))),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              if (widget.showSignInRequiredNotice)
                Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: Text(
                    strings.t('signIn.required'),
                    key: SignInScreen.noticeKey,
                    textAlign: TextAlign.center,
                  ),
                ),
              Text(strings.t('signIn.intro'), textAlign: TextAlign.center),
              const SizedBox(height: 24),
              FilledButton.icon(
                key: SignInScreen.googleButtonKey,
                onPressed: _inFlight ? null : _signIn,
                icon: const Icon(Icons.login),
                label: Text(strings.t('signIn.google')),
              ),
              if (_error != null) ...[
                const SizedBox(height: 16),
                Text(
                  _error!,
                  key: SignInScreen.errorKey,
                  textAlign: TextAlign.center,
                  style: TextStyle(color: Theme.of(context).colorScheme.error),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
