/**
 * reminder-unit (U7) — the fixed values shared by the schema
 * (`amplify/data/resource.ts`), `amplify/backend.ts`, the four reminder
 * Lambdas and the tests. Lambda code imports from here, never from the
 * schema file.
 *
 * - `FIRE_HOUR_IST` / `SNOOZE_HOUR_IST`: BR7.2 (09:00 IST the day before the
 *   Post) and BR7.3 (a FIXED 21:00 IST the same day — a clock time, not an
 *   offset from when snooze was tapped).
 * - Index names: `postIdIndex` (Contract 8 cascade lookup) and `ownerIndex`
 *   on BOTH tables (R-04: every lookup by guest identity is an index Query,
 *   never a Scan or a mis-keyed `GetItem`).
 * - Schedule names: one EventBridge Scheduler one-time schedule per Reminder
 *   for the push (`fire-<id>`) and one for the auto-clear (`clear-<id>`),
 *   so every schedule is addressable from the Reminder id alone (BR7.10's
 *   re-sync deletes need nothing else).
 */

/** BR7.2: initial fire time, IST hour of the day before the Post's IST date. */
export const FIRE_HOUR_IST = 9;
/** BR7.3: snooze fire time, IST hour of the same day as the initial fire. */
export const SNOOZE_HOUR_IST = 21;
/** IST is a fixed UTC+05:30 offset (no daylight saving). */
export const IST_OFFSET_MINUTES = 330;

/** `Reminder.postIdIndex`: partition key `postId`, no sort key. */
export const REMINDER_POST_INDEX = 'postIdIndex';
/** `Reminder.ownerIndex`: partition key `ownerIdentityId`, sorted by `initialFireAt` (R-04). */
export const REMINDER_OWNER_INDEX = 'ownerIndex';
/** `DeviceToken.ownerIndex`: partition key `ownerIdentityId`, no sort key (R-04). */
export const DEVICE_TOKEN_OWNER_INDEX = 'ownerIndex';

/** Env var names `amplify/backend.ts` injects into the Lambdas. */
export const REMINDER_TABLE_ENV = 'REMINDER_TABLE_NAME';
export const DEVICE_TOKEN_TABLE_ENV = 'DEVICE_TOKEN_TABLE_NAME';
export const SCHEDULE_GROUP_ENV = 'REMINDER_SCHEDULE_GROUP_NAME';
export const SCHEDULER_ROLE_ARN_ENV = 'REMINDER_SCHEDULER_ROLE_ARN';
export const DELIVER_PUSH_ARN_ENV = 'DELIVER_PUSH_ARN';
export const AUTO_CLEAR_ARN_ENV = 'AUTO_CLEAR_ARN';
/** Set by Amplify itself when the schema grants `allow.resource(reminderApi)`. */
export const GRAPHQL_ENDPOINT_ENV = 'AMPLIFY_DATA_GRAPHQL_ENDPOINT';
/** `secret('REMINDER_FCM_SERVICE_ACCOUNT')` — the Firebase service-account JSON. */
export const FCM_SERVICE_ACCOUNT_ENV = 'REMINDER_FCM_SERVICE_ACCOUNT';

/** The CloudWatch namespace `amplify/backend.ts` pins in `deliver-push`'s IAM condition. */
export const REMINDER_METRIC_NAMESPACE = 'SarovarJinalaya/Reminders';
/** NFR-OBS.1: seconds between the intended fire time and actual delivery. */
export const DELIVERY_DELTA_METRIC = 'reminder-delivery-delta';

/** Name of the one-time schedule that invokes `deliver-push` for a Reminder. */
export function fireScheduleName(reminderId: string): string {
  return `fire-${reminderId}`;
}

/** Name of the one-time schedule that invokes `auto-clear` for a Reminder. */
export function clearScheduleName(reminderId: string): string {
  return `clear-${reminderId}`;
}
