/// Contract 9 (Reminder Data) plus the device's guest identity and push-token
/// registration.
///
/// Realizes: FR7.1-FR7.8.
///
/// Two things make this service unlike the other four:
///
/// 1. **Every call uses [AuthMode.identityPool], signed in or not** (FR7.8,
///    BR7.6). Reminders are scoped to a Cognito *Identity Pool* id, not to a
///    Google sign-in, so no sign-in is ever required to use them.
/// 2. **That identity id changes when the user signs in or out.** Amplify's
///    Identity Pool issues a different id for an authenticated identity than
///    for the guest one, so "this device's reminders" are effectively keyed per
///    sign-in state. [resolveIdentity] reports the current id and
///    `DeviceIdentityState` re-syncs when it changes. Whether the earlier
///    identity's already-scheduled reminders produce a duplicate push is a
///    sandbox-integration question for Build and Test — no cancel-all logic is
///    added here, per the builder's simplicity preference for the reminder
///    module.
///
/// Personal data: a push token is never logged (project.md Mandated).
library;

import '../models/reminder.dart';
import 'gateways.dart';
import 'documents/reminder_documents.dart';
import 'service_parsing.dart';

/// Why a reminder action did not take effect.
enum ReminderFailureKind {
  /// BR7.3: snooze is refused once 9:00 PM IST on the event's eve has passed.
  cutoffPassed,

  /// The reminder belongs to a different device identity, or no longer exists.
  notYours,

  /// Network or backend failure.
  network,
}

/// A reminder-action failure with copy that is safe to render inline.
class ReminderFailure implements Exception {
  const ReminderFailure(this.kind, this.message);

  final ReminderFailureKind kind;
  final String message;

  @override
  String toString() => 'ReminderFailure(${kind.name}): $message';
}

/// The outcome of asking the OS for notification permission and registering.
class PushRegistration {
  const PushRegistration({
    required this.permissionGranted,
    required this.registered,
    this.platform,
  });

  final bool permissionGranted;

  /// Whether `registerDeviceToken` actually succeeded. `false` with
  /// [permissionGranted] `true` means a transient failure worth retrying on the
  /// next Calendar visit (functional-spec.md: no user-facing error for a
  /// background operation).
  final bool registered;

  final DevicePlatform? platform;
}

class ReminderService {
  ReminderService(this._api, this._auth, this._push);

  final ApiGateway _api;
  final AuthGateway _auth;
  final PushGateway _push;

  static const String cutoffPassedMessage =
      'It is too late to snooze this reminder — the event is today.';
  static const String notYoursMessage =
      'That reminder is no longer available on this device.';
  static const String networkMessage =
      'Could not reach the server. Please check your connection and try again.';

  /// The device's current Cognito Identity Pool id, guest or authenticated.
  ///
  /// Returns `null` when it cannot be resolved (offline on first ever launch);
  /// Calendar then shows its error state rather than silently showing nothing.
  Future<String?> resolveIdentity() async {
    try {
      final session = await _auth.fetchSession();
      return session.identityId;
    } on AuthGatewayException {
      return null;
    }
  }

  /// Requests OS notification permission and, if granted, registers the push
  /// token with Contract 9.
  ///
  /// Never throws: permission denial and a failed registration are both normal
  /// states the Calendar screen explains or silently retries.
  Future<PushRegistration> requestPermissionAndToken() async {
    final granted = await _push.requestPermission();
    if (!granted) {
      // Permission denied: no token is obtained and nothing is registered.
      return const PushRegistration(
        permissionGranted: false,
        registered: false,
      );
    }
    final token = await _push.getToken();
    if (token == null || token.isEmpty) {
      return const PushRegistration(permissionGranted: true, registered: false);
    }
    final platform = DevicePlatform.fromGraphQl(_push.platform);
    if (platform == null) {
      // A platform Contract 9 does not model (e.g. a desktop build) — nothing
      // to register, and not an error worth showing.
      return const PushRegistration(permissionGranted: true, registered: false);
    }
    try {
      await register(pushToken: token, platform: platform);
      return PushRegistration(
        permissionGranted: true,
        registered: true,
        platform: platform,
      );
    } on ApiException {
      // Retried silently on the next Calendar visit.
      return PushRegistration(
        permissionGranted: true,
        registered: false,
        platform: platform,
      );
    }
  }

  /// FCM token rotations, so the caller can re-register.
  Stream<String> get onTokenRefresh => _push.onTokenRefresh;

  /// The `DevicePlatform` this build runs on, or `null` if Contract 9 does not
  /// model it.
  DevicePlatform? get platform => DevicePlatform.fromGraphQl(_push.platform);

  /// `registerDeviceToken(pushToken, platform)` — idempotent per identity.
  Future<DeviceToken> register({
    required String pushToken,
    required DevicePlatform platform,
  }) async {
    final data = await _api.mutate(
      document: registerDeviceTokenDocument,
      field: 'registerDeviceToken',
      authMode: AuthMode.identityPool,
      variables: {'pushToken': pushToken, 'platform': platform.graphQlValue},
    );
    return parseObject(
      data,
      DeviceToken.fromJson,
      field: 'registerDeviceToken',
    );
  }

  /// `myReminders` — also triggers reminder-unit's lazy backfill (BR7.1).
  Future<List<Reminder>> myReminders() async {
    final data = await _api.query(
      document: myRemindersDocument,
      field: 'myReminders',
      authMode: AuthMode.identityPool,
    );
    return parseList(data, Reminder.fromJson, field: 'myReminders');
  }

  /// `setRemindersEnabled(enabled)` — affects FUTURE auto-creation only, never
  /// existing reminders (BR7.7).
  Future<DeviceToken> setEnabled(bool enabled) async {
    final data = await _api.mutate(
      document: setRemindersEnabledDocument,
      field: 'setRemindersEnabled',
      authMode: AuthMode.identityPool,
      variables: {'enabled': enabled},
    );
    return parseObject(
      data,
      DeviceToken.fromJson,
      field: 'setRemindersEnabled',
    );
  }

  /// `snoozeReminder(id)`. Throws [ReminderFailure] with
  /// [ReminderFailureKind.cutoffPassed] when BR7.3's cutoff has passed.
  Future<Reminder> snooze(String id) => _reminderAction(
    document: snoozeReminderDocument,
    field: 'snoozeReminder',
    id: id,
  );

  /// `cancelReminder(id)` — one event only, never the app-wide toggle.
  Future<Reminder> cancel(String id) => _reminderAction(
    document: cancelReminderDocument,
    field: 'cancelReminder',
    id: id,
  );

  /// The shared shape of the two per-reminder mutations: an id in, a Reminder
  /// out, and every failure — server refusal or unreadable response — mapped
  /// onto a [ReminderFailure] the Calendar screen can render inline.
  Future<Reminder> _reminderAction({
    required String document,
    required String field,
    required String id,
  }) async {
    Object? data;
    try {
      data = await _api.mutate(
        document: document,
        field: field,
        authMode: AuthMode.identityPool,
        variables: {'id': id},
      );
    } on ApiException catch (e) {
      throw _classify(e);
    }
    final Reminder parsed;
    try {
      parsed = parseObject(data, Reminder.fromJson, field: field);
    } on ApiException catch (e) {
      throw _classify(e);
    }
    return parsed;
  }

  /// Maps a server refusal onto a [ReminderFailure]. A transport failure is
  /// always [ReminderFailureKind.network]; a server refusal is classified by
  /// what reminder-unit's message says, and its own wording is preserved
  /// whenever it is a refusal (so a message this build does not recognise is
  /// still shown to the user rather than replaced with a generic one).
  ReminderFailure _classify(ApiException e) {
    if (e.isTransport) {
      return const ReminderFailure(ReminderFailureKind.network, networkMessage);
    }
    final lower = e.message.toLowerCase();
    if (lower.contains('snooze') ||
        lower.contains('cutoff') ||
        lower.contains('too late') ||
        lower.contains('9:00 pm')) {
      return ReminderFailure(ReminderFailureKind.cutoffPassed, e.message);
    }
    if (lower.contains('not found') ||
        lower.contains('does not belong') ||
        lower.contains('not yours')) {
      return ReminderFailure(ReminderFailureKind.notYours, e.message);
    }
    return ReminderFailure(ReminderFailureKind.network, e.message);
  }
}
