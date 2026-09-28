/**
 * donation-unit (U4) — typed errors shared by the donation Lambdas.
 *
 * Each error's `message` is the plain-language text surfaced to the caller
 * (AppSync forwards a thrown error's message to the client); `name` lets tests
 * and callers distinguish them without `instanceof` across bundles.
 */

/** The donations capability is switched off (`DONATIONS_ENABLED` != 'true'; FR5.4 later release). */
export class DonationsDisabledError extends Error {
  constructor(message = 'Donations are not available yet') {
    super(message);
    this.name = 'DonationsDisabledError';
  }
}

/** BR5.2 / BR5.3 / Contract 7 shape: the input was rejected before anything was written. */
export class DonationValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DonationValidationError';
  }
}

/** BR5.6: the caller is not this donation's donor, or the donation was not found for them. */
export class DonationAuthorizationError extends Error {
  constructor(message = 'You can only manage your own donations') {
    super(message);
    this.name = 'DonationAuthorizationError';
  }
}

/** The donation is not in a state that permits the requested transition (state machine, functional-spec.md). */
export class DonationStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DonationStateError';
  }
}

/** The placeholder aggregator adapter was asked to perform a real network call (thin build). */
export class AggregatorNotConfiguredError extends Error {
  constructor(operation: string) {
    super(`Payment aggregator is not configured (${operation}); donations cannot be processed yet`);
    this.name = 'AggregatorNotConfiguredError';
  }
}

/** The aggregator could not open a checkout session; the Donation stays INITIATED and the donor may retry. */
export class DonationCheckoutError extends Error {
  constructor(message = 'We could not start the payment. Please try again.') {
    super(message);
    this.name = 'DonationCheckoutError';
  }
}
