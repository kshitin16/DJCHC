/// Startup wiring for Amplify and Firebase, kept out of `main.dart` so it is
/// unit-testable against fakes (plan Step 5.10).
///
/// Ordering is performance-design.md's: `configureAmplify` is on the BLOCKING
/// path before the first frame (no network I/O), while `initFirebase` and the
/// guest-identity resolution run after the first frame and must never block or
/// crash startup.
library;

import 'package:flutter/foundation.dart';

/// Whether Firebase is usable in this build.
enum FirebaseAvailability {
  /// `Firebase.initializeApp()` succeeded; Crashlytics and FCM work.
  available,

  /// No `google-services.json` / `GoogleService-Info.plist` yet, or init
  /// failed. Crash reporting and push reminders are inert; everything else
  /// works. Logged ONCE, never fatal.
  unavailable,
}

/// Configures Amplify exactly once.
///
/// `Amplify.configure` throws if called twice (a hot restart, a second
/// bootstrap in a test), so the guard is here rather than at every call site.
/// A failure is rethrown: without Amplify nothing in the app can reach the
/// backend, so this is a fail-fast condition, not a degraded mode.
typedef AmplifyConfigurator = Future<void> Function(String amplifyConfig);

/// Configures Firebase. Returns `false` when it is unavailable.
typedef FirebaseInitializer = Future<bool> Function();

class AppBootstrap {
  AppBootstrap({
    required AmplifyConfigurator configureAmplifyFn,
    required FirebaseInitializer initFirebaseFn,
  }) : _configureAmplify = configureAmplifyFn,
       _initFirebase = initFirebaseFn;

  final AmplifyConfigurator _configureAmplify;
  final FirebaseInitializer _initFirebase;

  bool _amplifyConfigured = false;
  bool _firebaseLogged = false;

  /// Whether [configureAmplify] has already completed.
  bool get amplifyConfigured => _amplifyConfigured;

  /// Blocking startup step: configure Amplify. Idempotent — a second call is a
  /// no-op rather than an SDK exception.
  Future<void> configureAmplify(String amplifyConfig) async {
    if (_amplifyConfigured) return;
    await _configureAmplify(amplifyConfig);
    _amplifyConfigured = true;
  }

  /// Non-blocking startup step: initialize Firebase.
  ///
  /// Never throws. When Firebase is absent this returns
  /// [FirebaseAvailability.unavailable] and logs once, so a builder who has not
  /// yet run `flutterfire configure` still gets a working app.
  Future<FirebaseAvailability> initFirebase() async {
    bool ok;
    try {
      ok = await _initFirebase();
    } on Object catch (e) {
      debugPrint('AppBootstrap: Firebase init failed (${e.runtimeType})');
      ok = false;
    }
    if (ok) return FirebaseAvailability.available;
    if (!_firebaseLogged) {
      _firebaseLogged = true;
      debugPrint(
        'AppBootstrap: Firebase is not configured — crash reporting and push '
        'reminders are disabled. Run `flutterfire configure` (see README, '
        '"Mobile App" > Firebase).',
      );
    }
    return FirebaseAvailability.unavailable;
  }
}
