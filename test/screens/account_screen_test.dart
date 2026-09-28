/// Account screen tests (plan Step 10.5).
library;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sarovar_jinalaya/l10n/app_strings.dart';
import 'package:sarovar_jinalaya/screens/account_screen.dart';
import 'package:sarovar_jinalaya/services/auth_service.dart';
import 'package:sarovar_jinalaya/services/gateways.dart';
import 'package:sarovar_jinalaya/state/auth_state.dart';
import 'package:sarovar_jinalaya/state/device_identity_state.dart';
import 'package:sarovar_jinalaya/state/localization_controller.dart';
import 'package:sarovar_jinalaya/widgets/bottom_nav_bar.dart';

import '../support/fake_gateways.dart';
import '../support/fake_services.dart';
import '../support/fixtures.dart';
import '../support/pump_app.dart';

void main() {
  late FakeAuthGateway authGateway;
  late AuthState authState;
  late FakeReminderService reminders;
  late DeviceIdentityState deviceIdentity;
  late LocalizationController strings;

  setUp(() async {
    authGateway = FakeAuthGateway(
      session: aSession(signedIn: true, email: 'devotee@example.test'),
    );
    authState = AuthState(AuthService(authGateway));
    await authState.refresh();
    reminders = FakeReminderService();
    deviceIdentity = DeviceIdentityState(reminders);
    strings = stringsFor();
  });

  tearDown(() async {
    authState.dispose();
    deviceIdentity.dispose();
    await authGateway.close();
  });

  Widget screen({VoidCallback? onSignedOut}) => AccountScreen(
    authState: authState,
    deviceIdentity: deviceIdentity,
    strings: strings,
    onSignedOut: onSignedOut,
  );

  testWidgets('shows the signed-in email from the ID token', (tester) async {
    await pumpAppAndSettle(tester, screen(), strings: strings);

    expect(find.byKey(AccountScreen.emailKey), findsOneWidget);
    expect(find.text('devotee@example.test'), findsOneWidget);
    // No query was needed — the identity came from AuthState (Contract 1).
    expect(reminders.log.isEmpty, isTrue);
  });

  testWidgets('the language toggle switches every string on screen', (
    tester,
  ) async {
    await pumpAppAndSettle(
      tester,
      const SizedBox.shrink(),
      strings: strings,
      builder: (_) => screen(),
    );

    expect(find.text('Account'), findsOneWidget);
    expect(find.text('Sign Out'), findsOneWidget);

    await tester.tap(find.byKey(LanguageToggle.hindiKey));
    await tester.pumpAndSettle();

    expect(strings.languageCode, AppLanguages.hindi);
    expect(find.text('खाता'), findsOneWidget);
    expect(find.text('साइन आउट करें'), findsOneWidget);
    expect(find.text('Sign Out'), findsNothing);
  });

  testWidgets('the reminders toggle calls Contract 9 and reflects the result', (
    tester,
  ) async {
    await pumpAppAndSettle(tester, screen(), strings: strings);

    // BR7.1's default is on.
    expect(
      tester
          .widget<SwitchListTile>(find.byKey(RemindersToggle.switchKey))
          .value,
      isTrue,
    );

    await tester.tap(find.byKey(RemindersToggle.switchKey));
    await tester.pumpAndSettle();

    expect(reminders.lastSetEnabled, isFalse);
    expect(deviceIdentity.remindersEnabled, isFalse);
    expect(
      tester
          .widget<SwitchListTile>(find.byKey(RemindersToggle.switchKey))
          .value,
      isFalse,
    );
  });

  testWidgets(
    'a failed reminders toggle shows an inline error and does not flip',
    (tester) async {
      reminders.setEnabledFailure = const ApiException.transport(
        'Could not reach the server.',
      );
      await pumpAppAndSettle(tester, screen(), strings: strings);

      await tester.tap(find.byKey(RemindersToggle.switchKey));
      await tester.pumpAndSettle();

      expect(find.byKey(AccountScreen.remindersErrorKey), findsOneWidget);
      expect(find.text('Could not reach the server.'), findsOneWidget);
      // The UI never shows a state the backend does not hold.
      expect(deviceIdentity.remindersEnabled, isTrue);
      expect(
        tester
            .widget<SwitchListTile>(find.byKey(RemindersToggle.switchKey))
            .value,
        isTrue,
      );
    },
  );

  testWidgets('signing out clears the session and notifies the shell', (
    tester,
  ) async {
    var signedOut = 0;
    await pumpAppAndSettle(
      tester,
      screen(onSignedOut: () => signedOut++),
      strings: strings,
    );

    await tester.tap(find.byKey(AccountScreen.signOutKey));
    await tester.pumpAndSettle();

    expect(authGateway.signOutCount, 1);
    expect(authState.isSignedIn, isFalse);
    expect(signedOut, 1);
    expect(find.byKey(AccountScreen.signOutErrorKey), findsNothing);
  });

  testWidgets('a failed sign-out shows an inline error and keeps the session', (
    tester,
  ) async {
    authGateway.signOutFailure = const AuthGatewayException('network blip');
    var signedOut = 0;
    await pumpAppAndSettle(
      tester,
      screen(onSignedOut: () => signedOut++),
      strings: strings,
    );

    await tester.tap(find.byKey(AccountScreen.signOutKey));
    await tester.pumpAndSettle();

    expect(find.byKey(AccountScreen.signOutErrorKey), findsOneWidget);
    expect(find.text(AuthService.signOutFailedMessage), findsOneWidget);
    // Still signed in until sign-out actually succeeds.
    expect(authState.isSignedIn, isTrue);
    expect(signedOut, 0);
  });
}
