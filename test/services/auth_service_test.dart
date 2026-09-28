/// `AuthService` tests (plan Step 6.1) — Contracts 1 and 2.
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:sarovar_jinalaya/services/auth_service.dart';
import 'package:sarovar_jinalaya/services/gateways.dart';

import '../support/fake_gateways.dart';
import '../support/fixtures.dart';

void main() {
  late FakeAuthGateway gateway;
  late AuthService service;

  setUp(() {
    gateway = FakeAuthGateway();
    service = AuthService(gateway);
  });

  tearDown(() => gateway.close());

  test('currentSession maps a signed-in admin session', () async {
    gateway.setSession(aSession(admin: true, sub: 'admin-1'));

    final session = await service.currentSession();

    expect(session.isSignedIn, isTrue);
    expect(session.sub, 'admin-1');
    expect(session.email, 'devotee@example.test');
    // Contract 2: admin is derived from the cognito:groups claim.
    expect(session.groups, contains('Admin'));
    expect(session.isAdmin, isTrue);
    expect(service.isAdmin(session.groups), isTrue);
    expect(gateway.fetchSessionCount, 1);
  });

  test('a signed-in non-admin is not an admin', () async {
    gateway.setSession(aSession(admin: false));

    final session = await service.currentSession();

    expect(session.isSignedIn, isTrue);
    expect(session.isAdmin, isFalse);
    expect(service.isAdmin(session.groups), isFalse);
    // A group that merely contains "Admin" as a substring is not the Admin group.
    expect(service.isAdmin(const ['Administrators']), isFalse);
    expect(service.isAdmin(const ['Admin']), isTrue);
  });

  test(
    'a signed-out session carries no identity but may carry a guest id',
    () async {
      gateway.setSession(aSession(signedIn: false));

      final session = await service.currentSession();

      expect(session.isSignedIn, isFalse);
      expect(session.sub, isNull);
      expect(session.email, isNull);
      expect(session.isAdmin, isFalse);
      // The guest Identity Pool id survives being signed out — Contract 9 needs it.
      expect(session.identityId, 'ap-south-1:guest-identity-1');
    },
  );

  test(
    'an unreadable session reads as signed out rather than throwing',
    () async {
      gateway.fetchSessionFailure = const AuthGatewayException(
        'keychain locked',
      );

      final session = await service.currentSession();

      expect(session, SessionInfo.signedOut);
      expect(session.isSignedIn, isFalse);
    },
  );

  test('signInWithGoogle succeeds and returns the resolved session', () async {
    gateway.sessionAfterSignIn = aSession(admin: true);

    final session = await service.signInWithGoogle();

    expect(gateway.signInCount, 1);
    expect(session.isSignedIn, isTrue);
    expect(session.isAdmin, isTrue);
  });

  test(
    'a cancelled sign-in throws AuthFailure.cancelled, not an error',
    () async {
      gateway.signInCompletes = false;

      await expectLater(
        service.signInWithGoogle(),
        throwsA(
          isA<AuthFailure>()
              .having((f) => f.kind, 'kind', AuthFailureKind.cancelled)
              .having((f) => f.isCancelled, 'isCancelled', isTrue)
              .having(
                (f) => f.message,
                'message',
                AuthService.cancelledMessage,
              ),
        ),
      );

      // A cancellation reported as a gateway exception maps the same way.
      gateway.signInCompletes = true;
      gateway.signInFailure = const AuthGatewayException(
        'user closed the browser',
        cancelled: true,
      );
      await expectLater(
        service.signInWithGoogle(),
        throwsA(
          isA<AuthFailure>().having(
            (f) => f.kind,
            'kind',
            AuthFailureKind.cancelled,
          ),
        ),
      );
    },
  );

  test('a failed sign-in surfaces plain copy with no raw OAuth text', () async {
    // The raw text a real failure would carry — it must not reach the user.
    const rawOAuth =
        'invalid_grant: AADSTS70008 redirect_uri mismatch at '
        'https://temple.auth.ap-south-1.amazoncognito.com/oauth2/token';
    gateway.signInFailure = const AuthGatewayException(rawOAuth);

    await expectLater(
      service.signInWithGoogle(),
      throwsA(
        isA<AuthFailure>()
            .having((f) => f.kind, 'kind', AuthFailureKind.failed)
            .having(
              (f) => f.message,
              'message',
              AuthService.signInFailedMessage,
            ),
      ),
    );

    // Assert on the absence of the specific leak, not just on equality.
    try {
      await service.signInWithGoogle();
      fail('expected an AuthFailure');
    } on AuthFailure catch (e) {
      expect(e.message, isNot(contains('invalid_grant')));
      expect(e.message, isNot(contains('redirect_uri')));
      expect(e.message, isNot(contains('amazoncognito.com')));
    }
  });

  test(
    'signOut succeeds, and a failure is surfaced for an inline retry',
    () async {
      await service.signOut();
      expect(gateway.signOutCount, 1);

      gateway.signOutFailure = const AuthGatewayException('network blip');
      await expectLater(
        service.signOut(),
        throwsA(
          isA<AuthFailure>()
              .having((f) => f.kind, 'kind', AuthFailureKind.failed)
              .having(
                (f) => f.message,
                'message',
                AuthService.signOutFailedMessage,
              ),
        ),
      );
    },
  );

  test(
    'events passes the gateway stream through for AuthState to listen to',
    () async {
      final seen = <AuthEvent>[];
      final subscription = service.events.listen(seen.add);
      addTearDown(subscription.cancel);

      gateway.emit(AuthEvent.signedIn);
      gateway.emit(AuthEvent.sessionExpired);
      await pumpEventQueue();

      expect(seen, [AuthEvent.signedIn, AuthEvent.sessionExpired]);
    },
  );
}
