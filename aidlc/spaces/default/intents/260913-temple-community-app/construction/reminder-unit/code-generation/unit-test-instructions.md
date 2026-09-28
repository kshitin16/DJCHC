# Unit Test Instructions — reminder-unit

## Test framework and setup

- **Framework**: Jest 29 + `ts-jest` (ESM), `testEnvironment: 'node'` — the shared runner in `jest.config.ts`; the project-wide 80% line-coverage floor stays in force.
- **Install**: `npm install` after plan Step 1.1 adds `@aws-sdk/client-scheduler`, `google-auth-library`, `@smithy/signature-v4`, `@aws-sdk/credential-provider-node`, `@aws-crypto/sha256-js`.
- No AWS credentials, no Firebase, no `ampx sandbox`, no network: every Lambda takes its repository, schedules adapter, push sender, feed client, clock, and id generator by injection; the adapters take their SDK clients / `fetch` / token provider / signer by injection.

## How to run THIS UNIT's tests

Exact, unit-scoped command:

```bash
NODE_OPTIONS=--experimental-vm-modules npx jest --rootDir . amplify/data/reminder amplify/functions/reminder amplify/functions/deliver-push amplify/functions/auto-clear
```

Wired as `npm run test:reminder`. It matches `amplify/data/reminder-schema.test.ts`, `amplify/functions/reminder-shared/**`, `amplify/functions/reminder-api/**`, `amplify/functions/reminder-stream-handler/**`, `amplify/functions/deliver-push/**`, `amplify/functions/auto-clear/**` only. Runnable at plan Step 2.1 (verified once with `--passWithNoTests`; the script omits that flag).

With unit-scoped coverage:

```bash
NODE_OPTIONS=--experimental-vm-modules npx jest --rootDir . amplify/data/reminder amplify/functions/reminder amplify/functions/deliver-push amplify/functions/auto-clear --coverage --collectCoverageFrom='amplify/functions/reminder-*/**/*.ts' --collectCoverageFrom='amplify/functions/deliver-push/handler.ts' --collectCoverageFrom='amplify/functions/auto-clear/handler.ts' --collectCoverageFrom='!amplify/functions/*/resource.ts'
```

Never use a bare `npm test` as this Unit's own verification.

## Test files and cases (70 tests across 12 files)

| File | Tests | Covers |
|---|---|---|
| `amplify/data/reminder-schema.test.ts` | 7 | Enums; fields; **both `ownerIndex` GSIs (R-04)** + `postIdIndex`; generated ops disabled; five Contract 9 operations; guest+authenticated on all; no Admin/owner rule |
| `amplify/functions/reminder-shared/constants.test.ts` | 1 | Fire/snooze hours, index names, schedule-name builders |
| `amplify/functions/reminder-shared/reminder-repository.test.ts` | 8 | Owner/post index Queries with pagination; conditional `IN` transition and its no-op mapping; DeviceToken owner lookup; idempotent upsert preserving `remindersEnabled`; `setRemindersEnabled` writes only the flag; errors rethrown |
| `amplify/functions/reminder-shared/schedules-adapter.test.ts` | 5 | `at()` expression format; group/role from env; `ActionAfterCompletion: DELETE`; payload; `ResourceNotFoundException` swallowed on delete only |
| `amplify/functions/reminder-shared/push-sender.test.ts` | 4 | FCM endpoint + bearer; message shape; UNREGISTERED → `PushTokenInvalidError`; other errors surfaced |
| `amplify/functions/reminder-shared/feed-client.test.ts` | 3 | Query requests `id type dateTime`; signed request to the env endpoint; GraphQL errors thrown |
| `amplify/functions/reminder-shared/rules.test.ts` | 9 | BR7.2 fire time with IST date rollover; BR7.3 snooze time and cutoff; BR7.4 boundary; BR7.1 widened `needsBackfill`; `isTerminal`; dedupe key |
| `amplify/functions/reminder-shared/stream-events.test.ts` | 5 | Contract 8 classification of MODIFY/INSERT/REMOVE records |
| `amplify/functions/reminder-api/handler.test.ts` | 14 | Identity source; register/upsert; toggle touches no Reminder; sync backfill rules and both schedules; snooze's five branches in BR7.3 order; cancel's transition + both deletes incl. the already-terminal path |
| `amplify/functions/reminder-stream-handler/handler.test.ts` | 5 | Cascade-cancel; terminal rows untouched; redelivery no-op still deletes schedules; dateTime change no-op; partial-batch failure reporting |
| `amplify/functions/deliver-push/handler.test.ts` | 5 | Send + FIRED; terminal skip; no token; invalid token; delivery-delta metric |
| `amplify/functions/auto-clear/handler.test.ts` | 4 | Clears from three statuses; leaves CANCELLED; deletes fire schedule; no-op on condition failure |

Per-component volume (Standard strategy, 5–8 per component): schema 7, repository 8, schedules 5, rules 9, stream-events 5, api 14 (five operations), stream handler 5, deliver-push 5, auto-clear 4 (+ the constants pin); the push sender (4) and feed client (3) are thin adapters whose remaining behaviour lives in their SDKs.

## Expected coverage

- Global floor 80% lines (unchanged). Expected for this Unit's own files ≥ 90% (the lazy real-client bootstraps in each `handler.ts` are the known uncovered lines, as in every other Unit).
- Excluded from collection: `amplify/functions/*/resource.ts`, `amplify/backend.ts`, `amplify/data/test-support/**`.

## Mocking / stubbing guidance

- **Fake, don't mock modules.** Repository tests use a `send(command)` recorder (paginated Query pages; an error with `name === 'ConditionalCheckFailedException'` for the no-op transition). Schedules tests use a fake Scheduler client (recording `CreateSchedule`/`UpdateSchedule`/`DeleteSchedule` inputs; throwing `ResourceNotFoundException` on demand). Push-sender tests inject a fake `fetch` and a fake token provider (`() => Promise.resolve('test-token')`) — never a real Google credential; the service-account env is an obviously fake JSON literal. Feed-client tests inject a fake signer and fake `fetch`. Handler tests inject `FakeReminderRepository`, `FakeSchedules`, `FakePushSender`, `FakeFeedClient` with call recording so ordering (ownership check before anything; transition then schedule calls; both deletes) is assertable.
- Never mock `@aws-amplify/backend`; the schema test reads the exported schema definition/SDL.
- Clock and ids injected (`now()`, `newId()`); IST tests use fixed UTC instants around 03:30Z (09:00 IST) and 15:30Z (21:00 IST) and around 18:30Z (IST midnight).
- Caller identity in handler tests: `guestCtx('identity-A')` sets `event.identity.cognitoIdentityId`; a second identity proves ownership refusals.

## Test data management

- Fixtures via helpers (`aReminder({ status: 'SNOOZED' })`, `aDeviceToken({ remindersEnabled: false })`, `anEventPost({ dateTime })`, `aStreamRecord({ old, new })`) inside each test file; no fixture directory, no snapshots.

## Integration tests

None in this pass. When flutter-app-unit's Calendar lands, the sandbox-backed `integration_test` ("open Calendar → guest identity resolves → device registers → reminders appear → snooze → cancel") is the first real run of EventBridge Scheduler creation and the Contract 8 stream mapping. FCM delivery itself is verified manually against a real device once the Firebase project and APNs key exist.
