/**
 * reminder-unit (U7) — `reminder-stream-handler` Lambda declaration: the
 * Contract 8 consumer of feed-unit's `Post` table stream.
 *
 * Reacts to `PostDeleted` (a MODIFY record whose `deletedAt` goes from absent
 * to set — feed-unit soft-deletes) by cascade-cancelling every SCHEDULED /
 * SNOOZED Reminder for that Post (BR7.9) and deleting their schedules;
 * `PostDateTimeChanged` is a deliberate no-op (BR7.8). See `./handler.ts`.
 *
 * Sizing: 128MB / 10s (one `postIdIndex` Query plus a bounded number of
 * conditional updates and `DeleteSchedule` calls per record).
 *
 * Environment (injected by `amplify/backend.ts`): `REMINDER_TABLE_NAME`,
 * `REMINDER_SCHEDULE_GROUP_NAME`. The event-source mapping on the `Post`
 * stream is also wired there (`DynamoEventSource`).
 *
 * `resourceGroupName: 'data'`: it consumes the data stack's table stream and
 * reads the `Reminder` table name.
 */
import { defineFunction } from '@aws-amplify/backend';

export const reminderStreamHandler = defineFunction({
  name: 'reminder-stream-handler',
  entry: './handler.ts',
  memoryMB: 128,
  timeoutSeconds: 10,
  resourceGroupName: 'data',
  logging: {
    // 30 days — the project default (NFR-OBS.2), as resolved at Observability Setup Q2: CloudWatch
    // sets retention per log GROUP, not per level, so the per-level
    // split NFR-OBS.2 asked for cannot be configured. Unset means
    // logs are kept forever, which is both a cost and a privacy leak.
    retention: '1 month',
  },
});
