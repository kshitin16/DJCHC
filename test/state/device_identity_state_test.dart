/// `DeviceIdentityState` tests (plan Step 8.3) — FR7.8.
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:sarovar_jinalaya/services/gateways.dart';
import 'package:sarovar_jinalaya/services/reminder_service.dart';
import 'package:sarovar_jinalaya/state/device_identity_state.dart';

import '../support/fake_gateways.dart';
import '../support/fixtures.dart';

void main() {
  late FakeApiGateway api;
  late FakeAuthGateway auth;
  late FakePushGateway push;
  late DeviceIdentityState state;
  late int notifications;

  setUp(() {
    api = FakeApiGateway();
    auth = FakeAuthGateway(session: aSession(signedIn: false));
    push = FakePushGateway();
    state = DeviceIdentityState(ReminderService(api, auth, push));
    notifications = 0;
    state.addListener(() => notifications++);
  });

  tearDown(() async {
    state.dispose();
    await auth.close();
    await push.close();
  });

  test('the identity resolves once and notifies only on a change', () async {
    expect(state.isResolved, isFalse);
    expect(state.identityId, isNull);

    final first = await state.ensureResolved();

    expect(first, 'ap-south-1:guest-identity-1');
    expect(state.isResolved, isTrue);
    expect(notifications, 1);

    // A second visit re-reads the session (so a sign-in is picked up) but does
    // NOT notify when the id is unchanged.
    await state.ensureResolved();
    expect(auth.fetchSessionCount, 2);
    expect(notifications, 1);
  });

  test(
    'an identity change notifies and clears the registration flag',
    () async {
      api.stub('registerDeviceToken', aDeviceTokenJson());
      await state.ensureResolved();
      await state.ensureRegistered();
      expect(state.registered, isTrue);
      final before = notifications;

      // Signing in gives Amplify's Identity Pool a DIFFERENT id (plan rule 4) —
      // Calendar's cue to re-sync.
      auth.setSession(
        aSession(signedIn: true, identityId: 'ap-south-1:auth-identity-9'),
      );
      final resolved = await state.ensureResolved();

      expect(resolved, 'ap-south-1:auth-identity-9');
      expect(notifications, greaterThan(before));
      expect(
        state.registered,
        isFalse,
        reason: 'the new identity has its own DeviceToken',
      );
    },
  );

  test(
    'an unresolvable identity keeps the last known value and never throws',
    () async {
      auth.fetchSessionFailure = const AuthGatewayException('offline');

      expect(await state.ensureResolved(), isNull);
      expect(state.isResolved, isFalse);
      expect(notifications, 0);

      // Once it resolves, a later failure does not wipe the known id.
      auth.fetchSessionFailure = null;
      await state.ensureResolved();
      expect(state.identityId, 'ap-south-1:guest-identity-1');

      auth.fetchSessionFailure = const AuthGatewayException('offline again');
      expect(await state.ensureResolved(), 'ap-south-1:guest-identity-1');
    },
  );

  test(
    'permission denied is recorded without a registration attempt',
    () async {
      push.permissionGranted = false;

      await state.ensureRegistered();

      expect(state.permissionRequested, isTrue);
      expect(state.permissionGranted, isFalse);
      expect(state.registered, isFalse);
      expect(api.countOf('registerDeviceToken'), 0);
    },
  );

  test(
    'a failed registration is retried on the next call, without throwing',
    () async {
      api.stubTransportFailure('registerDeviceToken');

      await state.ensureRegistered();
      expect(state.permissionGranted, isTrue);
      expect(state.registered, isFalse);
      expect(api.countOf('registerDeviceToken'), 1);

      // Next Calendar visit: it tries again rather than giving up.
      api.failures.clear();
      api.stub('registerDeviceToken', aDeviceTokenJson());
      await state.ensureRegistered();
      expect(state.registered, isTrue);
      expect(api.countOf('registerDeviceToken'), 2);

      // Once registered it stops re-registering on every visit.
      await state.ensureRegistered();
      expect(api.countOf('registerDeviceToken'), 2);
    },
  );

  test(
    'the reminders toggle round-trips through the server, not optimistically',
    () async {
      expect(state.remindersEnabled, isTrue, reason: 'BR7.1 default is on');

      api.stub(
        'setRemindersEnabled',
        aDeviceTokenJson(remindersEnabled: false),
      );
      await state.setRemindersEnabled(false);
      expect(state.remindersEnabled, isFalse);
      expect(api.callTo('setRemindersEnabled').variables, {'enabled': false});

      api.calls.clear();
      api.stub('setRemindersEnabled', aDeviceTokenJson(remindersEnabled: true));
      await state.setRemindersEnabled(true);
      expect(state.remindersEnabled, isTrue);

      // A failure rethrows for an inline error AND leaves the local flag alone, so
      // the UI never shows a state the backend does not hold.
      api.calls.clear();
      api.stubTransportFailure('setRemindersEnabled');
      await expectLater(
        state.setRemindersEnabled(false),
        throwsA(isA<ApiException>()),
      );
      expect(state.remindersEnabled, isTrue);
    },
  );
}
