/**
 * reminder-unit (U7) — the EventBridge Scheduler adapter (NFR-PERF.3): one
 * ONE-TIME schedule per Reminder for the push (`fire-<id>` → `deliver-push`)
 * and one for the auto-clear (`clear-<id>` → `auto-clear`, at the Post's own
 * `dateTime`, BR7.4). The Scheduler client is injected (a real
 * `SchedulerClient` in the Lambda, a fake in tests).
 *
 * - `createOneTime`: `at(YYYY-MM-DDTHH:MM:SS)` in UTC (the API accepts no
 *   `Z`), `ScheduleExpressionTimezone: 'UTC'`, `FlexibleTimeWindow OFF`,
 *   `ActionAfterCompletion: DELETE` (the schedule removes itself once it has
 *   fired — nothing accumulates in the group), inside this Unit's group with
 *   this Unit's execution role, both from env.
 * - `updateTime`: BR7.3 — the same target, a new fire time. Re-issued on the
 *   already-SNOOZED no-op path too (BR7.3 R-04 re-sync); idempotent from the
 *   API's own semantics.
 * - `delete`: `ResourceNotFoundException` is a NO-OP (BR7.10's re-sync
 *   semantics — a schedule that already fired and self-deleted, or that a
 *   prior partial cancel removed, is exactly the state we want). Every other
 *   error is rethrown.
 *
 * Every call logs `{ schedule, reminderId, postId, fireAt }`
 * (observability-design.md, NFR-OBS.2/3) so the EventBridge↔Reminder sync
 * is traceable after the fact.
 */
import {
  CreateScheduleCommand,
  DeleteScheduleCommand,
  UpdateScheduleCommand,
  type SchedulerClient,
} from '@aws-sdk/client-scheduler';
import { createLogger, type Logger } from '../donation-shared/logging';
import { SCHEDULE_GROUP_ENV, SCHEDULER_ROLE_ARN_ENV } from './constants';
import type { SchedulePayload } from './types';

/** The one method the adapter needs — a real `SchedulerClient` or a test fake. */
export type SchedulerClientLike = Pick<SchedulerClient, 'send'>;

/** What the handlers depend on; `SchedulesAdapter` implements it, tests fake it. */
export interface SchedulesLike {
  createOneTime(
    name: string,
    atIso: string,
    targetArn: string,
    payload: SchedulePayload,
  ): Promise<void>;
  updateTime(
    name: string,
    atIso: string,
    targetArn: string,
    payload: SchedulePayload,
  ): Promise<void>;
  delete(name: string, payload: SchedulePayload): Promise<void>;
}

export interface SchedulesAdapterOptions {
  /** env `REMINDER_SCHEDULE_GROUP_NAME` */
  groupName: string;
  /** env `REMINDER_SCHEDULER_ROLE_ARN` */
  roleArn: string;
}

/** `at(YYYY-MM-DDTHH:MM:SS)` — UTC wall-clock, second precision, no `Z` (the Scheduler's required form). */
export function atExpression(iso: string): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) throw new Error(`SchedulesAdapter: invalid fire time ${iso}`);
  return `at(${new Date(ms).toISOString().slice(0, 19)})`;
}

function isResourceNotFound(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { name?: unknown }).name === 'ResourceNotFoundException'
  );
}

export class SchedulesAdapter implements SchedulesLike {
  private readonly groupName: string;
  private readonly roleArn: string;

  constructor(
    private readonly client: SchedulerClientLike,
    options: SchedulesAdapterOptions,
    private readonly logger: Logger = createLogger('reminder-schedules'),
  ) {
    if (!options.groupName) {
      throw new Error(`SchedulesAdapter: groupName is required (env ${SCHEDULE_GROUP_ENV})`);
    }
    if (!options.roleArn) {
      throw new Error(`SchedulesAdapter: roleArn is required (env ${SCHEDULER_ROLE_ARN_ENV})`);
    }
    this.groupName = options.groupName;
    this.roleArn = options.roleArn;
  }

  private scheduleInput(name: string, atIso: string, targetArn: string, payload: SchedulePayload) {
    return {
      Name: name,
      GroupName: this.groupName,
      ScheduleExpression: atExpression(atIso),
      ScheduleExpressionTimezone: 'UTC',
      FlexibleTimeWindow: { Mode: 'OFF' as const },
      ActionAfterCompletion: 'DELETE' as const,
      Target: { Arn: targetArn, RoleArn: this.roleArn, Input: JSON.stringify(payload) },
    };
  }

  async createOneTime(
    name: string,
    atIso: string,
    targetArn: string,
    payload: SchedulePayload,
  ): Promise<void> {
    await this.client.send(
      new CreateScheduleCommand(this.scheduleInput(name, atIso, targetArn, payload)),
    );
    this.logger.info('schedule created', { schedule: name, ...payload, fireAt: atIso });
  }

  async updateTime(
    name: string,
    atIso: string,
    targetArn: string,
    payload: SchedulePayload,
  ): Promise<void> {
    await this.client.send(
      new UpdateScheduleCommand(this.scheduleInput(name, atIso, targetArn, payload)),
    );
    this.logger.info('schedule updated', { schedule: name, ...payload, fireAt: atIso });
  }

  async delete(name: string, payload: SchedulePayload): Promise<void> {
    try {
      await this.client.send(new DeleteScheduleCommand({ Name: name, GroupName: this.groupName }));
      this.logger.info('schedule deleted', { schedule: name, ...payload });
    } catch (error) {
      if (isResourceNotFound(error)) {
        this.logger.info('schedule already gone (no-op)', { schedule: name, ...payload });
        return;
      }
      throw error;
    }
  }
}
