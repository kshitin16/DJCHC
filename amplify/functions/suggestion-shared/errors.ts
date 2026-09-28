/**
 * suggestion-unit (U3) — typed errors thrown by the suggestion Lambdas.
 *
 * As in `donation-shared/errors.ts` / `document-shared/errors.ts`: the
 * `message` is the plain-language text AppSync forwards to the client (the
 * functional spec's "plain-language message"), and `name` lets tests and
 * callers distinguish them without `instanceof` across bundles. None of
 * these messages ever includes the suggestion text (personal data).
 */

/** BR3.1: the text was rejected before anything was written. */
export class SuggestionValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SuggestionValidationError';
  }
}

/** BR3.5: the caller has already used today's five submissions (IST day). */
export class DailyLimitExceededError extends Error {
  constructor(message = 'You can submit up to 5 suggestions a day; try again after midnight IST') {
    super(message);
    this.name = 'DailyLimitExceededError';
  }
}

/**
 * BR3.2 / BR3.3 backstop: the caller carries no verified identity, or is not
 * in the Admin group for `allSuggestions` (the declarative rule should have
 * refused first).
 */
export class SuggestionAuthorizationError extends Error {
  constructor(message = 'You must be signed in to use the suggestion box') {
    super(message);
    this.name = 'SuggestionAuthorizationError';
  }
}
