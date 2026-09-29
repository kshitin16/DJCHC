# Code Summary — reminder-unit

Full build of the calendar reminders module (first release, guest-identity only — no sign-in). Four Lambdas, two tables with three GSIs, an EventBridge Scheduler group + execution role, a DynamoDB Streams consumer on the Post table, one custom metric. The Critical accepted-risk finding R-04 from Infrastructure Design (missing `ownerIdentityId` indexes) is closed in this pass.

## Files created / modified

37 entries in `source-manifest.json`; workspace-relative.

| Path | Kind | Purpose |
|---|---|---|
| `package.json`, `package-lock.json` | modified | Runtime deps `@aws-sdk/client-scheduler`, `google-auth-library`, `@smithy/signature-v4`, `@aws-sdk/credential-provider-node`, `@aws-crypto/sha256-js`; script `test:reminder`. |
| `amplify/data/resource.ts` | modified | `ReminderStatus` / `DevicePlatform` enums; `Reminder` model (`postId`, `ownerIdentityId`, `status`, `initialFireAt`, `snoozeFireAt?`, `createdAt`; `postIdIndex` on `postId`; **`ownerIndex` on `ownerIdentityId` sorted by `initialFireAt` — R-04**); `DeviceToken` model (`ownerIdentityId`, `pushToken`, `platform`, `remindersEnabled`, `registeredAt`; **`ownerIndex` on `ownerIdentityId` — R-04**); generated ops disabled on both; the five Contract 9 operations (`registerDeviceToken`, `setRemindersEnabled`, `myReminders`, `snoozeReminder`, `cancelReminder`) all guest + authenticated, all `a.handler.function(reminderApi)`. **No schema-level `allow.resource(...)` grant** — see decision 10 (review R-01). The reminder block sits **before** the pdf-library block (see decision 1). The schema body is now `const schemaDefinitions = {...}` + `a.schema(schemaDefinitions)` (decision 2); other Units' blocks are byte-identical. |
| `amplify/backend.ts` | modified | Registers the four functions; PITR on `Reminder` and `DeviceToken`; `CfnScheduleGroup` `reminder-unit-schedules-<stackName>`; scheduler execution role trusted by `scheduler.amazonaws.com` with `lambda:InvokeFunction` on exactly `deliver-push` + `auto-clear`; `DynamoEventSource` on `Post` (LATEST, batch 10, bisect on error, 3 retries, `reportBatchItemFailures`); least-privilege IAM per function — `reminder-api`: `appsync:GraphQL` on the single `Query.listPosts` field ARN + `AMPLIFY_DATA_GRAPHQL_ENDPOINT` injected from the API's URL attribute (review R-01), `dynamodb:Query` on the three GSI ARNs only, Get/Put/UpdateItem on the two tables, `scheduler:Create/Update/DeleteSchedule` scoped to the group, `iam:PassRole` on the scheduler role conditioned on `iam:PassedToService = scheduler.amazonaws.com`; `reminder-stream-handler`: Query on `postIdIndex`, UpdateItem, `scheduler:DeleteSchedule` in the group; `deliver-push`: Get/UpdateItem on `Reminder`, Query on DeviceToken `ownerIndex`, `cloudwatch:PutMetricData` conditioned on the namespace; `auto-clear`: UpdateItem + `scheduler:DeleteSchedule`. Env names injected. |
| `amplify/data/reminder-schema.test.ts` | created | 7 SDL/definition tests, incl. both `ownerIndex` GSIs. |
| `amplify/functions/reminder-shared/constants.ts` (+ test) | created | `FIRE_HOUR_IST = 9`, `SNOOZE_HOUR_IST = 21`, index / env / metric names, `fireScheduleName` / `clearScheduleName`. 1 test. |
| `amplify/functions/reminder-shared/types.ts`, `errors.ts` | created | Contract 9 record shapes and enums; typed errors (`ReminderAuthorizationError`, `ReminderOwnershipError`, `ReminderNotFoundError`, `SnoozeCutoffPassedError`, `ReminderValidationError`, `PushTokenInvalidError`). |
| `amplify/functions/reminder-shared/reminder-repository.ts` (+ test) | created | Index-scoped, paginated Queries on both `ownerIndex` GSIs and `postIdIndex`; `transitionReminder` = one conditional `UpdateItem` with `#status IN (...)`, `ConditionalCheckFailedException` → `{ applied: false }` (BR7.10); idempotent `upsertDeviceToken`; `setRemindersEnabled` writes only the flag. 8 tests. |
| `amplify/functions/reminder-shared/schedules-adapter.ts` (+ test) | created | EventBridge Scheduler one-time schedules: `at(YYYY-MM-DDTHH:MM:SS)` UTC, `FlexibleTimeWindow OFF`, `ActionAfterCompletion DELETE`, group/role from env; `delete` swallows only `ResourceNotFoundException`; every call logs `{ schedule, reminderId, postId, fireAt }` (NFR-OBS.2/3). 5 tests. |
| `amplify/functions/reminder-shared/push-sender.ts` (+ test) | created | `FcmPushSender` (FCM HTTP v1; injected `fetch` + token provider; `serviceAccountTokenProvider` via `google-auth-library`); 404 / `UNREGISTERED` → `PushTokenInvalidError`. 4 tests. |
| `amplify/functions/reminder-shared/feed-client.ts` (+ test) | created | `SigV4FeedClient`: signed GraphQL POST to `AMPLIFY_DATA_GRAPHQL_ENDPOINT` requesting exactly `id type dateTime`; GraphQL errors thrown. 3 tests. |
| `amplify/functions/reminder-shared/metrics.ts` (+ test) | created | `reminder-delivery-delta` in `SarovarJinalaya/Reminders`, best-effort (NFR-OBS.1). 2 tests. |
| `amplify/functions/reminder-shared/rules.ts` (+ test) | created | BR7.2 `initialFireAtFor` (09:00 IST the day before, with IST date rollover), BR7.3 `snoozeFireAtFor` / `isPastSnoozeCutoff` (21:00 IST), BR7.4 `hasPostPassed`, BR7.1-widened `needsBackfill`, `isTerminal`, `dedupeKey`. 9 tests. |
| `amplify/functions/reminder-shared/stream-events.ts` (+ test) | created | Contract 8 `classifyPostRecord`: MODIFY with `deletedAt` absent→set = `PostDeleted`; `dateTime` change = `PostDateTimeChanged`; INSERT / REMOVE / other = `Ignored`. 5 tests. |
| `amplify/functions/reminder-shared/test-fakes.ts` | created | Recording fakes (`FakeReminderRepository`, `FakeSchedules`, `FakePushSender`, `FakeFeedClient`) shared by the four handler tests. |
| `amplify/functions/reminder-api/resource.ts`, `handler.ts` (+ test) | created | `resourceGroupName: 'data'`. Identity from `event.identity.cognitoIdentityId` only (BR7.6); the five operations with ownership check before any write (BR7.5); `myReminders` backfills across Event posts (BR7.1) and creates both schedules; snooze in BR7.3's branch order; cancel = transition + both deletes. `createHandler(deps)` injection. 14 tests. |
| `amplify/functions/reminder-stream-handler/resource.ts`, `handler.ts` (+ test) | created | Contract 8 consumer: `PostDeleted` → cascade-cancel via `postIdIndex` + delete both schedules (BR7.9, idempotent BR7.10); `PostDateTimeChanged` → deliberate no-op (BR7.8, per the builder's simplicity choice); returns `batchItemFailures`. 5 tests. |
| `amplify/functions/deliver-push/resource.ts`, `handler.ts` (+ test) | created | `secret('REMINDER_FCM_SERVICE_ACCOUNT')`; FCM push, FIRED transition, delivery-delta metric (BR7.7, BR7.11, NFR-OBS.1); terminal / no-token / invalid-token paths. 5 tests. |
| `amplify/functions/auto-clear/resource.ts`, `handler.ts` (+ test) | created | BR7.4 conditional CLEARED from SCHEDULED / SNOOZED / FIRED, leaves CANCELLED, deletes the fire schedule. 4 tests. |
| `README.md` | modified | "Calendar & Reminders" section: the five operations (guest identity, no sign-in), lazy sync/backfill and on-by-default, fire times, the Scheduler model, the Contract 8 consumer and BR7.8's no-op, FCM setup (`npx ampx sandbox secret set REMINDER_FCM_SERVICE_ACCOUNT`), the R-04 fix, permissions self-review list. |

## Key implementation decisions

1. **Reminder schema block placed before the pdf-library block** rather than appended. Amplify emits models in definition order; pdf-library-unit's `document-schema.test.ts` slices the SDL from `type Document` to `type DocumentUploadTarget` and asserts no `status` field inside — an appended `Reminder.status` (Contract 9's field name) broke that slice. No other Unit's file was modified. Documented in a code comment and the README.
2. **Schema restructured** as `const schemaDefinitions = {...}` + `a.schema(schemaDefinitions)` — originally so a schema-level `.authorization(...)` could be chained without Prettier re-indenting every other Unit's block; that grant was removed at review (decision 10) but the split is kept, since it is harmless and leaves the other blocks byte-identical.
3. **R-04 closed as designed**: all per-owner lookups (`myReminders`, `registerDeviceToken`, `setRemindersEnabled`, `deliver-push`'s token lookup) are Queries on the two `ownerIndex` GSIs; the IAM grants name only the index ARNs for `Query`, so a Scan is not even permitted.
4. **`upsertDeviceToken` token rotation**: same identity + different token updates the existing row in place (preserving `remindersEnabled`) instead of creating a second row — `entities.md` says one DeviceToken per device identity, and a second row would make the owner lookup ambiguous. The plan's tests (same-token update, create-when-absent) are all satisfied.
5. **Stream source**: `tables['Post']` exposes `tableStreamArn` (Amplify builds it via `Table.fromTableAttributes` with the default `NEW_AND_OLD_IMAGES` stream), so `DynamoEventSource` attaches directly. The Scheduler group and role live in the data stack (`Stack.of(reminderApi)`), avoiding a cross-stack cycle.
6. **Race handling**: snooze and cancel are read-then-conditional-write; a failed condition returns the current row (no schedule call for snooze; both deletes still issued for cancel). Redelivery of a stream record is a no-op that still deletes the schedules (BR7.10).
7. **`myReminders` skips Event posts whose `dateTime` has already passed** (a Reminder for one would never fire and would immediately clear); and per the functional spec, a `listPosts` failure returns the existing Reminders without backfill rather than failing the sync.
8. **Push copy is a fixed string** (no Post-title lookup); the app deep-links on `postId` in the FCM `data` payload.
9. **Personal data**: log lines carry ids, statuses, fire times and reasons — never push tokens.
10. **`listPosts` access is a single-field IAM grant, not `allow.resource(fn)`** (review iteration 1, R-01 Major — fixed before iteration 2). Amplify's `allow.resource(fn).to(['query'])` attaches `appsync:GraphQL` on `types/Query/*`, i.e. every query in the shared backend including the admin-only `allSuggestions`, `getPost`, `listAllPostsForAdmin`; and because Amplify Gen2 sets `enableIamAuthorizationMode: true` on the API, `@auth` rules are not applied to IAM principals — the IAM policy is the whole gate. The first build used the schema-wide grant (as the plan literally said). The fix removes it from `amplify/data/resource.ts` and has `backend.ts` grant `appsync:GraphQL` on `${graphqlApi.arn}/types/Query/fields/listPosts` only, and set `AMPLIFY_DATA_GRAPHQL_ENDPOINT` from `cfnGraphqlApi.attrGraphQlUrl` (the env var Amplify would otherwise have set). `reminder-schema.test.ts` now asserts the Lambda appears in NO schema-wide grant.
11. **Logger reuse** (review R-02, Minor): the four Lambdas import the structured logger from `amplify/functions/donation-shared/logging.ts`, the same cross-unit convention suggestion-unit follows. That file is not modified by this pass and so is not in this manifest; noted here so the dependency is declared.

## Test coverage summary

- `npm run test:reminder` → **13 suites, 72 tests, 72 passed** — re-run and confirmed by the conductor (the approved instructions listed 70 across 12 files; `metrics.test.ts` (2) was added as a 13th file).
- `npm test -- --coverage` → **48 suites, 265 tests, 265 passed; 93.6% statements / 81.8% branches / 87.4% functions / 95.0% lines** (80% floor enforced, unchanged). Unit-scoped: 95.2% lines; uncovered lines are exactly the lazy real-client bootstraps in each `handler.ts`, `appSyncSigner`, and `serviceAccountTokenProvider`.
- `npm run lint`, `npm run typecheck` → clean (re-run by the conductor); `prettier --check` → clean.
- No integration test yet; flutter-app-unit's sandbox `integration_test` is the first real exercise of EventBridge Scheduler creation and the Contract 8 stream mapping; FCM delivery is verified manually against a device once the Firebase project and APNs key exist.

## Deviations from the design and plan

| Deviation | Why | Effect |
|---|---|---|
| Four Lambdas (one shared `reminder-api` for the five Contract 9 ops) where the infra spec describes six | The approved plan already consolidated them; one handler with one IAM role is simpler to self-review | Infra spec needs an amendment note (carried; see Open items) |
| Reminder schema block inserted before pdf-library's rather than appended | SDL-slice assertion in `document-schema.test.ts` (decision 1) | None on behaviour |
| `upsertDeviceToken` rotates a token in place rather than the plan's literal "else create" | One DeviceToken per device identity (`entities.md`) | Prevents dead-token rows; plan tests still pass |
| `metrics.ts` split into its own file with 2 tests (13 files / 72 tests vs. the instructions' 12 / 70) | Same pattern as suggestion-unit; the emitter is best-effort and deserves its own swallow test | Volume above, never below, the approved table |
| `listPosts` reached via an explicit single-field `appsync:GraphQL` grant in `backend.ts` instead of the plan's schema-level `allow.resource(reminderApi).to(['query'])` | The schema-wide form grants every query in the shared backend (review R-01) | Strictly narrower permission; same env var; behaviour unchanged |
| `reminder-stream-handler` / `auto-clear` construct the schedules adapter with a placeholder role ARN | They only delete schedules; the role is not needed and not injected | Harmless; noted for the reviewer |

## Open items (not defects)

- The IAM block added to `amplify/backend.ts` (scheduler role, `iam:PassRole`, index-scoped grants) is on the builder's self-review checklist (project.md Mandated) — the conductor read it once during this pass and found it least-privilege.
- Amendment notes owed to `reminder-unit/infrastructure-design/infrastructure-specification.md`: four Lambdas instead of six; FCM service-account secret lives in SSM SecureString via `secret()` (same SSM-vs-Secrets-Manager note as auth/donation).
- One-time setup before the first sandbox run: `npx ampx sandbox secret set REMINDER_FCM_SERVICE_ACCOUNT` with the Firebase service-account JSON; the APNs key upload is flutter-app-unit's item.
- flutter-app-unit: `services/reminder_service.dart`, the Calendar screen, OS push permission, and the sandbox integration test.

## Re-verification (2026-09-28)

This is the Unit whose gate rejection on 2026-09-20 (review finding R-01, Major — the schema-wide `allow.resource(reminderApi).to(['query'])` grant would have exposed the three admin-only Post operations to the Lambda's IAM principal, since `enableIamAuthorizationMode: true` bypasses `@auth` rules for IAM callers) reset the whole stage's Plan Approval evidence, including the five other backend Units' already-correct receipts (see auth-unit's code-summary.md for the general explanation).

The R-01 fix itself was already applied to the actual code before this session (a single-field `appsync:GraphQL` grant on `types/Query/fields/listPosts` in `amplify/backend.ts`), but **the plan document (`code-generation-plan.md` Step 3.2) still described the rejected schema-wide mechanism** — it was never corrected to match. Fixed directly in this pass (project.md Correction: fix a stale upstream artifact with an amendment note rather than letting drift stand) — Step 3.2's text now describes the actual field-scoped grant, and a new Known Deviations entry documents the R-01 finding and its fix. Re-verified the fix is real, not just documented:

- `grep -n "appsync:GraphQL" amplify/backend.ts`: confirms the grant is scoped to the single field ARN, not the schema.
- `grep -rn "allow.resource" amplify/` (excluding tests): every hit is a comment explaining why the schema-wide helper was avoided; no actual usage anywhere in the backend.
- `npm run test:reminder`: 13/13 suites, 72/72 tests passing.
- `npm test` (whole backend, all Units): 48/48 suites, 265/265 tests passing — a full cross-check since this was the last backend Unit's re-verification.
- `npm run typecheck` / `npm run lint`: clean.
- No `amplify/functions/{reminder-*,deliver-push,auto-clear}/**` or `amplify/data/reminder*.ts` file was touched; only the plan document and this summary were edited.
