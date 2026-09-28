/**
 * reminder-unit (U7) — the Contract 8 consumer: a DynamoDB Streams handler on
 * feed-unit's `Post` table.
 *
 * Rules realized: BR7.9 (cascade-cancel every SCHEDULED/SNOOZED Reminder of a
 * soft-deleted Post), BR7.10 (idempotent under redelivery), BR7.8 (a
 * `PostDateTimeChanged` is a DELIBERATE no-op — the builder's
 * simplicity-over-completeness choice; do not "fix" it toward an in-place
 * reschedule: the affected device gets an ADDITIONAL Reminder on its next
 * sync via BR7.1's widened backfill), NFR-OBS.2/3 (structured logs carrying
 * the Post id and every affected Reminder id).
 *
 * ## Idempotency (BR7.10)
 *
 * The transition is a conditional `UpdateItem` guarded on `status IN
 * (SCHEDULED, SNOOZED)`, so a redelivered record finds no active row and
 * changes nothing; the two `DeleteSchedule` calls are re-issued regardless
 * and are no-ops on an already-gone schedule. No separate "seen" table is
 * needed — the state itself is the dedupe (the record's `dedupeKey` is
 * logged for correlation).
 *
 * ## Partial-batch failure
 *
 * Errors are isolated per record; the handler returns `batchItemFailures`
 * naming only the failed records' sequence numbers, so the event-source
 * mapping (`reportBatchItemFailures`, `bisectBatchOnError`, 3 retries in
 * `backend.ts`) retries just those.
 *
 * No authorization applies here: the only caller is the Lambda service via
 * the event-source mapping; the function's IAM role is the boundary.
 */
import type { DynamoDBBatchResponse, DynamoDBRecord, DynamoDBStreamEvent } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { SchedulerClient } from '@aws-sdk/client-scheduler';
import { createLogger, describeError, silentLogger, type Logger } from '../donation-shared/logging';
import {
  REMINDER_TABLE_ENV,
  SCHEDULE_GROUP_ENV,
  SCHEDULER_ROLE_ARN_ENV,
  clearScheduleName,
  fireScheduleName,
} from '../reminder-shared/constants';
import {
  ReminderRepository,
  type ReminderRepositoryLike,
} from '../reminder-shared/reminder-repository';
import { SchedulesAdapter, type SchedulesLike } from '../reminder-shared/schedules-adapter';
import { classifyPostRecord } from '../reminder-shared/stream-events';

export interface ReminderStreamDeps {
  repository: ReminderRepositoryLike;
  schedules: SchedulesLike;
  now?: () => string;
  logger?: Logger;
}

/**
 * Builds the handler from injected dependencies (real clients in `handler`,
 * fakes in tests).
 */
export function createHandler(deps: ReminderStreamDeps) {
  const now = deps.now ?? (() => new Date().toISOString());
  const logger = deps.logger ?? silentLogger;

  /** BR7.9 for one soft-deleted Post. */
  async function cascadeCancel(postId: string, dedupeKey: string): Promise<void> {
    const reminders = await deps.repository.listRemindersByPost(postId);
    const active = reminders.filter((r) => r.status === 'SCHEDULED' || r.status === 'SNOOZED');
    logger.info('post deleted: cascade-cancel', {
      postId,
      dedupeKey,
      reminderIds: active.map((r) => r.id),
      skipped: reminders.length - active.length,
    });
    for (const reminder of active) {
      const payload = { reminderId: reminder.id, postId };
      const result = await deps.repository.transitionReminder(
        reminder.id,
        ['SCHEDULED', 'SNOOZED'],
        'CANCELLED',
        now(),
      );
      logger.info(
        result.applied ? 'reminder cancelled by cascade' : 'reminder cascade no-op',
        payload,
      );
      // Re-issued on every delivery (BR7.10): a no-op when already gone.
      await deps.schedules.delete(fireScheduleName(reminder.id), payload);
      await deps.schedules.delete(clearScheduleName(reminder.id), payload);
    }
  }

  async function handleRecord(record: DynamoDBRecord): Promise<void> {
    const event = classifyPostRecord(record);
    switch (event.kind) {
      case 'PostDeleted':
        await cascadeCancel(event.postId, event.dedupeKey);
        return;
      case 'PostDateTimeChanged':
        // BR7.8: deliberately a no-op (see the file header).
        logger.info('post dateTime changed: no-op by design (BR7.8)', {
          postId: event.postId,
          newDateTime: event.newDateTime,
          dedupeKey: event.dedupeKey,
        });
        return;
      case 'Ignored':
        return;
    }
  }

  return async (event: DynamoDBStreamEvent): Promise<DynamoDBBatchResponse> => {
    const batchItemFailures: DynamoDBBatchResponse['batchItemFailures'] = [];
    for (const record of event.Records ?? []) {
      try {
        await handleRecord(record);
      } catch (error) {
        const itemIdentifier = record.dynamodb?.SequenceNumber ?? record.eventID ?? '';
        logger.error('post stream record failed; reported for retry', {
          itemIdentifier,
          error: describeError(error),
        });
        batchItemFailures.push({ itemIdentifier });
      }
    }
    return { batchItemFailures };
  };
}

// --- Lambda entry point: real clients, built lazily on first use ----------
let realDeps: ReminderStreamDeps | undefined;

function realDependencies(): ReminderStreamDeps {
  realDeps ??= {
    repository: new ReminderRepository(DynamoDBDocumentClient.from(new DynamoDBClient({})), {
      reminderTableName: process.env[REMINDER_TABLE_ENV] ?? '',
    }),
    schedules: new SchedulesAdapter(new SchedulerClient({}), {
      groupName: process.env[SCHEDULE_GROUP_ENV] ?? '',
      // Deletes need no role, but the adapter validates its configuration up front.
      roleArn: process.env[SCHEDULER_ROLE_ARN_ENV] ?? 'unused-for-delete-only',
    }),
    logger: createLogger('reminder-stream-handler'),
  };
  return realDeps;
}

export const handler = async (event: DynamoDBStreamEvent): Promise<DynamoDBBatchResponse> =>
  createHandler(realDependencies())(event);
