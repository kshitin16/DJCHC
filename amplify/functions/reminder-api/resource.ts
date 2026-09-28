/**
 * reminder-unit (U7) — `reminder-api` Lambda declaration.
 *
 * Backs ALL FIVE Contract 9 operations (`myReminders`, `registerDeviceToken`,
 * `setRemindersEnabled`, `snoozeReminder`, `cancelReminder`) as one AppSync
 * Lambda resolver. The infrastructure specification had `registerDeviceToken`
 * / `setRemindersEnabled` as direct resolvers, but the installed
 * `@aws-amplify/data-schema` refuses `allow.guest()` on a no-Lambda custom
 * resolver (the constraint every other Unit hit), and the other three were
 * Lambda-backed already — so one function serves the whole contract (plan
 * "Known deviations"; infra spec amendment note). See `./handler.ts`.
 *
 * Sizing: 128MB / 10s (infrastructure-specification.md, `myReminders`: one
 * `listPosts` call, one `ownerIndex` Query, a bounded backfill loop with one
 * `PutItem` + two `CreateSchedule` calls per new Reminder).
 *
 * Environment (all injected by `amplify/backend.ts` except the last):
 * - `REMINDER_TABLE_NAME`, `DEVICE_TOKEN_TABLE_NAME`
 * - `REMINDER_SCHEDULE_GROUP_NAME`, `REMINDER_SCHEDULER_ROLE_ARN`
 * - `DELIVER_PUSH_ARN`, `AUTO_CLEAR_ARN` (the two schedule targets)
 * - `AMPLIFY_DATA_GRAPHQL_ENDPOINT` — set in `backend.ts` next to the
 *   single-field `appsync:GraphQL` grant on `Query.listPosts` (Contract 3
 *   consumer; review R-01 rejected the schema-wide `allow.resource(fn)`).
 *
 * `resourceGroupName: 'data'`: the schema references it as a handler AND it
 * reads both table names — same cycle-avoidance as every other data Lambda.
 */
import { defineFunction } from '@aws-amplify/backend';

export const reminderApi = defineFunction({
  name: 'reminder-api',
  entry: './handler.ts',
  memoryMB: 128,
  timeoutSeconds: 10,
  resourceGroupName: 'data',
});
