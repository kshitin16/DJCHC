/// Donate screen tests (plan Step 10.7) — flagged off in the first release but
/// fully built and tested.
library;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sarovar_jinalaya/models/donation.dart';
import 'package:sarovar_jinalaya/screens/donate_screen.dart';
import 'package:sarovar_jinalaya/services/gateways.dart';

import '../support/fake_services.dart';
import '../support/pump_app.dart';

void main() {
  late FakeDonationService donations;
  late FakeUrlLauncher launcher;

  setUp(() {
    final log = CallLog();
    donations = FakeDonationService(log: log)
      ..initiation = const DonationInitiation(
        donationId: 'don-1',
        checkoutUrl: 'https://pay.example.test/checkout/abc',
        checkoutReference: 'ref-abc',
      );
    launcher = FakeUrlLauncher(log: log);
  });

  Widget screen() => DonateScreen(
    donationService: donations,
    strings: stringsFor(),
    launchUrl: launcher.call,
  );

  testWidgets('a non-positive amount is refused locally, with no call made', (
    tester,
  ) async {
    await pumpAppAndSettle(tester, screen());

    for (final amount in const ['', '0', '-100', 'abc']) {
      await tester.enterText(find.byKey(DonateScreen.amountKey), amount);
      await tester.tap(find.byKey(DonateScreen.submitKey));
      await tester.pumpAndSettle();
      expect(
        find.text('Please enter an amount greater than zero.'),
        findsOneWidget,
        reason: 'amount "$amount"',
      );
    }
    // No donation was ever initiated and no browser opened.
    expect(donations.log.of('initiate'), isEmpty);
    expect(launcher.launched, isEmpty);
  });

  testWidgets('the frequency picker appears only for a RECURRING donation', (
    tester,
  ) async {
    await pumpAppAndSettle(tester, screen());

    expect(find.byKey(DonateScreen.frequencyKey), findsNothing);

    await tester.tap(find.byKey(DonateScreen.typeKey));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Recurring').last);
    await tester.pumpAndSettle();

    expect(find.byKey(DonateScreen.frequencyKey), findsOneWidget);

    // Switching back hides it again.
    await tester.tap(find.byKey(DonateScreen.typeKey));
    await tester.pumpAndSettle();
    await tester.tap(find.text('One-time').last);
    await tester.pumpAndSettle();
    expect(find.byKey(DonateScreen.frequencyKey), findsNothing);
  });

  testWidgets('a one-time donation initiates and hands off to the browser', (
    tester,
  ) async {
    await pumpAppAndSettle(tester, screen());

    await tester.enterText(find.byKey(DonateScreen.amountKey), '501');
    await tester.tap(find.byKey(DonateScreen.submitKey));
    await tester.pumpAndSettle();

    expect(donations.lastAmount, 501.0);
    expect(donations.lastType, DonationType.oneTime);
    // No frequency for a one-time donation.
    expect(donations.lastFrequency, isNull);
    // The hand-off happens AFTER the initiation, never before.
    expect(donations.log.entries, ['initiate', 'launchUrl']);
    expect(
      launcher.launched.single.toString(),
      'https://pay.example.test/checkout/abc',
    );
    expect(find.byKey(DonateScreen.errorKey), findsNothing);
  });

  testWidgets('a recurring donation passes its frequency through', (
    tester,
  ) async {
    await pumpAppAndSettle(tester, screen());

    await tester.enterText(find.byKey(DonateScreen.amountKey), '1100.50');
    await tester.tap(find.byKey(DonateScreen.typeKey));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Recurring').last);
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(DonateScreen.frequencyKey));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Quarterly').last);
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(DonateScreen.submitKey));
    await tester.pumpAndSettle();

    expect(donations.lastAmount, 1100.5);
    expect(donations.lastType, DonationType.recurring);
    expect(donations.lastFrequency, DonationFrequency.quarterly);
  });

  testWidgets(
    'a failed initiation shows the server message and opens nothing',
    (tester) async {
      donations.initiateFailure = const ApiException.transport(
        'Could not reach the server.',
      );
      await pumpAppAndSettle(tester, screen());

      await tester.enterText(find.byKey(DonateScreen.amountKey), '501');
      await tester.tap(find.byKey(DonateScreen.submitKey));
      await tester.pumpAndSettle();

      expect(find.byKey(DonateScreen.errorKey), findsOneWidget);
      expect(find.text('Could not reach the server.'), findsOneWidget);
      // No charge was attempted: the browser never opened.
      expect(launcher.launched, isEmpty);
    },
  );

  testWidgets(
    'a browser that refuses to open is reported without inferring an outcome',
    (tester) async {
      launcher.succeeds = false;
      await pumpAppAndSettle(tester, screen());

      await tester.enterText(find.byKey(DonateScreen.amountKey), '251');
      await tester.tap(find.byKey(DonateScreen.submitKey));
      await tester.pumpAndSettle();

      expect(
        find.text('Could not open the payment page. Please try again.'),
        findsOneWidget,
      );
      // The donation WAS initiated server-side; this screen never claims it
      // succeeded or failed — that is Contract 7's webhook's job.
      expect(donations.log.of('initiate'), hasLength(1));
    },
  );
}
