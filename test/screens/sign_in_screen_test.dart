/// Sign In screen tests (plan Step 10.3).
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:sarovar_jinalaya/screens/sign_in_screen.dart';
import 'package:sarovar_jinalaya/services/auth_service.dart';
import 'package:sarovar_jinalaya/services/gateways.dart';
import 'package:sarovar_jinalaya/state/auth_state.dart';

import '../support/fake_gateways.dart';
import '../support/fixtures.dart';
import '../support/pump_app.dart';

void main() {
  late FakeAuthGateway gateway;
  late AuthState authState;

  setUp(() {
    gateway = FakeAuthGateway(session: aSession(signedIn: false));
    authState = AuthState(AuthService(gateway));
  });

  tearDown(() async {
    authState.dispose();
    await gateway.close();
  });

  SignInScreen screen({void Function()? onSignedIn, bool showNotice = false}) =>
      SignInScreen(
        authState: authState,
        strings: stringsFor(),
        onSignedIn: onSignedIn,
        showSignInRequiredNotice: showNotice,
      );

  testWidgets('tapping Continue with Google runs the sign-in flow', (
    tester,
  ) async {
    var returned = 0;
    await pumpAppAndSettle(tester, screen(onSignedIn: () => returned++));

    expect(find.byKey(SignInScreen.googleButtonKey), findsOneWidget);
    await tester.tap(find.byKey(SignInScreen.googleButtonKey));
    await tester.pumpAndSettle();

    expect(gateway.signInCount, 1);
    expect(authState.isSignedIn, isTrue);
    // Success returns the user to the route they were headed to.
    expect(returned, 1);
    expect(find.byKey(SignInScreen.errorKey), findsNothing);
  });

  testWidgets(
    'a cancelled sign-in shows cancellation copy and does not return',
    (tester) async {
      gateway.signInCompletes = false;
      var returned = 0;
      await pumpAppAndSettle(tester, screen(onSignedIn: () => returned++));

      await tester.tap(find.byKey(SignInScreen.googleButtonKey));
      await tester.pumpAndSettle();

      expect(find.byKey(SignInScreen.errorKey), findsOneWidget);
      expect(find.text(AuthService.cancelledMessage), findsOneWidget);
      expect(authState.isSignedIn, isFalse);
      expect(returned, 0);

      // The button is usable again for a retry.
      gateway.signInCompletes = true;
      await tester.tap(find.byKey(SignInScreen.googleButtonKey));
      await tester.pumpAndSettle();
      expect(authState.isSignedIn, isTrue);
      expect(returned, 1);
    },
  );

  testWidgets('a failed sign-in shows no raw OAuth text', (tester) async {
    const rawOAuth =
        'invalid_grant: redirect_uri mismatch at '
        'https://temple.auth.ap-south-1.amazoncognito.com/oauth2/token';
    gateway.signInFailure = const AuthGatewayException(rawOAuth);

    await pumpAppAndSettle(tester, screen());
    await tester.tap(find.byKey(SignInScreen.googleButtonKey));
    await tester.pumpAndSettle();

    expect(find.text(AuthService.signInFailedMessage), findsOneWidget);
    // The leak assertions, not just the equality.
    expect(find.textContaining('invalid_grant'), findsNothing);
    expect(find.textContaining('redirect_uri'), findsNothing);
    expect(find.textContaining('amazoncognito.com'), findsNothing);
    expect(find.textContaining('oauth2'), findsNothing);
  });

  testWidgets('arriving from a gated screen adds the sign-in-required notice', (
    tester,
  ) async {
    await pumpAppAndSettle(tester, screen(showNotice: true));
    expect(find.byKey(SignInScreen.noticeKey), findsOneWidget);
    expect(find.text('Please sign in to continue.'), findsOneWidget);
  });

  testWidgets('arriving directly shows no notice', (tester) async {
    await pumpAppAndSettle(tester, screen());
    expect(find.byKey(SignInScreen.noticeKey), findsNothing);
    expect(find.text('Continue with Google'), findsOneWidget);
  });
}
