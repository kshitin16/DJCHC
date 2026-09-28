/// `AuthState` tests (plan Step 8.1).
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:sarovar_jinalaya/services/auth_service.dart';
import 'package:sarovar_jinalaya/services/gateways.dart';
import 'package:sarovar_jinalaya/state/auth_state.dart';

import '../support/fake_gateways.dart';
import '../support/fixtures.dart';

void main() {
  late FakeAuthGateway gateway;
  late AuthState state;
  late int notifications;

  setUp(() {
    gateway = FakeAuthGateway(session: aSession(signedIn: false));
    state = AuthState(AuthService(gateway));
    notifications = 0;
    state.addListener(() => notifications++);
  });

  tearDown(() async {
    state.dispose();
    await gateway.close();
  });

  test('starts signed out and unresolved before the first refresh', () {
    expect(state.isSignedIn, isFalse);
    expect(state.isAdmin, isFalse);
    expect(state.sub, isNull);
    expect(state.email, isNull);
    expect(state.isResolved, isFalse);
    expect(notifications, 0);
  });

  test(
    'refresh maps the session onto the notifier and marks it resolved',
    () async {
      gateway.setSession(aSession(sub: 'user-42', email: 'a@b.test'));

      await state.refresh();

      expect(state.isResolved, isTrue);
      expect(state.isSignedIn, isTrue);
      expect(state.sub, 'user-42');
      expect(state.email, 'a@b.test');
      expect(state.isAdmin, isFalse);
      expect(notifications, 1);
    },
  );

  test('isAdmin is derived from the cognito:groups claim', () async {
    gateway.setSession(aSession(admin: true));
    await state.refresh();
    expect(state.isAdmin, isTrue);
    expect(state.session.groups, contains('Admin'));

    // Losing the group on the next refresh removes admin status.
    gateway.setSession(aSession(admin: false));
    await state.refresh();
    expect(state.isAdmin, isFalse);
  });

  test('signIn adopts the new session and notifies', () async {
    gateway.sessionAfterSignIn = aSession(sub: 'user-9', admin: true);

    await state.signIn();

    expect(state.isSignedIn, isTrue);
    expect(state.sub, 'user-9');
    expect(state.isAdmin, isTrue);
    expect(state.isResolved, isTrue);
    expect(notifications, 1);
    expect(gateway.signInCount, 1);
  });

  test(
    'a cancelled or failed signIn rethrows and leaves the state untouched',
    () async {
      gateway.signInCompletes = false;

      await expectLater(state.signIn(), throwsA(isA<AuthFailure>()));

      expect(state.isSignedIn, isFalse);
      expect(state.sub, isNull);
      expect(notifications, 0, reason: 'a failed sign-in changes nothing');
    },
  );

  test(
    'signOut clears the identity; a failed signOut keeps the user signed in',
    () async {
      gateway.setSession(aSession(admin: true));
      await state.refresh();
      expect(state.isSignedIn, isTrue);

      // A failure must NOT optimistically sign the user out locally.
      gateway.signOutFailure = const AuthGatewayException('network blip');
      await expectLater(state.signOut(), throwsA(isA<AuthFailure>()));
      expect(state.isSignedIn, isTrue);
      expect(state.isAdmin, isTrue);

      gateway.signOutFailure = null;
      await state.signOut();
      expect(state.isSignedIn, isFalse);
      expect(state.sub, isNull);
      expect(state.email, isNull);
      expect(state.isAdmin, isFalse);
    },
  );

  test('a gateway auth event triggers a refresh', () async {
    // This is how a hosted-UI sign-in that completed through the custom URL
    // scheme reaches the app: Amplify's Hub, not a return value.
    gateway.setSession(aSession(sub: 'user-hub', admin: true));

    gateway.emit(AuthEvent.signedIn);
    await pumpEventQueue();

    expect(state.isSignedIn, isTrue);
    expect(state.sub, 'user-hub');
    expect(state.isAdmin, isTrue);
    expect(gateway.fetchSessionCount, 1);

    // A session-expired event re-resolves too, and finds a signed-out session.
    gateway.setSession(aSession(signedIn: false));
    gateway.emit(AuthEvent.sessionExpired);
    await pumpEventQueue();

    expect(state.isSignedIn, isFalse);
    expect(gateway.fetchSessionCount, 2);
  });
}
