/// `DonationService` tests (plan Step 6.4) — Contract 5.
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:sarovar_jinalaya/models/donation.dart';
import 'package:sarovar_jinalaya/services/donation_service.dart';
import 'package:sarovar_jinalaya/services/gateways.dart';

import '../support/fake_gateways.dart';
import '../support/fixtures.dart';

void main() {
  late FakeApiGateway api;
  late DonationService service;

  setUp(() {
    api = FakeApiGateway();
    service = DonationService(api);
  });

  test('a ONE_TIME donation omits frequency from the variables entirely', () async {
    api.stub('initiateDonation', aDonationInitiationJson());

    await service.initiate(amount: 501, donationType: DonationType.oneTime);

    final variables = api.callTo('initiateDonation').variables;
    expect(variables, {'amount': 501.0, 'donationType': 'ONE_TIME'});
    // Not merely null — absent, so AppSync never sees a meaningless frequency.
    expect(variables.containsKey('frequency'), isFalse);

    // A frequency passed alongside ONE_TIME is still dropped: the donation type
    // decides, not the caller's leftover picker state.
    api.calls.clear();
    await service.initiate(
      amount: 101,
      donationType: DonationType.oneTime,
      frequency: DonationFrequency.monthly,
    );
    expect(
      api.callTo('initiateDonation').variables.containsKey('frequency'),
      isFalse,
    );
  });

  test('a RECURRING donation includes frequency', () async {
    api.stub('initiateDonation', aDonationInitiationJson());

    await service.initiate(
      amount: 1100.5,
      donationType: DonationType.recurring,
      frequency: DonationFrequency.quarterly,
    );

    final call = api.callTo('initiateDonation');
    expect(call.variables, {
      'amount': 1100.5,
      'donationType': 'RECURRING',
      'frequency': 'QUARTERLY',
    });
    expect(call.authMode, AuthMode.userPool);
    expect(call.isMutation, isTrue);
    // The schema declares frequency nullable, so the document must too.
    expect(call.document, contains(r'$frequency: DonationFrequency'));
    expect(call.document, isNot(contains(r'$frequency: DonationFrequency!')));
  });

  test(
    'initiate parses the checkout hand-off, not a completed donation',
    () async {
      api.stub(
        'initiateDonation',
        aDonationInitiationJson(
          donationId: 'don-77',
          checkoutUrl: 'https://pay.example.test/checkout/xyz',
          checkoutReference: 'ref-xyz',
        ),
      );

      final initiation = await service.initiate(
        amount: 251,
        donationType: DonationType.oneTime,
      );

      expect(initiation.donationId, 'don-77');
      expect(initiation.checkoutUrl, 'https://pay.example.test/checkout/xyz');
      expect(initiation.checkoutReference, 'ref-xyz');
      // The selection set carries no payment fields at all — the app never sees
      // card or UPI data (project.md Forbidden).
      final document = api.callTo('initiateDonation').document;
      expect(document, isNot(contains('card')));
      expect(document, isNot(contains('upi')));
      expect(document, contains('checkoutUrl'));
    },
  );

  test(
    'myDonations parses every status and cancel gating follows from it',
    () async {
      api.stub('myDonations', [
        aDonationJson(
          id: 'd-1',
          donationType: 'RECURRING',
          frequency: 'MONTHLY',
          status: 'SUCCEEDED',
        ),
        aDonationJson(id: 'd-2', status: 'PENDING'),
        aDonationJson(id: 'd-3', status: 'FAILED'),
      ]);

      final donations = await service.myDonations();

      expect(donations.map((d) => d.status), [
        DonationStatus.succeeded,
        DonationStatus.pending,
        DonationStatus.failed,
      ]);
      // Only the active recurring one offers Cancel (BR5.6).
      expect(donations.where((d) => d.canCancel).map((d) => d.id), ['d-1']);
      expect(api.callTo('myDonations').authMode, AuthMode.userPool);
    },
  );

  test('cancel sends the id and returns the updated donation', () async {
    api.stub(
      'cancelDonation',
      aDonationJson(
        id: 'd-1',
        donationType: 'RECURRING',
        frequency: 'MONTHLY',
        status: 'CANCELLED',
        cancelledAt: DateTime.utc(2026, 3, 2),
      ),
    );

    final cancelled = await service.cancel('d-1');

    expect(api.callTo('cancelDonation').variables, {'id': 'd-1'});
    expect(cancelled.status, DonationStatus.cancelled);
    expect(cancelled.cancelledAt, DateTime.utc(2026, 3, 2));
    expect(cancelled.canCancel, isFalse);
  });

  test(
    'a refusal to cancel is surfaced, and the donation stays active',
    () async {
      // BR5.6: the server re-checks even when the client showed the button.
      api.stubRefusal(
        'cancelDonation',
        'This donation is not an active recurring donation.',
      );

      await expectLater(
        service.cancel('d-2'),
        throwsA(
          isA<ApiException>()
              .having(
                (e) => e.message,
                'message',
                'This donation is not an active recurring donation.',
              )
              .having((e) => e.isTransport, 'isTransport', isFalse),
        ),
      );
    },
  );

  test(
    'a network failure on initiate is a transport failure, no charge made',
    () async {
      api.stubTransportFailure('initiateDonation');

      await expectLater(
        service.initiate(amount: 101, donationType: DonationType.oneTime),
        throwsA(
          isA<ApiException>().having(
            (e) => e.isTransport,
            'isTransport',
            isTrue,
          ),
        ),
      );
      // The call was attempted exactly once — no silent retry that could double-charge.
      expect(api.countOf('initiateDonation'), 1);
    },
  );
}
