/**
 * pdf-library-unit (U5) — typed errors thrown by the `document-api` Lambda.
 *
 * Each error's `message` is the plain-language text surfaced to the caller
 * (AppSync forwards a thrown error's message to the client — the "plain-
 * language error message with a retry action" the functional spec's error
 * paths call for); `name` lets tests and callers distinguish them without
 * `instanceof` across bundles. Same arrangement as `donation-shared/errors.ts`.
 */

/** BR6.1 / BR6.2 / key shape: the input was rejected before anything was written. */
export class DocumentValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DocumentValidationError';
  }
}

/** The document (or the uploaded object it refers to) does not exist. */
export class DocumentNotFoundError extends Error {
  constructor(message = 'Document not found') {
    super(message);
    this.name = 'DocumentNotFoundError';
  }
}

/** BR6.3 backstop: the caller is not in the Admin group (the declarative rule should have refused first). */
export class DocumentAuthorizationError extends Error {
  constructor(message = 'Only an admin can upload or delete documents') {
    super(message);
    this.name = 'DocumentAuthorizationError';
  }
}
