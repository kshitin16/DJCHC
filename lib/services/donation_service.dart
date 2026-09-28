/// Contract 5 (Donation Data) — initiate a donation, list your own, cancel a
/// recurring one.
///
/// Realizes: FR5.1-FR5.3 (later release, behind `featureFlags.donationsEnabled`).
///
/// This app NEVER handles raw payment details (project.md Forbidden):
/// [initiate] returns an aggregator checkout hand-off and the screen opens that
/// URL externally. The app also never decides whether a payment succeeded — the
/// donation's status is whatever the server says it is, updated by Contract 7's
/// webhook (project.md Mandated on the timeout path).
///
/// Personal data: a donation amount is never logged.
library;

import '../models/donation.dart';
import 'gateways.dart';
import 'documents/donation_documents.dart';
import 'service_parsing.dart';

class DonationService {
  DonationService(this._api);

  final ApiGateway _api;

  /// `initiateDonation(amount, donationType, frequency)`.
  ///
  /// [frequency] is omitted from the variables entirely for a ONE_TIME
  /// donation — the schema declares it nullable and it is meaningless there.
  /// A RECURRING donation without a frequency is refused server-side.
  Future<DonationInitiation> initiate({
    required double amount,
    required DonationType donationType,
    DonationFrequency? frequency,
  }) async {
    final isRecurring = donationType == DonationType.recurring;
    final data = await _api.mutate(
      document: initiateDonationDocument,
      field: 'initiateDonation',
      authMode: AuthMode.userPool,
      variables: {
        'amount': amount,
        'donationType': donationType.graphQlValue,
        if (isRecurring && frequency != null)
          'frequency': frequency.graphQlValue,
      },
    );
    return parseObject(
      data,
      DonationInitiation.fromJson,
      field: 'initiateDonation',
    );
  }

  /// `myDonations` — owner-read enforced server-side.
  Future<List<Donation>> myDonations() async {
    final data = await _api.query(
      document: myDonationsDocument,
      field: 'myDonations',
      authMode: AuthMode.userPool,
    );
    return parseList(data, Donation.fromJson, field: 'myDonations');
  }

  /// `cancelDonation(id)` — stops future charges (BR5.6, user-cancel-anytime).
  /// The server re-checks that the donation is actually cancellable.
  Future<Donation> cancel(String id) async {
    final data = await _api.mutate(
      document: cancelDonationDocument,
      field: 'cancelDonation',
      authMode: AuthMode.userPool,
      variables: {'id': id},
    );
    return parseObject(data, Donation.fromJson, field: 'cancelDonation');
  }
}
