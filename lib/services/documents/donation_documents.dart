/// Contract 5 GraphQL documents, hand-written from `amplify/data/resource.ts`.
library;

/// Contract 5 `Donation` selection set. `processedPaymentId` is deliberately
/// NOT selected — it is donation-unit's internal idempotency marker and is not
/// part of Contract 5.
const String donationFields = '''
    id
    donorGoogleId
    amount
    donationType
    frequency
    status
    aggregatorTransactionId
    createdAt
    cancelledAt''';

/// `initiateDonation(amount, donationType, frequency)` — returns a checkout
/// hand-off, never a completed donation. `frequency` is nullable in the schema
/// and the variable is OMITTED entirely for a ONE_TIME donation.
///
/// The app never sees or transmits raw payment details (project.md Forbidden):
/// the aggregator's own checkout page collects them.
const String initiateDonationDocument = '''
mutation InitiateDonation(
  \$amount: Float!
  \$donationType: DonationType!
  \$frequency: DonationFrequency
) {
  initiateDonation(
    amount: \$amount
    donationType: \$donationType
    frequency: \$frequency
  ) {
    donationId
    checkoutUrl
    checkoutReference
  }
}''';

/// `myDonations` — the caller's own donations (owner-read enforced server-side).
const String myDonationsDocument =
    '''
query MyDonations {
  myDonations {
$donationFields
  }
}''';

/// `cancelDonation(id)` — accepted only for an active recurring donation
/// (BR5.6); the server re-checks regardless of the client's own gating.
const String cancelDonationDocument =
    '''
mutation CancelDonation(\$id: ID!) {
  cancelDonation(id: \$id) {
$donationFields
  }
}''';
