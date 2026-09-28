/// `ReminderService` tests (plan Step 6.6) — Contract 9.
///
/// The security-relevant assertion here is that EVERY Contract 9 call uses
/// `AuthMode.identityPool`, signed in or not: that is what keeps reminders on a
/// device guest identity and out of the Google sign-in path (FR7.8, BR7.6).
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:sarovar_jinalaya/models/reminder.dart';
import 'package:sarovar_jinalaya/services/gateways.dart';
import 'package:sarovar_jinalaya/services/reminder_service.dart';

import '../support/fake_gateways.dart';
import '../support/fixtures.dart';

void main() {
  late FakeApiGateway api;
  late FakeAuthGateway auth;
  late FakePushGateway push;
  late ReminderService service;

  setUp(() {
    api = FakeApiGateway();
    auth = FakeAuthGateway(session: aSession(signedIn: false));
    push = FakePushGateway();
    service = ReminderService(api, auth, push);
  });

  tearDown(() async {
    await auth.close();
    await push.close();
  });

  test(
    'every Contract 9 operation uses identityPool, signed in or out',
    () async {
      api.stub('myReminders', [aReminderJson()]);
      api.stub('registerDeviceToken', aDeviceTokenJson());
      api.stub('setRemindersEnabled', aDeviceTokenJson());
      api.stub('snoozeReminder', aReminderJson(status: 'SNOOZED'));
      api.stub('cancelReminder', aReminderJson(status: 'CANCELLED'));

      Future<void> callAll() async {
        await service.myReminders();
        await service.register(
          pushToken: 'fcm-token-abc',
          platform: DevicePlatform.android,
        );
        await service.setEnabled(true);
        await service.snooze('rem-1');
        await service.cancel('rem-1');
      }

      // Signed out.
      await callAll();
      // Signed in — the mode must NOT change to userPool.
      auth.setSession(aSession(signedIn: true, admin: true));
      await callAll();

      expect(api.calls, hasLength(10));
      expect(api.calls.map((c) => c.authMode).toSet(), {
        AuthMode.identityPool,
      }, reason: 'Contract 9 is always identity-pool scoped (FR7.8)');
      expect(api.calls.map((c) => c.field).toSet(), {
        'myReminders',
        'registerDeviceToken',
        'setRemindersEnabled',
        'snoozeReminder',
        'cancelReminder',
      });
    },
  );

  test(
    'register sends {pushToken, platform} with the Contract 9 literals',
    () async {
      api.stub('registerDeviceToken', aDeviceTokenJson(platform: 'IOS'));

      final token = await service.register(
        pushToken: 'fcm-token-xyz',
        platform: DevicePlatform.ios,
      );

      final call = api.callTo('registerDeviceToken');
      expect(call.variables, {'pushToken': 'fcm-token-xyz', 'platform': 'IOS'});
      expect(call.isMutation, isTrue);
      expect(call.document, contains(r'$platform: DevicePlatform!'));
      expect(token.platform, DevicePlatform.ios);
      expect(token.remindersEnabled, isTrue);
    },
  );

  test('setEnabled round-trips the flag in both directions', () async {
    api.stub('setRemindersEnabled', aDeviceTokenJson(remindersEnabled: false));
    var token = await service.setEnabled(false);
    expect(api.lastCall.variables, {'enabled': false});
    expect(token.remindersEnabled, isFalse);

    api.stub('setRemindersEnabled', aDeviceTokenJson(remindersEnabled: true));
    token = await service.setEnabled(true);
    expect(api.lastCall.variables, {'enabled': true});
    expect(token.remindersEnabled, isTrue);
    expect(api.lastCall.document, contains(r'$enabled: Boolean!'));
  });

  test('myReminders parses every status and takes no arguments', () async {
    api.stub('myReminders', [
      aReminderJson(id: 'r-1', postId: 'p-1', status: 'SCHEDULED'),
      aReminderJson(
        id: 'r-2',
        postId: 'p-2',
        status: 'SNOOZED',
        snoozeFireAt: DateTime.utc(2026, 3, 8, 15, 30),
      ),
      aReminderJson(id: 'r-3', postId: 'p-3', status: 'CLEARED'),
    ]);

    final reminders = await service.myReminders();

    expect(reminders.map((r) => r.status), [
      ReminderStatus.scheduled,
      ReminderStatus.snoozed,
      ReminderStatus.cleared,
    ]);
    expect(reminders[1].snoozeFireAt, DateTime.utc(2026, 3, 8, 15, 30));
    expect(reminders.where((r) => r.isActive).map((r) => r.id), ['r-1', 'r-2']);
    expect(api.callTo('myReminders').variables, isEmpty);
    expect(api.callTo('myReminders').isMutation, isFalse);
  });

  test(
    'permission denied means no token read and no registration attempt',
    () async {
      push.permissionGranted = false;

      final result = await service.requestPermissionAndToken();

      expect(result.permissionGranted, isFalse);
      expect(result.registered, isFalse);
      expect(push.requestPermissionCount, 1);
      // Neither the token nor the mutation is reached.
      expect(push.getTokenCount, 0);
      expect(api.countOf('registerDeviceToken'), 0);
    },
  );

  test('permission granted but no token available registers nothing', () async {
    push.permissionGranted = true;
    push.token = null;

    final result = await service.requestPermissionAndToken();

    expect(result.permissionGranted, isTrue);
    expect(result.registered, isFalse);
    expect(api.countOf('registerDeviceToken'), 0);

    // An empty token string is treated the same way.
    push.token = '';
    expect((await service.requestPermissionAndToken()).registered, isFalse);
    expect(api.countOf('registerDeviceToken'), 0);
  });

  test(
    'a failed registration is silent and retried on the next attempt',
    () async {
      // functional-spec.md: a background registration failure shows no error.
      api.stubTransportFailure('registerDeviceToken');

      final first = await service.requestPermissionAndToken();
      expect(first.permissionGranted, isTrue);
      expect(first.registered, isFalse);
      expect(api.countOf('registerDeviceToken'), 1);

      // Next visit: the server is back, and the same call now succeeds.
      api.failures.clear();
      api.stub('registerDeviceToken', aDeviceTokenJson());
      final second = await service.requestPermissionAndToken();
      expect(second.registered, isTrue);
      expect(second.platform, DevicePlatform.android);
      expect(api.countOf('registerDeviceToken'), 2);
    },
  );

  test('a token refresh is surfaced so the device can re-register', () async {
    api.stub('registerDeviceToken', aDeviceTokenJson());
    final rotated = <String>[];
    final subscription = service.onTokenRefresh.listen(rotated.add);
    addTearDown(subscription.cancel);

    push.rotateToken('fcm-token-rotated');
    await pumpEventQueue();

    expect(rotated, ['fcm-token-rotated']);

    // Re-registering with the new token sends the new value, not the old one.
    await service.register(
      pushToken: rotated.single,
      platform: DevicePlatform.android,
    );
    expect(
      api.callTo('registerDeviceToken').variables['pushToken'],
      'fcm-token-rotated',
    );
  });

  test('a platform Contract 9 does not model registers nothing', () async {
    push.platform = 'MACOS';

    expect(service.platform, isNull);
    final result = await service.requestPermissionAndToken();

    expect(result.permissionGranted, isTrue);
    expect(result.registered, isFalse);
    expect(api.countOf('registerDeviceToken'), 0);
  });

  test(
    'a snooze past the BR7.3 cutoff becomes ReminderFailure.cutoffPassed',
    () async {
      api.stubRefusal(
        'snoozeReminder',
        'It is too late to snooze: the 9:00 PM IST cutoff has passed.',
      );

      await expectLater(
        service.snooze('rem-1'),
        throwsA(
          isA<ReminderFailure>()
              .having((f) => f.kind, 'kind', ReminderFailureKind.cutoffPassed)
              // The server's own wording is preserved, not replaced.
              .having((f) => f.message, 'message', contains('9:00 PM IST')),
        ),
      );
    },
  );

  test('other reminder refusals and failures map to their own kinds', () async {
    api.stubRefusal('cancelReminder', 'That reminder was not found.');
    await expectLater(
      service.cancel('rem-x'),
      throwsA(
        isA<ReminderFailure>().having(
          (f) => f.kind,
          'kind',
          ReminderFailureKind.notYours,
        ),
      ),
    );

    api.failures.clear();
    api.calls.clear();
    api.stubTransportFailure('snoozeReminder');
    await expectLater(
      service.snooze('rem-1'),
      throwsA(
        isA<ReminderFailure>()
            .having((f) => f.kind, 'kind', ReminderFailureKind.network)
            .having(
              (f) => f.message,
              'message',
              ReminderService.networkMessage,
            ),
      ),
    );

    // A malformed success response is also a ReminderFailure, not a raw error.
    api.failures.clear();
    api.calls.clear();
    api.stub('cancelReminder', 'not-an-object');
    await expectLater(service.cancel('rem-1'), throwsA(isA<ReminderFailure>()));
  });

  test('the identity id is resolved while signed out, and again after sign-in', () async {
    // Signed out: the GUEST identity id is what Contract 9 is scoped by.
    expect(await service.resolveIdentity(), 'ap-south-1:guest-identity-1');

    // Signed in: Amplify issues a DIFFERENT identity id (plan rule 4), which is
    // exactly why DeviceIdentityState re-syncs when it changes.
    auth.setSession(
      aSession(signedIn: true, identityId: 'ap-south-1:auth-identity-9'),
    );
    expect(await service.resolveIdentity(), 'ap-south-1:auth-identity-9');

    // Unresolvable (offline on a first-ever launch) is null, not a throw.
    auth.fetchSessionFailure = const AuthGatewayException('no network');
    expect(await service.resolveIdentity(), isNull);
  });
}
