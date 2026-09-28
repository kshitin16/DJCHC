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
  FirebasePushGateway({FirebaseMessaging? messaging})
    : _messaging = messaging ?? FirebaseMessaging.instance;

  final FirebaseMessaging _messaging;

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
