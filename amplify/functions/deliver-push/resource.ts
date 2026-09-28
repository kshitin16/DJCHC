/**
 * reminder-unit (U7) — `deliver-push` Lambda declaration: the EventBridge
 * Scheduler target of every `fire-<id>` one-time schedule.
 *
 * Reads the Reminder, resolves the owner's DeviceToken through `ownerIndex`
 * (R-04), sends the FCM push (BR7.11) and marks the Reminder FIRED; emits the
 * `reminder-delivery-delta` metric (NFR-OBS.1 / NFR-PERF.3). See `./handler.ts`.
 *
 * Sizing: 128MB / 10s (one GetItem, one index Query, one FCM HTTPS call).
 *
 * Environment: `REMINDER_TABLE_NAME`, `DEVICE_TOKEN_TABLE_NAME` (injected by
 * `amplify/backend.ts`) and `REMINDER_FCM_SERVICE_ACCOUNT` — a `secret()`
 * reference resolved at deploy time from the Amplify secret store (SSM
 * SecureString); never a literal in source (security-design.md). Set it with
 * `npx ampx sandbox secret set REMINDER_FCM_SERVICE_ACCOUNT`.
 *
 * `resourceGroupName: 'data'`: reads both table names.
 */
import { defineFunction, secret } from '@aws-amplify/backend';

export const deliverPush = defineFunction({
  name: 'deliver-push',
  entry: './handler.ts',
  memoryMB: 128,
  timeoutSeconds: 10,
  resourceGroupName: 'data',
  environment: {
    REMINDER_FCM_SERVICE_ACCOUNT: secret('REMINDER_FCM_SERVICE_ACCOUNT'),
  },
});
