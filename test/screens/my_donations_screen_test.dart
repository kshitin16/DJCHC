/// My Donations screen tests (plan Step 10.7).
library;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sarovar_jinalaya/models/donation.dart';
import 'package:sarovar_jinalaya/screens/my_donations_screen.dart';
import 'package:sarovar_jinalaya/services/gateways.dart';
import 'package:sarovar_jinalaya/widgets/confirm_destructive_action_dialog.dart';
import 'package:sarovar_jinalaya/widgets/list_items.dart';
import 'package:sarovar_jinalaya/widgets/state_widgets.dart';

import '../support/fake_services.dart';
import '../support/fixtures.dart';
import '../support/pump_app.dart';

void main() {
  late FakeDonationService donations;

  setUp(() => donations = FakeDonationService());

  Widget screen() =>
      MyDonationsScreen(donationService: donations, strings: stringsFor());

  testWidgets('renders each donation with its amount, type and status', (
    tester,
  ) async {
    donations.donations = [
      aDonation(id: 'd-1', amount: 501, status: DonationStatus.succeeded),
      aDonation(id: 'd-2', amount: 101, status: DonationStatus.pending),
      aDonation(id: 'd-3', amount: 251, status: DonationStatus.failed),
      aDonation(id: 'd-4', amount: 51, status: DonationStatus.cancelled),
    ];

    await pumpAppAndSettle(tester, screen());

    expect(find.byType(DonationListItem), findsNWidgets(4));
    expect(find.text('₹501.00'), findsOneWidget);
    expect(find.text('Successful'), findsOneWidget);
    expect(find.text('Pending'), findsOneWidget);
    expect(find.text('Failed'), findsOneWidget);
    expect(find.text('Cancelled'), findsOneWidget);
    // The subtitle is one line: "One-time · 1 Mar 2026".
    expect(find.textContaining('One-time · '), findsNWidgets(4));
    expect(find.textContaining('1 Mar 2026'), findsNWidgets(4));
  });

  testWidgets('Cancel is offered only for a SUCCEEDED RECURRING donation', (
    tester,
  ) async {
    donations.donations = [
      // The one and only cancellable shape (BR5.6).
      aDonation(
        id: 'd-cancellable',
        donationType: DonationType.recurring,
        frequency: DonationFrequency.monthly,
        status: DonationStatus.succeeded,
      ),
      // Wrong on exactly one axis each.
      aDonation(
        id: 'd-onetime',
        donationType: DonationType.oneTime,
        status: DonationStatus.succeeded,
      ),
      aDonation(
        id: 'd-pending',
        donationType: DonationType.recurring,
        frequency: DonationFrequency.monthly,
        status: DonationStatus.pending,
      ),
      aDonation(
        id: 'd-already',
        donationType: DonationType.recurring,
        frequency: DonationFrequency.monthly,
        status: DonationStatus.cancelled,
      ),
    ];

    await pumpAppAndSettle(tester, screen());

    expect(
      find.byKey(DonationListItem.cancelKeyFor('d-cancellable')),
      findsOneWidget,
    );
    for (final id in const ['d-onetime', 'd-pending', 'd-already']) {
      expect(
        find.byKey(DonationListItem.cancelKeyFor(id)),
        findsNothing,
        reason: 'Cancel must not be offered for $id',
      );
    }
  });

  testWidgets('Cancel requires confirmation before calling the service', (
    tester,
  ) async {
    donations.donations = [
      aDonation(
        id: 'd-1',
        donationType: DonationType.recurring,
        frequency: DonationFrequency.monthly,
        status: DonationStatus.succeeded,
      ),
    ];
    donations.cancelled = aDonation(
      id: 'd-1',
      donationType: DonationType.recurring,
      frequency: DonationFrequency.monthly,
      status: DonationStatus.cancelled,
    );

    await pumpAppAndSettle(tester, screen());

    // Backing out does not cancel.
    await tester.tap(find.byKey(DonationListItem.cancelKeyFor('d-1')));
    await tester.pumpAndSettle();
    expect(
      find.textContaining('No further payments will be taken.'),
      findsOneWidget,
    );
    await tester.tap(find.byKey(ConfirmDestructiveActionDialog.cancelKey));
    await tester.pumpAndSettle();
    expect(donations.cancelledId, isNull);

    // Confirming does.
    donations.donations = [donations.cancelled!];
    await tester.tap(find.byKey(DonationListItem.cancelKeyFor('d-1')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(ConfirmDestructiveActionDialog.confirmKey));
    await tester.pumpAndSettle();

    expect(donations.cancelledId, 'd-1');
    expect(donations.log.countOf('myDonations'), 2);
    // The list reloaded and now shows it cancelled, with no Cancel action.
    expect(find.text('Cancelled'), findsOneWidget);
    expect(find.byKey(DonationListItem.cancelKeyFor('d-1')), findsNothing);
  });

  testWidgets('a refused cancellation shows inline and leaves it active', (
    tester,
  ) async {
    donations.donations = [
      aDonation(
        id: 'd-1',
        donationType: DonationType.recurring,
        frequency: DonationFrequency.monthly,
        status: DonationStatus.succeeded,
      ),
    ];
    donations.cancelFailure = const ApiException(
      'This donation is not an active recurring donation.',
    );

    await pumpAppAndSettle(tester, screen());
    await tester.tap(find.byKey(DonationListItem.cancelKeyFor('d-1')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(ConfirmDestructiveActionDialog.confirmKey));
    await tester.pumpAndSettle();

    expect(find.byKey(MyDonationsScreen.actionErrorKey), findsOneWidget);
    expect(
      find.text('This donation is not an active recurring donation.'),
      findsOneWidget,
    );
    // The donation remains active until cancellation actually succeeds.
    expect(find.text('Successful'), findsOneWidget);
    expect(find.byKey(DonationListItem.cancelKeyFor('d-1')), findsOneWidget);
  });

  testWidgets('no donations yet shows the empty state, and a failure retries', (
    tester,
  ) async {
    donations.donations = const [];
    await pumpAppAndSettle(tester, screen());
    expect(find.text('You have not made any donations yet.'), findsOneWidget);
    expect(find.byType(ErrorState), findsNothing);

    donations.listFailure = const ApiException.transport('Offline.');
    await tester.pumpWidget(const SizedBox.shrink());
    await pumpAppAndSettle(tester, screen());
    expect(find.text('Offline.'), findsOneWidget);

    donations.listFailure = null;
    donations.donations = [aDonation(id: 'd-1')];
    await tester.tap(find.byKey(MyDonationsScreen.retryKey));
    await tester.pumpAndSettle();
    expect(find.byType(DonationListItem), findsOneWidget);
  });
}
