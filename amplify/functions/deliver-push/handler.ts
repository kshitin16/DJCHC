/**
 * reminder-unit (U7) — the `fire-<id>` schedule target: delivers one
 * Reminder as a server-triggered push (BR7.11) and marks it FIRED.
 *
 * Rules realized: BR7.11 (FCM push to the owner's registered DeviceToken),
 * BR7.7 (the app-wide toggle affects only auto-creation — an existing
 * Reminder still fires while a token exists), BR7.10 (the FIRED transition is
 * conditional on SCHEDULED|SNOOZED, so a duplicate invocation is a no-op),
 * NFR-OBS.1 (`reminder-delivery-delta` metric), NFR-OBS.2 (WARN on delivery
 * failures), R-04 (`DeviceToken` resolved through `ownerIndex`).
 *
 * ## Steps
 *
 * 1. Validate the payload (`{ reminderId, postId }`) and read the Reminder.
 * 2. Skip unless SCHEDULED or SNOOZED (already fired/cleared/cancelled).
 * 3. Resolve the owner's DeviceToken (index Query). None → WARN, leave the
 *    Reminder pending (the Calendar still shows it); no transition.
 * 4. Send the push. `PushTokenInvalidError` (dead token) → WARN, leave the
 *    Reminder pending, no transition (documented deviation: the design does
 *    not specify this case; leaving it visible in the Calendar is the safer
 *    reading). Any other send failure is thrown so the invocation fails
 *    loudly and the Scheduler's own retry applies.
 * 5. Transition → FIRED (conditional) and emit the delivery delta: seconds
 *    between the intended fire time (`snoozeFireAt` when SNOOZED, else
 *    `initialFireAt`) and now.
 *
 * No authorization applies here: the only caller is EventBridge Scheduler
 * through the execution role `backend.ts` scopes to this function.
 */
import { CloudWatchClient } from '@aws-sdk/client-cloudwatch';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { createLogger, describeError, silentLogger, type Logger } from '../donation-shared/logging';
import {
  DEVICE_TOKEN_TABLE_ENV,
  FCM_SERVICE_ACCOUNT_ENV,
  REMINDER_TABLE_ENV,
} from '../reminder-shared/constants';
import { ReminderMetrics, type ReminderMetricsLike } from '../reminder-shared/metrics';
import {
  FcmPushSender,
  parseServiceAccount,
  serviceAccountTokenProvider,
  type PushSender,
} from '../reminder-shared/push-sender';
import {
  ReminderRepository,
  type ReminderRepositoryLike,
} from '../reminder-shared/reminder-repository';
import type { SchedulePayload } from '../reminder-shared/types';

export interface DeliverPushDeps {
  repository: ReminderRepositoryLike;
  push: PushSender;
  metrics: ReminderMetricsLike;
  now?: () => string;
  logger?: Logger;
}

export type DeliverPushResult =
  | { outcome: 'delivered'; reminderId: string; deltaSeconds: number }
  | { outcome: 'skipped'; reminderId: string; reason: string };

/** The notification copy. The Post title is not read here (it would need a second call); the client deep-links on `postId`. */
export const REMINDER_NOTIFICATION = {
  title: 'Sarovar Jinalaya — tomorrow',
  body: 'You have a temple event tomorrow. Tap to see the details.',
} as const;

function parsePayload(input: unknown): SchedulePayload {
  const payload = input as Partial<SchedulePayload> | null | undefined;
  if (!payload || typeof payload.reminderId !== 'string' || payload.reminderId.length === 0) {
    throw new Error('deliver-push: payload must carry a reminderId');
  }
  return {
    reminderId: payload.reminderId,
    postId: typeof payload.postId === 'string' ? payload.postId : '',
  };
}

export function createHandler(deps: DeliverPushDeps) {
  const now = deps.now ?? (() => new Date().toISOString());
  const logger = deps.logger ?? silentLogger;

  return async (input: unknown): Promise<DeliverPushResult> => {
    const { reminderId } = parsePayload(input);
    const reminder = await deps.repository.getReminderById(reminderId);
    if (!reminder) {
      logger.warn('deliver-push: reminder not found', { reminderId });
      return { outcome: 'skipped', reminderId, reason: 'not found' };
    }
    const payload = { reminderId, postId: reminder.postId };
    if (reminder.status !== 'SCHEDULED' && reminder.status !== 'SNOOZED') {
      logger.info('deliver-push: reminder no longer pending; nothing to deliver', {
        ...payload,
        status: reminder.status,
      });
      return { outcome: 'skipped', reminderId, reason: `status ${reminder.status}` };
    }

    const device = await deps.repository.getDeviceTokenByOwner(reminder.ownerIdentityId);
    if (!device) {
      logger.warn('deliver-push: no device token for the owner; reminder left pending', payload);
      return { outcome: 'skipped', reminderId, reason: 'no device token' };
    }

    try {
      await deps.push.send(device.pushToken, device.platform, {
        ...REMINDER_NOTIFICATION,
        data: payload,
      });
    } catch (error) {
      if ((error as { name?: string }).name === 'PushTokenInvalidError') {
        logger.warn('deliver-push: device token invalid; reminder left pending', {
          ...payload,
          error: describeError(error),
        });
        return { outcome: 'skipped', reminderId, reason: 'invalid device token' };
      }
      logger.error('deliver-push: push send failed', { ...payload, error: describeError(error) });
      throw error;
    }

    const deliveredAt = now();
    const result = await deps.repository.transitionReminder(
      reminderId,
      ['SCHEDULED', 'SNOOZED'],
      'FIRED',
      deliveredAt,
    );
    const intendedFireAt =
      reminder.status === 'SNOOZED' && reminder.snoozeFireAt
        ? reminder.snoozeFireAt
        : reminder.initialFireAt;
    const deltaSeconds = Math.round((Date.parse(deliveredAt) - Date.parse(intendedFireAt)) / 1000);
    logger.info(result.applied ? 'reminder delivered' : 'reminder delivered (status raced)', {
      ...payload,
      deltaSeconds,
    });
    await deps.metrics.emitDeliveryDelta(deltaSeconds);
    return { outcome: 'delivered', reminderId, deltaSeconds };
  };
}

// --- Lambda entry point: real clients, built lazily on first use ----------
let realDeps: DeliverPushDeps | undefined;

function realDependencies(): DeliverPushDeps {
  if (!realDeps) {
    const serviceAccount = parseServiceAccount(process.env[FCM_SERVICE_ACCOUNT_ENV]);
    realDeps = {
      repository: new ReminderRepository(DynamoDBDocumentClient.from(new DynamoDBClient({})), {
        reminderTableName: process.env[REMINDER_TABLE_ENV] ?? '',
        deviceTokenTableName: process.env[DEVICE_TOKEN_TABLE_ENV] ?? '',
      }),
      push: new FcmPushSender({
        projectId: serviceAccount.project_id,
        tokenProvider: serviceAccountTokenProvider(serviceAccount),
        fetch: (input, init) => fetch(input, init),
      }),
      metrics: new ReminderMetrics(new CloudWatchClient({})),
      logger: createLogger('deliver-push'),
    };
  }
  return realDeps;
}

export const handler = async (input: unknown): Promise<DeliverPushResult> =>
  createHandler(realDependencies())(input);
