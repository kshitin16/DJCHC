/// `AppBootstrap` tests (plan Step 6.7) — startup must never be blocked or
/// crashed by an unconfigured Firebase, and Amplify must be configured exactly
/// once.
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:sarovar_jinalaya/services/app_bootstrap.dart';

void main() {
  test(
    'Firebase being unavailable is non-fatal and reported, not thrown',
    () async {
      var firebaseCalls = 0;
      final bootstrap = AppBootstrap(
        configureAmplifyFn: (_) async {},
        initFirebaseFn: () async {
          firebaseCalls++;
          return false; // No google-services.json yet.
        },
      );

      final availability = await bootstrap.initFirebase();

      expect(availability, FirebaseAvailability.unavailable);
      expect(firebaseCalls, 1);

      // A THROWING initializer is also non-fatal — this is the real shape of a
      // missing GoogleService-Info.plist on iOS.
      final throwing = AppBootstrap(
        configureAmplifyFn: (_) async {},
        initFirebaseFn: () async => throw StateError('no default app'),
      );
      expect(await throwing.initFirebase(), FirebaseAvailability.unavailable);

      // And a working Firebase reports available.
      final working = AppBootstrap(
        configureAmplifyFn: (_) async {},
        initFirebaseFn: () async => true,
      );
      expect(await working.initFirebase(), FirebaseAvailability.available);
    },
  );

  test('configureAmplify runs once and a second call is a no-op', () async {
    final configuredWith = <String>[];
    final bootstrap = AppBootstrap(
      configureAmplifyFn: (config) async => configuredWith.add(config),
      initFirebaseFn: () async => true,
    );

    expect(bootstrap.amplifyConfigured, isFalse);

    await bootstrap.configureAmplify('{"version":"1"}');
    expect(configuredWith, ['{"version":"1"}']);
    expect(bootstrap.amplifyConfigured, isTrue);

    // `Amplify.configure` throws if called twice (hot restart, a second
    // bootstrap): the guard means the SDK never sees the second call.
    await bootstrap.configureAmplify('{"version":"1"}');
    await bootstrap.configureAmplify('{"version":"2"}');
    expect(configuredWith, [
      '{"version":"1"}',
    ], reason: 'Amplify must be configured exactly once');
  });

  test('a failure to configure Amplify is fatal and propagates', () async {
    // Without Amplify nothing can reach the backend, so this is fail-fast
    // rather than a degraded mode (unlike Firebase above).
    final bootstrap = AppBootstrap(
      configureAmplifyFn: (_) async => throw StateError('bad outputs json'),
      initFirebaseFn: () async => true,
    );

    await expectLater(
      bootstrap.configureAmplify('{}'),
      throwsA(isA<StateError>()),
    );
    // It stayed unconfigured, so a retry is still possible.
    expect(bootstrap.amplifyConfigured, isFalse);
  });
}
