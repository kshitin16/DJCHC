/**
 * reminder-unit (U7) — `auto-clear` Lambda declaration: the EventBridge
 * Scheduler target of every `clear-<id>` one-time schedule, fired at the
 * Post's own `dateTime`.
 *
 * Moves the Reminder to CLEARED from SCHEDULED, SNOOZED or FIRED (BR7.4;
 * CANCELLED is excluded by the write condition) and deletes any still-pending
 * `fire-<id>` schedule as belt-and-braces. See `./handler.ts`.
 *
 * Sizing: 128MB / 5s (one conditional UpdateItem, one DeleteSchedule).
 *
 * Environment (injected by `amplify/backend.ts`): `REMINDER_TABLE_NAME`,
 * `REMINDER_SCHEDULE_GROUP_NAME`.
 *
 * `resourceGroupName: 'data'`: reads the `Reminder` table name.
 */
import { defineFunction } from '@aws-amplify/backend';

export const autoClear = defineFunction({
  name: 'auto-clear',
  entry: './handler.ts',
  memoryMB: 128,
  timeoutSeconds: 5,
  resourceGroupName: 'data',
  logging: {
    // 30 days — the project default (NFR-OBS.2), as resolved at Observability Setup Q2: CloudWatch
    // sets retention per log GROUP, not per level, so the per-level
    // split NFR-OBS.2 asked for cannot be configured. Unset means
    // logs are kept forever, which is both a cost and a privacy leak.
    retention: '1 month',
  },
});
