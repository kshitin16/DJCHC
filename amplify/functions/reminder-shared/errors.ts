/**
 * reminder-unit (U7) — typed errors thrown by the reminder Lambdas.
 *
 * As in the other Units' `errors.ts`: `message` is the plain-language text
 * AppSync forwards to the client; `name` lets tests and callers distinguish
 * them without `instanceof` across bundles. No message ever includes a push
 * token or an identity id.
 */

/** BR7.6 backstop: the caller carries no Cognito Identity Pool guest identity. */
export class ReminderAuthorizationError extends Error {
  constructor(message = 'Reminders need a device identity; please restart the app and try again') {
    super(message);
    this.name = 'ReminderAuthorizationError';
  }
}

/** BR7.3 / BR7.5: the caller is not the Reminder's owner. Checked before anything else. */
export class ReminderOwnershipError extends Error {
  constructor(message = 'This reminder belongs to a different device') {
    super(message);
    this.name = 'ReminderOwnershipError';
  }
}

/** The Reminder (or DeviceToken) does not exist — distinct from the ownership refusal. */
export class ReminderNotFoundError extends Error {
  constructor(message = 'Reminder not found') {
    super(message);
    this.name = 'ReminderNotFoundError';
  }
}

/** BR7.3: the owner tried to snooze after 21:00 IST of the fire day. */
export class SnoozeCutoffPassedError extends Error {
  constructor(message = 'It is past 9 PM; this reminder can no longer be snoozed') {
    super(message);
    this.name = 'SnoozeCutoffPassedError';
  }
}

/** An argument failed validation at the AppSync boundary. */
export class ReminderValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReminderValidationError';
  }
}

/** FCM reported the device token as UNREGISTERED / not found. */
export class PushTokenInvalidError extends Error {
  constructor(message = 'The device push token is no longer valid') {
    super(message);
    this.name = 'PushTokenInvalidError';
  }
}
