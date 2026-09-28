/// Root-level device-identity state (frontend-components.md, FR7.8).
///
/// Holds the Cognito Identity Pool id Contract 9 scopes reminders by, whether
/// notification permission was granted, and the app-wide reminders toggle.
///
/// Resolution STARTS after the first frame and never blocks it
/// (performance-design.md). Calendar awaits [ensureResolved] before its own
/// `myReminders` call.
///
/// The identity id CHANGES on sign-in and sign-out (plan rule 4). When it does,
/// this notifier notifies, which is Calendar's cue to re-sync — the earlier
/// identity's reminders are deliberately left alone rather than migrated, per
/// the builder's simplicity preference for the reminder module.
library;

import 'package:flutter/foundation.dart';

import '../models/reminder.dart';
import '../services/reminder_service.dart';

class DeviceIdentityState extends ChangeNotifier {
  DeviceIdentityState(this._reminders);

  final ReminderService _reminders;

  String? _identityId;
  bool _permissionGranted = false;
  bool _permissionRequested = false;
  bool _registered = false;
  bool _remindersEnabled = true;

  /// The device's current Identity Pool id, or `null` until resolved.
  String? get identityId => _identityId;

  /// Whether the identity has been resolved at least once.
  bool get isResolved => _identityId != null;

  /// Whether the OS granted notification permission. `false` before the prompt
  /// has been shown as well as after a denial — use [permissionRequested] to
  /// tell the two apart.
  bool get permissionGranted => _permissionGranted;

  /// Whether the OS prompt has been raised at least once this session.
  bool get permissionRequested => _permissionRequested;

  /// Whether `registerDeviceToken` has succeeded for the current identity.
  bool get registered => _registered;

  /// The app-wide reminders toggle (BR7.7: future auto-creation only).
  bool get remindersEnabled => _remindersEnabled;

  /// Resolves the identity id if it is not known yet, and notifies when it
  /// changes.
  ///
  /// Safe to call on every Calendar visit: it re-reads the id so a sign-in or
  /// sign-out that happened in between is picked up. Never throws.
  Future<String?> ensureResolved() async {
    final resolved = await _reminders.resolveIdentity();
    if (resolved == null) return _identityId;
    if (resolved != _identityId) {
      _identityId = resolved;
      // A new identity has its own DeviceToken and its own reminders, so the
      // registration flag no longer applies.
      _registered = false;
      notifyListeners();
    }
    return _identityId;
  }

  /// Requests notification permission (first Calendar visit) and registers the
  /// push token. Never throws; a failure is retried on the next call.
  Future<void> ensureRegistered() async {
    if (_registered) return;
    final result = await _reminders.requestPermissionAndToken();
    _permissionRequested = true;
    final changed =
        result.permissionGranted != _permissionGranted ||
        result.registered != _registered;
    _permissionGranted = result.permissionGranted;
    _registered = result.registered;
    if (changed) notifyListeners();
  }

  /// Flips the app-wide reminders toggle through Contract 9.
  ///
  /// Rethrows so the calling screen can show an inline error; the local flag is
  /// only updated once the server has confirmed it, so the UI never shows a
  /// state the backend does not hold.
  Future<void> setRemindersEnabled(bool enabled) async {
    final token = await _reminders.setEnabled(enabled);
    _applyToken(token);
  }

  /// Adopts the server's own view of the device token (e.g. from a
  /// registration response), so the toggle reflects the backend.
  void _applyToken(DeviceToken token) {
    if (token.remindersEnabled == _remindersEnabled && _registered) return;
    _remindersEnabled = token.remindersEnabled;
    _registered = true;
    notifyListeners();
  }
}
