/**
 * reminder-unit (U7) — the record shapes and enum values shared by the
 * schema (`amplify/data/resource.ts`), the four reminder Lambdas and the
 * tests. Lambda code imports from here, never from the schema file.
 *
 * `Reminder` and `DeviceToken` are exactly Contract 9 / `entities.md`; both
 * identifiers are named `id`, as the shared GraphQL contract names them
 * (project.md Correction: never silently rename an identifier).
 * `ownerIdentityId` is the caller's Cognito Identity Pool GUEST identity
 * (BR7.6) — never a User Pool `sub`.
 */

/** Contract 9 `ReminderStatus`, in the order the contract lists them. */
export const REMINDER_STATUSES = ['SCHEDULED', 'SNOOZED', 'FIRED', 'CLEARED', 'CANCELLED'] as const;
export type ReminderStatus = (typeof REMINDER_STATUSES)[number];

/** Contract 9 `DevicePlatform`. */
export const DEVICE_PLATFORMS = ['IOS', 'ANDROID'] as const;
export type DevicePlatform = (typeof DEVICE_PLATFORMS)[number];

/** BR7.10: the statuses no later event may move a Reminder out of (FIRED still auto-clears, BR7.4). */
export const TERMINAL_STATUSES: readonly ReminderStatus[] = ['FIRED', 'CLEARED', 'CANCELLED'];

/** A stored `Reminder` row (Contract 9 + the `@model` transformer's implicit `updatedAt`). */
export interface ReminderRecord {
  id: string;
  postId: string;
  ownerIdentityId: string;
  status: ReminderStatus;
  initialFireAt: string;
  /** Present if and only if `status === 'SNOOZED'` (entities.md constraint). */
  snoozeFireAt?: string;
  createdAt: string;
  updatedAt: string;
}

/** A stored `DeviceToken` row (Contract 9 + implicit `createdAt`/`updatedAt`). */
export interface DeviceTokenRecord {
  id: string;
  ownerIdentityId: string;
  pushToken: string;
  platform: DevicePlatform;
  remindersEnabled: boolean;
  registeredAt: string;
  createdAt: string;
  updatedAt: string;
}

/** The slice of Contract 3's `Post` that BR7.1's sync needs (`id type dateTime`). */
export interface FeedPost {
  id: string;
  type: string;
  dateTime: string;
}

/** The body of every EventBridge Scheduler target `Input` this Unit creates. */
export interface SchedulePayload {
  reminderId: string;
  /** NFR-OBS.3 correlation: the Post the Reminder is for. */
  postId: string;
}

/** Result of a conditional status transition (`ConditionalCheckFailedException` → `applied: false`). */
export interface TransitionResult {
  applied: boolean;
  reminder?: ReminderRecord;
}
