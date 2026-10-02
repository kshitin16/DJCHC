/// The ONE file that imports `firebase_messaging`.
///
/// Everything else depends on the `PushGateway` interface in `gateways.dart`, so
/// the reminder service and the Calendar screen are testable without Firebase.
///
/// Not unit-tested: it is a thin adapter over a plugin that needs platform
/// channels and a real Firebase project.
library;

import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';

import 'gateways.dart';

/// FCM-backed [PushGateway].
class FirebasePushGateway implements PushGateway {
  FirebasePushGateway({FirebaseMessaging? messaging}) : _injected = messaging;

  final FirebaseMessaging? _injected;

  /// Resolved LAZILY, on first use, and never in the constructor.
  ///
  /// `FirebaseMessaging.instance` throws `[core/no-app]` until
  /// `Firebase.initializeApp()` has run. `main()` constructs this gateway on
  /// the BLOCKING path before the first frame, while `AppBootstrap.initFirebase`
  /// deliberately runs on the deferred path afterwards
  /// (performance-design.md) — so at construction time Firebase is guaranteed
  /// NOT to be initialized.
  ///
  /// Resolving it in the constructor's initializer list therefore threw before
  /// `runApp` was ever reached: a white screen and an immediate exit, with none
  /// of this class's own try/catch blocks able to help, because the object
  /// could not be built at all. Every method below is defensively wrapped; the
  /// constructor was the one path that was not.
  ///
  /// The tests never caught it because they always inject a fake through
  /// `messaging`, so the `FirebaseMessaging.instance` branch is only ever
  /// evaluated in a real app.
  ///
  /// Found on the first run against a real device, 2026-10-01.
  FirebaseMessaging get _messaging => _injected ?? FirebaseMessaging.instance;

  /// The FCM `data` key reminder-unit's `deliver-push` puts the post id under,
  /// so a notification tap can deep-link to that event's date on Calendar.
  static const String postIdDataKey = 'postId';

  @override
  Future<bool> requestPermission() async {
    try {
      final settings = await _messaging.requestPermission();
      return settings.authorizationStatus == AuthorizationStatus.authorized ||
          settings.authorizationStatus == AuthorizationStatus.provisional;
    } on Object catch (e) {
      // No Firebase project configured yet, or the platform refused. Treated as
      // "not granted" — Calendar explains it plainly rather than crashing.
      debugPrint(
        'FirebasePushGateway: requestPermission failed (${e.runtimeType})',
      );
      return false;
    }
  }

  @override
  Future<String?> getToken() async {
    try {
      // NEVER logged: a push token is device-scoped personal data
      // (project.md Mandated).
      return await _messaging.getToken();
    } on Object catch (e) {
      debugPrint('FirebasePushGateway: getToken failed (${e.runtimeType})');
      return null;
    }
  }

  @override
  Stream<String> get onTokenRefresh => _messaging.onTokenRefresh;

  @override
  String get platform => defaultTargetPlatform == TargetPlatform.iOS
      ? 'IOS'
      : defaultTargetPlatform == TargetPlatform.android
      ? 'ANDROID'
      // A platform Contract 9 does not model; `DevicePlatform.fromGraphQl`
      // returns null and nothing is registered.
      : 'UNSUPPORTED';

  /// The post id carried by a notification the user tapped to open the app, or
  /// `null` when the app was not opened from a notification.
  Future<String?> initialPostId() async {
    try {
      final message = await _messaging.getInitialMessage();
      return _postIdOf(message);
    } on Object catch (e) {
      debugPrint(
        'FirebasePushGateway: getInitialMessage failed (${e.runtimeType})',
      );
      return null;
    }
  }

  /// Post ids from notification taps while the app is already running.
  Stream<String> get onNotificationOpened => FirebaseMessaging
      .onMessageOpenedApp
      .map(_postIdOf)
      .where((id) => id != null)
      .cast<String>();

  static String? _postIdOf(RemoteMessage? message) {
    final value = message?.data[postIdDataKey];
    return value is String && value.isNotEmpty ? value : null;
  }
}
