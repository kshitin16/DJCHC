/**
 * reminder-unit (U7) — the `clear-<id>` schedule target, invoked at the
 * Post's own `dateTime`: moves the Reminder to CLEARED (BR7.4).
 *
 * Rules realized: BR7.4 (auto-clear from SCHEDULED, SNOOZED or FIRED —
 * CANCELLED is excluded by the write condition, a user's cancellation is
 * final), BR7.10 (a redundant invocation is a no-op, never an error),
 * NFR-OBS.2/3 (structured, correlated log lines).
 *
 * The transition is ONE conditional `UpdateItem` (no read-then-write), so the
 * decision "still clearable?" and the write are atomic. Afterwards the
 * `fire-<id>` schedule is deleted as belt-and-braces: a SNOOZED Reminder's
 * fire schedule may still be pending when the event passes (a no-op when
 * already gone).
 *
 * No authorization applies here: the only caller is EventBridge Scheduler
 * through the execution role `backend.ts` scopes to this function.
 */
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { SchedulerClient } from '@aws-sdk/client-scheduler';
import { createLogger, silentLogger, type Logger } from '../donation-shared/logging';
import {
  REMINDER_TABLE_ENV,
  SCHEDULE_GROUP_ENV,
  SCHEDULER_ROLE_ARN_ENV,
  fireScheduleName,
} from '../reminder-shared/constants';
import {
  ReminderRepository,
  type ReminderRepositoryLike,
} from '../reminder-shared/reminder-repository';
import { SchedulesAdapter, type SchedulesLike } from '../reminder-shared/schedules-adapter';
import type { SchedulePayload } from '../reminder-shared/types';

export interface AutoClearDeps {
  repository: ReminderRepositoryLike;
  schedules: SchedulesLike;
  now?: () => string;
  logger?: Logger;
}

export type AutoClearResult = { reminderId: string; cleared: boolean };

function parsePayload(input: unknown): SchedulePayload {
  const payload = input as Partial<SchedulePayload> | null | undefined;
  if (!payload || typeof payload.reminderId !== 'string' || payload.reminderId.length === 0) {
    throw new Error('auto-clear: payload must carry a reminderId');
  }
  return {
    reminderId: payload.reminderId,
    postId: typeof payload.postId === 'string' ? payload.postId : '',
  };
}

export function createHandler(deps: AutoClearDeps) {
  const now = deps.now ?? (() => new Date().toISOString());
  const logger = deps.logger ?? silentLogger;

  return async (input: unknown): Promise<AutoClearResult> => {
    const payload = parsePayload(input);
    const result = await deps.repository.transitionReminder(
      payload.reminderId,
      ['SCHEDULED', 'SNOOZED', 'FIRED'],
      'CLEARED',
      now(),
    );
    logger.info(result.applied ? 'reminder cleared' : 'reminder clear no-op (cancelled or gone)', {
      ...payload,
    });
    await deps.schedules.delete(fireScheduleName(payload.reminderId), payload);
    return { reminderId: payload.reminderId, cleared: result.applied };
  };
}

// --- Lambda entry point: real clients, built lazily on first use ----------
let realDeps: AutoClearDeps | undefined;

function realDependencies(): AutoClearDeps {
  realDeps ??= {
    repository: new ReminderRepository(DynamoDBDocumentClient.from(new DynamoDBClient({})), {
      reminderTableName: process.env[REMINDER_TABLE_ENV] ?? '',
    }),
    schedules: new SchedulesAdapter(new SchedulerClient({}), {
      groupName: process.env[SCHEDULE_GROUP_ENV] ?? '',
      roleArn: process.env[SCHEDULER_ROLE_ARN_ENV] ?? 'unused-for-delete-only',
    }),
    logger: createLogger('auto-clear'),
  };
  return realDeps;
}

export const handler = async (input: unknown): Promise<AutoClearResult> =>
  createHandler(realDependencies())(input);
