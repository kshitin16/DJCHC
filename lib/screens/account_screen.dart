/// Screen 5 — Account (FR1.1, FR4.1, FR7.7).
///
/// Identity comes from the ID token `AuthState` already holds — no query is
/// needed (Contract 1). The language toggle is a local device preference, and the
/// reminders toggle goes through Contract 9's `setRemindersEnabled`.
///
/// Personal data: the email is displayed but never logged.
library;

import 'package:flutter/material.dart';

import '../services/auth_service.dart';
import '../services/gateways.dart';
import '../state/auth_state.dart';
import '../state/device_identity_state.dart';
import '../state/localization_controller.dart';
import '../widgets/bottom_nav_bar.dart';

class AccountScreen extends StatefulWidget {
  const AccountScreen({
    required this.authState,
    required this.deviceIdentity,
    required this.strings,
    this.onSignedOut,
    super.key,
  });

  final AuthState authState;
  final DeviceIdentityState deviceIdentity;
  final LocalizationController strings;

  /// Called after a successful sign-out, so the shell can return to Feed.
  final VoidCallback? onSignedOut;

  static const Key emailKey = ValueKey('account.email');
  static const Key nameKey = ValueKey('account.name');
  static const Key signOutKey = ValueKey('account.signOut');
  static const Key signOutErrorKey = ValueKey('account.signOutError');
  static const Key remindersErrorKey = ValueKey('account.remindersError');

  @override
  State<AccountScreen> createState() => _AccountScreenState();
}

class _AccountScreenState extends State<AccountScreen> {
  String? _signOutError;
  String? _remindersError;
  bool _signOutInFlight = false;
  bool _toggleInFlight = false;

  Future<void> _signOut() async {
    setState(() {
      _signOutInFlight = true;
      _signOutError = null;
    });
    try {
      await widget.authState.signOut();
      if (!mounted) return;
      setState(() => _signOutInFlight = false);
      widget.onSignedOut?.call();
    } on AuthFailure catch (e) {
      if (!mounted) return;
      // The user stays signed in until sign-out actually succeeds.
      setState(() {
        _signOutInFlight = false;
        _signOutError = e.message;
      });
    }
  }

  Future<void> _setReminders(bool enabled) async {
    setState(() {
      _toggleInFlight = true;
      _remindersError = null;
    });
    try {
      await widget.deviceIdentity.setRemindersEnabled(enabled);
      if (!mounted) return;
      setState(() => _toggleInFlight = false);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _toggleInFlight = false;
        _remindersError = e.message;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final strings = widget.strings;
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(strings.t('account.title'))),
      body: ListView(
        children: [
          Builder(
            builder: (context) {
              // Google does not guarantee a name, so the tile renders the
              // email alone when none arrived rather than showing a gap or a
              // placeholder. Both are personal data: displayed, never logged.
              final name = widget.authState.displayName;
              return ListTile(
                leading: const Icon(Icons.person_outline),
                title: Text(strings.t('account.signedInAs')),
                isThreeLine: name != null,
                subtitle: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    if (name != null)
                      Text(
                        name,
                        key: AccountScreen.nameKey,
                        style: Theme.of(context).textTheme.bodyLarge,
                      ),
                    Text(
                      widget.authState.email ?? '—',
                      key: AccountScreen.emailKey,
                    ),
                  ],
                ),
              );
            },
          ),
          const Divider(height: 1),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
            child: Text(
              strings.t('account.language'),
              style: theme.textTheme.titleSmall,
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: LanguageToggle(strings: strings),
          ),
          const SizedBox(height: 8),
          const Divider(height: 1),
          // BR7.7: this affects FUTURE auto-creation only, never the reminders
          // that already exist.
          RemindersToggle(
            enabled: widget.deviceIdentity.remindersEnabled,
            onChanged: _toggleInFlight ? null : _setReminders,
            label: strings.t('account.reminders'),
            subtitle: strings.t('account.remindersHint'),
          ),
          if (_remindersError != null)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Text(
                _remindersError!,
                key: AccountScreen.remindersErrorKey,
                style: TextStyle(color: theme.colorScheme.error),
              ),
            ),
          const Divider(height: 1),
          Padding(
            padding: const EdgeInsets.all(16),
            child: OutlinedButton.icon(
              key: AccountScreen.signOutKey,
              onPressed: _signOutInFlight ? null : _signOut,
              icon: const Icon(Icons.logout),
              label: Text(strings.t('common.signOut')),
            ),
          ),
          if (_signOutError != null)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Text(
                _signOutError!,
                key: AccountScreen.signOutErrorKey,
                style: TextStyle(color: theme.colorScheme.error),
              ),
            ),
        ],
      ),
    );
  }
}
