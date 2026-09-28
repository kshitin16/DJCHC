/**
 * reminder-unit (U7) — AppSync Lambda resolver for the five Contract 9
 * operations (`myReminders`, `registerDeviceToken`, `setRemindersEnabled`,
 * `snoozeReminder`, `cancelReminder`).
 *
 * Rules realized: BR7.1 (lazy sync/backfill, on by default, widened
 * condition), BR7.2 (fire time), BR7.3 (snooze — ownership first, fixed
 * 21:00 IST, cutoff, no-op re-sync), BR7.5 (owner-only cancel), BR7.6 (guest
 * identity only), BR7.7 (toggle touches no Reminder), BR7.10 (idempotent
 * cancel re-issuing BOTH schedule deletes), NFR-PERF.3 (EventBridge
 * Scheduler one-time schedules), NFR-OBS.2/3 (structured, correlated logs).
 *
 * ## Who enforces what (project.md Correction: never leave implicit)
 *
 * - AppSync (declarative, server-side — the enforcing layer for BR7.6): every
 *   operation carries `allow.guest()` + `allow.authenticated()` in
 *   `amplify/data/resource.ts`; a caller with neither an Identity Pool
 *   identity nor a User Pool token never reaches this code.
 * - This handler — THE enforcing layer for ownership (BR7.3, BR7.5) and for
 *   `myReminders`' owner scoping: the caller's identity is read ONLY from
 *   `event.identity.cognitoIdentityId` (AppSync fills it for IAM/guest
 *   callers; a signed-in device also has one) — never from an argument —
 *   and an event without one is refused (`ReminderAuthorizationError`).
 *   Every Reminder returned is Queried by that identity (`ownerIndex`,
 *   R-04); a snooze/cancel of a Reminder owned by another identity is
 *   refused BEFORE any status branch, so a non-owner never receives even a
 *   "no-op" success (BR7.3 R-01).
 * - Flutter screens (flutter-app-unit): UX convenience only.
 *
 * ## `myReminders` (functional-spec.md, View My Reminders)
 *
 * 1. `listPosts` via the injected `FeedClient` (Contract 3). If the call
 *    FAILS, the device's existing Reminders are returned without backfill
 *    (logged at WARN; retried on the next sync) — an enumeration failure
 *    never fails the sync.
 * 2. Existing Reminders: one Query on `ownerIndex`.
 * 3. Backfill only when the device has a `DeviceToken` with
 *    `remindersEnabled !== false` — a device that never registered gets no
 *    auto-created Reminders (nothing to deliver to; the Calendar still shows
 *    events) — and only for `type === 'EVENT'` posts whose Post has not
 *    already passed (a Reminder for a past event would fire never and clear
 *    immediately). For each: `initialFireAtFor` (BR7.2); if `needsBackfill`
 *    (BR7.1 widened) create a SCHEDULED Reminder, then `fire-<id>` →
 *    `deliver-push` at `initialFireAt` and `clear-<id>` → `auto-clear` at the
 *    Post's `dateTime` (BR7.4). A schedule failure after the row was written
 *    is logged and surfaced: the row stays SCHEDULED and the next sync will
 *    not duplicate it (its `initialFireAt` matches), so the operator can
 *    re-sync the schedule from the logs' `{ schedule, reminderId }` line.
 * 4. Return existing + new.
 *
 * ## `snoozeReminder` — BR7.3 in exactly this order
 *
 * not found → refuse; not owner → refuse; already SNOOZED → re-issue
 * `updateTime(fire-<id>, snoozeFireAt)` and return unchanged (R-04 re-sync);
 * SCHEDULED and now < 21:00 IST → transition SCHEDULED→SNOOZED with
 * `snoozeFireAt` then `updateTime`; SCHEDULED past cutoff → refuse with a
 * plain-language message; terminal → return unchanged, NO Scheduler call.
 *
 * ## `cancelReminder` — BR7.5 / BR7.10
 *
 * not found → refuse; not owner → refuse; SCHEDULED|SNOOZED → transition to
 * CANCELLED; in EVERY case (already terminal included) delete BOTH
 * `fire-<id>` and `clear-<id>` (a no-op on an already-gone schedule) so a
 * retry after a partial failure re-syncs both; return the Reminder.
 */
import type { AppSyncResolverEvent } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { SchedulerClient } from '@aws-sdk/client-scheduler';
import { createLogger, describeError, silentLogger, type Logger } from '../donation-shared/logging';
import {
  AUTO_CLEAR_ARN_ENV,
  DELIVER_PUSH_ARN_ENV,
  DEVICE_TOKEN_TABLE_ENV,
  GRAPHQL_ENDPOINT_ENV,
  REMINDER_TABLE_ENV,
  SCHEDULE_GROUP_ENV,
  SCHEDULER_ROLE_ARN_ENV,
  clearScheduleName,
  fireScheduleName,
} from '../reminder-shared/constants';
import {
  ReminderAuthorizationError,
  ReminderNotFoundError,
  ReminderOwnershipError,
  ReminderValidationError,
  SnoozeCutoffPassedError,
} from '../reminder-shared/errors';
import { SigV4FeedClient, appSyncSigner, type FeedClient } from '../reminder-shared/feed-client';
import {
  ReminderRepository,
  type ReminderRepositoryLike,
} from '../reminder-shared/reminder-repository';
import {
  hasPostPassed,
  initialFireAtFor,
  isPastSnoozeCutoff,
  isTerminal,
  needsBackfill,
  snoozeFireAtFor,
} from '../reminder-shared/rules';
import { SchedulesAdapter, type SchedulesLike } from '../reminder-shared/schedules-adapter';
import {
  DEVICE_PLATFORMS,
  type DevicePlatform,
  type DeviceTokenRecord,
  type ReminderRecord,
} from '../reminder-shared/types';

export interface ReminderApiDeps {
  repository: ReminderRepositoryLike;
  schedules: SchedulesLike;
  feed: FeedClient;
  /** Lambda ARNs the two schedules target (env `DELIVER_PUSH_ARN` / `AUTO_CLEAR_ARN`). */
  targets: { deliverPushArn: string; autoClearArn: string };
  /** Injected clock so tests use fixed timestamps. */
  now?: () => string;
  /** Injected id generator so tests use fixed ids. */
  newId?: () => string;
  logger?: Logger;
}

/** The union of Contract 9 argument shapes; `fieldName` says which applies. */
export interface ReminderApiArguments {
  id?: unknown;
  pushToken?: unknown;
  platform?: unknown;
  enabled?: unknown;
}

export type ReminderApiEvent = AppSyncResolverEvent<ReminderApiArguments>;
export type ReminderApiResult = ReminderRecord[] | ReminderRecord | DeviceTokenRecord;

/** BR7.6: the caller's guest identity from AppSync's verified IAM identity, or undefined. */
export function callerIdentityId(event: ReminderApiEvent): string | undefined {
  const identity = event.identity as { cognitoIdentityId?: unknown } | null | undefined;
  if (!identity || typeof identity.cognitoIdentityId !== 'string') return undefined;
  const id = identity.cognitoIdentityId.trim();
  return id.length > 0 ? id : undefined;
}

function requireId(value: unknown): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ReminderValidationError('id is required');
  }
  return value.trim();
}

function requirePushToken(value: unknown): string {
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > 4096) {
    throw new ReminderValidationError('pushToken is required');
  }
  return value.trim();
}

function requirePlatform(value: unknown): DevicePlatform {
  if (typeof value !== 'string' || !(DEVICE_PLATFORMS as readonly string[]).includes(value)) {
    throw new ReminderValidationError(`platform must be one of ${DEVICE_PLATFORMS.join(', ')}`);
  }
  return value as DevicePlatform;
}

function requireBoolean(value: unknown): boolean {
  if (typeof value !== 'boolean') throw new ReminderValidationError('enabled must be a boolean');
  return value;
}

/** Soonest fire first, deterministic on ties. */
export function sortByFireTime(reminders: ReminderRecord[]): ReminderRecord[] {
  return [...reminders].sort(
    (a, b) => a.initialFireAt.localeCompare(b.initialFireAt) || a.id.localeCompare(b.id),
  );
}

/**
 * Builds the resolver from injected dependencies (real clients in
 * `handler`, fakes in tests).
 */
export function createHandler(deps: ReminderApiDeps) {
  const now = deps.now ?? (() => new Date().toISOString());
  const newId = deps.newId ?? (() => crypto.randomUUID());
  const logger = deps.logger ?? silentLogger;

  /** Not found → refuse; not owner → refuse. Always the first two checks. */
  async function ownedReminder(id: string, ownerIdentityId: string): Promise<ReminderRecord> {
    const reminder = await deps.repository.getReminderById(id);
    if (!reminder) throw new ReminderNotFoundError();
    if (reminder.ownerIdentityId !== ownerIdentityId) {
      logger.warn('reminder refused: not the owner', { reminderId: id });
      throw new ReminderOwnershipError();
    }
    return reminder;
  }

  // --- registerDeviceToken (Register Device Token) --------------------------
  async function registerDeviceToken(
    ownerIdentityId: string,
    args: ReminderApiArguments,
  ): Promise<DeviceTokenRecord> {
    const pushToken = requirePushToken(args.pushToken);
    const platform = requirePlatform(args.platform);
    const device = await deps.repository.upsertDeviceToken(
      ownerIdentityId,
      pushToken,
      platform,
      now(),
      newId,
    );
    logger.info('device token registered', { deviceTokenId: device.id, platform });
    return device;
  }

  // --- setRemindersEnabled (BR7.7) -------------------------------------------
  async function setRemindersEnabled(
    ownerIdentityId: string,
    args: ReminderApiArguments,
  ): Promise<DeviceTokenRecord> {
    const enabled = requireBoolean(args.enabled);
    const device = await deps.repository.getDeviceTokenByOwner(ownerIdentityId);
    if (!device) throw new ReminderNotFoundError('Register this device for notifications first');
    // BR7.7: ONLY the flag changes; no Reminder is read or written here.
    const updated = await deps.repository.setRemindersEnabled(device.id, enabled, now());
    logger.info('reminders toggled', { deviceTokenId: device.id, enabled });
    return updated;
  }

  // --- myReminders (BR7.1 sync) ----------------------------------------------
  async function myReminders(ownerIdentityId: string): Promise<ReminderRecord[]> {
    const existing = await deps.repository.listRemindersByOwner(ownerIdentityId);

    let posts;
    try {
      posts = await deps.feed.listPosts();
    } catch (error) {
      logger.warn('listPosts failed; returning existing reminders without backfill', {
        error: describeError(error),
      });
      return sortByFireTime(existing);
    }

    const device = await deps.repository.getDeviceTokenByOwner(ownerIdentityId);
    if (!device || device.remindersEnabled === false) {
      return sortByFireTime(existing);
    }

    const created: ReminderRecord[] = [];
    const currentTime = now();
    for (const post of posts) {
      if (post.type !== 'EVENT' || hasPostPassed(currentTime, post.dateTime)) continue;
      const initialFireAt = initialFireAtFor(post.dateTime);
      const forPost = [...existing, ...created].filter((r) => r.postId === post.id);
      if (!needsBackfill(forPost, initialFireAt)) continue;

      const reminder = await deps.repository.createReminder({
        id: newId(),
        postId: post.id,
        ownerIdentityId,
        status: 'SCHEDULED',
        initialFireAt,
        createdAt: currentTime,
      });
      created.push(reminder);
      logger.info('reminder created', { reminderId: reminder.id, postId: post.id, initialFireAt });
      const payload = { reminderId: reminder.id, postId: post.id };
      try {
        await deps.schedules.createOneTime(
          fireScheduleName(reminder.id),
          initialFireAt,
          deps.targets.deliverPushArn,
          payload,
        );
        await deps.schedules.createOneTime(
          clearScheduleName(reminder.id),
          post.dateTime,
          deps.targets.autoClearArn,
          payload,
        );
      } catch (error) {
        logger.error('schedule creation failed after the reminder was written', {
          reminderId: reminder.id,
          postId: post.id,
          error: describeError(error),
        });
        throw error;
      }
    }
    return sortByFireTime([...existing, ...created]);
  }

  // --- snoozeReminder (BR7.3) ------------------------------------------------
  async function snoozeReminder(
    ownerIdentityId: string,
    args: ReminderApiArguments,
  ): Promise<ReminderRecord> {
    const id = requireId(args.id);
    const reminder = await ownedReminder(id, ownerIdentityId); // ownership FIRST
    const payload = { reminderId: reminder.id, postId: reminder.postId };
    const snoozeFireAt = snoozeFireAtFor(reminder.initialFireAt);

    if (reminder.status === 'SNOOZED') {
      // Idempotent no-op on the row, but re-sync the schedule (R-04).
      await deps.schedules.updateTime(
        fireScheduleName(reminder.id),
        reminder.snoozeFireAt ?? snoozeFireAt,
        deps.targets.deliverPushArn,
        payload,
      );
      logger.info('reminder already snoozed; schedule re-synced', payload);
      return reminder;
    }
    if (isTerminal(reminder.status)) {
      // No Scheduler call: snooze never owns a terminal Reminder's cleanup (R-02/R-03).
      logger.info('reminder snooze no-op: already terminal', {
        ...payload,
        status: reminder.status,
      });
      return reminder;
    }
    // status === 'SCHEDULED'
    const currentTime = now();
    if (isPastSnoozeCutoff(currentTime, reminder.initialFireAt)) {
      logger.info('reminder snooze refused: past 21:00 IST', payload);
      throw new SnoozeCutoffPassedError();
    }
    const result = await deps.repository.transitionReminder(
      reminder.id,
      ['SCHEDULED'],
      'SNOOZED',
      currentTime,
      { snoozeFireAt },
    );
    if (!result.applied) {
      // Raced with a fire/clear/cancel between the read and the write: report the current row.
      const latest = await deps.repository.getReminderById(reminder.id);
      logger.info('reminder snooze no-op: status changed concurrently', payload);
      return latest ?? reminder;
    }
    await deps.schedules.updateTime(
      fireScheduleName(reminder.id),
      snoozeFireAt,
      deps.targets.deliverPushArn,
      payload,
    );
    logger.info('reminder snoozed', { ...payload, snoozeFireAt });
    return (
      result.reminder ?? { ...reminder, status: 'SNOOZED', snoozeFireAt, updatedAt: currentTime }
    );
  }

  // --- cancelReminder (BR7.5, BR7.10) ---------------------------------------
  async function cancelReminder(
    ownerIdentityId: string,
    args: ReminderApiArguments,
  ): Promise<ReminderRecord> {
    const id = requireId(args.id);
    const reminder = await ownedReminder(id, ownerIdentityId); // ownership FIRST
    const payload = { reminderId: reminder.id, postId: reminder.postId };

    let result: ReminderRecord = reminder;
    if (!isTerminal(reminder.status)) {
      const transition = await deps.repository.transitionReminder(
        reminder.id,
        ['SCHEDULED', 'SNOOZED'],
        'CANCELLED',
        now(),
      );
      if (transition.applied) {
        result = transition.reminder ?? {
          ...reminder,
          status: 'CANCELLED',
          snoozeFireAt: undefined,
        };
        logger.info('reminder cancelled', payload);
      } else {
        result = (await deps.repository.getReminderById(reminder.id)) ?? reminder;
        logger.info('reminder cancel no-op: already terminal', payload);
      }
    } else {
      logger.info('reminder cancel no-op: already terminal', {
        ...payload,
        status: reminder.status,
      });
    }
    // BR7.10: in every case re-issue BOTH deletes so a retry re-syncs both schedules.
    await deps.schedules.delete(fireScheduleName(reminder.id), payload);
    await deps.schedules.delete(clearScheduleName(reminder.id), payload);
    return result;
  }

  return async (event: ReminderApiEvent): Promise<ReminderApiResult> => {
    // BR7.6 (backstop): no guest identity, no operation.
    const ownerIdentityId = callerIdentityId(event);
    if (!ownerIdentityId) throw new ReminderAuthorizationError();
    const args = event.arguments ?? {};

    switch (event.info.fieldName) {
      case 'myReminders':
        return myReminders(ownerIdentityId);
      case 'registerDeviceToken':
        return registerDeviceToken(ownerIdentityId, args);
      case 'setRemindersEnabled':
        return setRemindersEnabled(ownerIdentityId, args);
      case 'snoozeReminder':
        return snoozeReminder(ownerIdentityId, args);
      case 'cancelReminder':
        return cancelReminder(ownerIdentityId, args);
      default:
        throw new Error(`reminder-api: unsupported operation ${event.info.fieldName}`);
    }
  };
}

// --- Lambda entry point: real clients, built lazily on first use ----------
let realDeps: ReminderApiDeps | undefined;

function realDependencies(): ReminderApiDeps {
  realDeps ??= {
    repository: new ReminderRepository(DynamoDBDocumentClient.from(new DynamoDBClient({})), {
      reminderTableName: process.env[REMINDER_TABLE_ENV] ?? '',
      deviceTokenTableName: process.env[DEVICE_TOKEN_TABLE_ENV] ?? '',
    }),
    schedules: new SchedulesAdapter(new SchedulerClient({}), {
      groupName: process.env[SCHEDULE_GROUP_ENV] ?? '',
      roleArn: process.env[SCHEDULER_ROLE_ARN_ENV] ?? '',
    }),
    feed: new SigV4FeedClient({
      endpoint: process.env[GRAPHQL_ENDPOINT_ENV] ?? '',
      signer: appSyncSigner(process.env.AWS_REGION),
      fetch: (input, init) => fetch(input, init),
    }),
    targets: {
      deliverPushArn: process.env[DELIVER_PUSH_ARN_ENV] ?? '',
      autoClearArn: process.env[AUTO_CLEAR_ARN_ENV] ?? '',
    },
    logger: createLogger('reminder-api'),
  };
  return realDeps;
}

export const handler = async (event: ReminderApiEvent): Promise<ReminderApiResult> =>
  createHandler(realDependencies())(event);
