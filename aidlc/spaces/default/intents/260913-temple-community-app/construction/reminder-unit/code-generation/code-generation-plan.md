# Code Generation Plan — reminder-unit

## Scope

reminder-unit (U7, `kind: service`, **first release**) owns `Reminder` and `DeviceToken` (`entities.md`), Contract 9's five guest-identity operations (`myReminders`, `registerDeviceToken`, `setRemindersEnabled`, `snoozeReminder`, `cancelReminder`), the Contract 8 consumer (feed-unit's `Post` DynamoDB Stream → cascade-cancel on soft-delete, BR7.9), and reminder delivery via EventBridge Scheduler one-time schedules that invoke `deliver-push` (FCM) and `auto-clear` Lambdas. Rules BR7.1–BR7.11 (`rules.md`) and the workflows in `functional-spec.md` are approved; `infrastructure-specification.md` (as amended for R-04) fixes the tables, the `postIdIndex` and **`ownerIndex`** GSIs, the EventBridge Scheduler group with its execution role, the FCM service-account secret, and the Lambda sizing.

**Carried obligation (R-04, Critical — the builder's "Fix at Code Generation" decision):** both `Reminder` and `DeviceToken` get an `ownerIndex` GSI on `ownerIdentityId`; every lookup by identity is an index Query, never a Scan or a mis-keyed `GetItem`. This plan implements exactly the amended spec.

This Unit extends the shared `amplify/data/resource.ts`, adds four Lambdas, and adds the Scheduler group, scheduler role, and the `Post`-stream event source in `amplify/backend.ts`. Out of scope: `services/reminder_service.dart`, the Calendar screen, OS push-permission handling (flutter-app-unit); the Firebase project itself (flutter-app-unit's Infrastructure Design — a one-time console setup).

## Testing Contract

```json
{
  "version": 1,
  "methodology": "test-after",
  "source": "team",
  "ordering": "implement each applicable testable layer, then write and",
  "scope": "temple-mobile-app",
  "test_strategy": "standard",
  "project_type": "greenfield",
  "applicable_notes": [
    {
      "layer": "org",
      "text": "We treat tests as a first-class deliverable in every Bolt. The specific\nmethodology (TDD, BDD, ATDD, or classic test-after) is affirmed at\npractices-discovery and recorded in `team.md` under this heading with explicit\n`Methodology` and `Ordering` fields; Code Generation resolves those fields\nindependently from coverage, tooling, and scope notes.\n\nWhen no posture has been affirmed, our default per scope is:\n- **Methodology**: test-after\n- **Ordering**: implement each applicable testable layer, then write and run\n  that layer's tests.\n- `mvp`, `enterprise`, `feature`, `infra`, `classic` add an 80% line-coverage\n  floor and CI execution before merge.\n- `bugfix`, `security-patch` add a targeted regression for the specific\n  bug/vulnerability and require the existing suite to remain green.\n- `express` uses the Minimal strategy: requirement-driven unit tests (one per\n  requirement, with a happy-path floor per component); existing tests remain\n  green.\n- `poc`, `refactor`, `workshop` add no extra new-test floor and require the\n  existing suite to remain green.\n\nThe active `Test Strategy` still applies in every scope and determines test\nvolume/types. Scope floors are additive; they never reduce or replace the\nselected strategy.\n\nBuild and Test verifies defined coverage floors and affirmed quality targets;\nthey may not be weakened to make a step pass.\n\nAffirm a stricter posture in `team.md` if the team commits to one."
    },
    {
      "layer": "team",
      "text": "- **Methodology**: test-after\n- **Ordering**: implement each applicable testable layer, then write and\n  run that layer's tests, with the walking-skeleton Bolt held to a lighter\n  smoke-level bar across the board — including the admin allowlist gate —\n  and the standard 80% line-coverage floor applying from the second Bolt\n  onward.\n\nAffirmed specifics (Q4-Q7):\n\n- **Test-after, not TDD/BDD** (Q4): writing code first, then its tests,\n  fits a builder who doesn't yet have confidence in the API/widget shapes\n  of either Flutter or Amplify Gen2 — test-first would compound that\n  learning-curve risk.\n- **Walking-skeleton Bolt test rigor: light smoke-level check everywhere in\n  the skeleton, including the admin allowlist gate** (Q5 — Answer A). The\n  quality agent's review recommended a stricter option for the admin gate\n  specifically (a real pass/fail assertion proving non-admins are\n  rejected, since it's a security boundary), but the human deliberately\n  chose the lighter, uniform smoke-level bar for the entire skeleton\n  instead. This is recorded as the builder's considered choice, not an\n  oversight — a proper test for the admin gate's server-side enforcement\n  is expected to land with the fuller coverage floor from the second Bolt\n  onward, once the architecture is proven end-to-end.\n- **Coverage target beyond the skeleton: the org default's 80%\n  line-coverage floor, adopted as-is** (Q6). The quality agent flagged\n  that the 80% floor's applicability was ambiguous under the custom\n  `temple-mobile-app` scope signal (it isn't in the org default's named\n  scope list); the builder resolved this directly by choosing to adopt the\n  80% target rather than a looser or undefined bar.\n- **CI + backend test framework: GitHub Actions with Jest** (Q7). A single\n  GitHub Actions workflow runs on every push/PR to `main`: `flutter\n  analyze` + `flutter test --coverage` on the Flutter app side, and\n  ESLint/`tsc --noEmit` + Jest on the Amplify Gen2/TypeScript backend\n  side (Lambda handlers, AppSync resolver logic) — blocking merge on\n  failure. This is the project's only enforcement mechanism for test\n  quality, since there is no second reviewer to catch a skipped or\n  weakened test. If Amplify Hosting's own build pipeline is used for\n  deploys, a test step must be added to `amplify.yml` deliberately —\n  Amplify Hosting does not run app-level tests by default.\n- Test-type mix (carried forward from the quality agent's contribution,\n  not separately re-asked, since it elaborates rather than contradicts the\n  affirmed methodology): Flutter unit tests for business logic,\n  `flutter_test` widget tests for UI, and `integration_test` for\n  higher-risk end-to-end flows (Cognito/Google-federation sign-in, the\n  admin allowlist gate, and later the donation flow) — integration-level\n  coverage matters more than usual here because a unit test that mocks the\n  Amplify client can pass while the real integration is still broken. On\n  the backend, Jest unit tests for Lambda handlers and schema/contract\n  checks against the AppSync GraphQL schema, exercised against Amplify\n  Gen2's local sandbox (`ampx sandbox`) rather than a live deployed\n  environment."
    }
  ],
  "obligations": {
    "strategy": "standard",
    "strategy_volume": [
      "Five to eight tests per component.",
      "Unit tests plus integration tests for key boundaries.",
      "Add E2E, performance, or security tests when requirements demand them."
    ],
    "scope_floor": [
      "Keep the existing test suite green.",
      "This scope adds no extra new-test floor beyond the selected test strategy."
    ],
    "combination_rule": "Apply every selected-strategy obligation and every scope-floor obligation; neither replaces the other, and a targeted scope regression may add the narrowest necessary test type beyond the strategy default."
  },
  "plan_profile": {
    "methodology": "test-after",
    "runner_step": "Bootstrap the minimal test runner/configuration and record the exact unit-scoped command.",
    "runner_ready_before_first_test": true,
    "testable_layers": [
      "Data model / database behavior",
      "Repository / data access",
      "Business logic",
      "API / endpoint",
      "Frontend behavior"
    ],
    "steps": [
      "Project structure and production configuration skeleton.",
      "Bootstrap the minimal test runner/configuration and record the exact unit-scoped command.",
      "Data model / database behavior - implement.",
      "Data model / database behavior - write and run its tests after implementation.",
      "Repository / data access - implement.",
      "Repository / data access - write and run its tests after implementation.",
      "Business logic - implement.",
      "Business logic - write and run its tests after implementation.",
      "API / endpoint - implement.",
      "API / endpoint - write and run its tests after implementation.",
      "Frontend behavior - implement.",
      "Frontend behavior - write and run its tests after implementation.",
      "Environment/build configuration.",
      "Documentation and traceability."
    ]
  },
  "input_sha256": "sha256:817e454c78e3d1ec2c498999a8752124a36e6c73860f504900f17dbf0ec17f6a",
  "contract_sha256": "sha256:322e5d191e27095d9fb5ca26b5cd076c3c99c52b68d46d1e676c77d2a10d3881"
}
```

## Steps

Test-after per the contract; the project-wide 80% line-coverage floor stays in force. Frontend behaviour is omitted (flutter-app-unit). Every external system (DynamoDB, EventBridge Scheduler, FCM, the feed's GraphQL API) sits behind an injected adapter so the Lambdas are fully testable offline.

### Step 1 — Project structure

- [x] 1.1 Add runtime dependencies: `@aws-sdk/client-scheduler` (EventBridge Scheduler), `google-auth-library` (FCM HTTP v1 OAuth token from the service-account JSON), `@smithy/signature-v4` + `@aws-sdk/credential-provider-node` + `@aws-crypto/sha256-js` (SigV4-signing the Lambda's `listPosts` call to the shared GraphQL API). `npm install`. No existing script changes except adding `test:reminder`.
- [x] 1.2 Create `amplify/functions/reminder-shared/` (repository, schedules adapter, push sender, feed client, rules, types, errors) and `amplify/functions/reminder-api/`, `amplify/functions/reminder-stream-handler/`, `amplify/functions/deliver-push/`, `amplify/functions/auto-clear/`.

### Step 2 — Test runner: unit-scoped command

- [x] 2.1 Add script `test:reminder`: `NODE_OPTIONS=--experimental-vm-modules jest --rootDir . amplify/data/reminder amplify/functions/reminder amplify/functions/deliver-push amplify/functions/auto-clear`. Verify once with `--passWithNoTests`; the script omits it. `jest.config.ts` unchanged (`coverageThreshold` untouched).

### Step 3 — Data model: two tables, two indexes each, Contract 9's operations

- [x] 3.1 In `amplify/data/resource.ts`: enums `ReminderStatus { SCHEDULED SNOOZED FIRED CLEARED CANCELLED }`, `DevicePlatform { IOS ANDROID }`. Model `Reminder` (`postId`, `ownerIdentityId`, `status`, `initialFireAt`, `snoozeFireAt?`, `createdAt`) with GSIs `postIdIndex` (`postId`) and **`ownerIndex` (`ownerIdentityId`, sorted by `initialFireAt`)** — R-04. Model `DeviceToken` (`ownerIdentityId`, `pushToken`, `platform`, `remindersEnabled`, `registeredAt`) with **`ownerIndex` (`ownerIdentityId`)** — R-04. All generated operations disabled on both. Model authorization `allow.guest().to(['read'])`, `allow.authenticated().to(['read'])` (field-level read of returned types; every row returned by Contract 9 is filtered to the caller's own identity by the Lambda — the enforcing layer for BR7.5/BR7.6 is the Lambda's identity check plus the guest-only operation rules, stated in comments per project.md).
- [x] 3.2 Contract 9 operations, exact names/arguments/returns, all `allow.guest()` + `allow.authenticated()` (a signed-in user still has a guest-pool identity; BR7.6) and all `a.handler.function(reminderApi)`: `myReminders: [Reminder!]!`, `registerDeviceToken(pushToken: String!, platform: DevicePlatform!): DeviceToken!`, `setRemindersEnabled(enabled: Boolean!): DeviceToken!`, `snoozeReminder(id: ID!): Reminder!`, `cancelReminder(id: ID!): Reminder!`. Add `allow.resource(reminderApi).to(['query'])` at schema level so the Lambda can call `listPosts` over IAM (Contract 3, ReminderUnit as second consumer).
- [x] 3.3 In `amplify/backend.ts`: register the four functions; PITR on `Reminder` and `DeviceToken`; an EventBridge Scheduler **group** (`CfnScheduleGroup`, name `reminder-unit-schedules-<stack>`) and a **scheduler execution role** trusting `scheduler.amazonaws.com` with `lambda:InvokeFunction` on exactly `deliver-push` and `auto-clear`; the **`Post` stream event source** on `reminder-stream-handler` (`DynamoEventSource` from feed-unit's `Post` table stream, `StartingPosition.LATEST`, `batchSize: 10`, `bisectBatchOnError: true`, `retryAttempts: 3`); least-privilege IAM per function (Step 9); env injection (table names, group name, scheduler role ARN, the two target Lambda ARNs, `AMPLIFY_DATA_GRAPHQL_ENDPOINT` is set by Amplify for `reminder-api`).
- [x] 3.4 `npx tsc --noEmit` passes.

### Step 4 — Data model: tests

- [x] 4.1 `amplify/data/reminder-schema.test.ts` (7): enums exact; `Reminder`/`DeviceToken` fields per `entities.md`; **both `ownerIndex` GSIs present with the specified keys** and `postIdIndex`; generated operations disabled; the five Contract 9 operations with exact arguments/returns; guest + authenticated on all five; no `Admin` or owner rule anywhere in this Unit.
- [x] 4.2 `amplify/functions/reminder-shared/constants.ts` — `FIRE_HOUR_IST = 9`, `SNOOZE_HOUR_IST = 21`, index names, schedule-name builders `fireScheduleName(id) = 'fire-<id>'`, `clearScheduleName(id) = 'clear-<id>'`; a 1-test file pins them.

### Step 5 — Repository / data access: implement

- [x] 5.1 `reminder-repository.ts` (injected document client): `createReminder`, `getReminderById`, `listRemindersByOwner(ownerIdentityId)` (**Query on `ownerIndex`**, paginated), `listRemindersByPost(postId)` (Query on `postIdIndex`, paginated), `transitionReminder(id, from: status[], to, extra?)` (conditional `UpdateItem`, condition `#status IN (:from…)`; `ConditionalCheckFailedException` → `{ applied: false }`), `getDeviceTokenByOwner(ownerIdentityId)` (**Query on `DeviceToken.ownerIndex`**, first item), `upsertDeviceToken(ownerIdentityId, pushToken, platform, now)` (idempotent per `(ownerIdentityId, pushToken)`: find existing by owner; if same token, update `registeredAt`; else create; `remindersEnabled` defaults true and is preserved on re-register), `setRemindersEnabled(id, enabled)`.
- [x] 5.2 `schedules-adapter.ts` (injected Scheduler client): `createOneTime(name, atIso, targetArn, payload)` (`at(...)` expression, `ActionAfterCompletion: DELETE`, `FlexibleTimeWindow OFF`, the group and role ARN from env), `updateTime(name, atIso, targetArn, payload)`, `delete(name)` (a `ResourceNotFoundException` is a no-op — BR7.10's re-sync semantics). Every call logs `{ schedule, reminderId, fireAt }` (observability-design.md).
- [x] 5.3 `push-sender.ts`: `interface PushSender { send(pushToken, platform, notification): Promise<void> }` and `FcmPushSender` — obtains an OAuth2 token from the service-account JSON (env `REMINDER_FCM_SERVICE_ACCOUNT` via `secret()`) with `google-auth-library`, POSTs to `https://fcm.googleapis.com/v1/projects/<project>/messages:send`; `fetch` injected. A 404/UNREGISTERED response is surfaced as `PushTokenInvalidError`.
- [x] 5.4 `feed-client.ts`: `interface FeedClient { listPosts(): Promise<Array<{ id, type, dateTime }>> }` and `SigV4FeedClient` — signs a `listPosts` GraphQL POST to `AMPLIFY_DATA_GRAPHQL_ENDPOINT` with the Lambda's IAM credentials (`@smithy/signature-v4`), requesting only `id type dateTime`; GraphQL errors are thrown.

### Step 6 — Repository / data access: tests

- [x] 6.1 `reminder-repository.test.ts` (8): `listRemindersByOwner` targets `ownerIndex` with the identity key and paginates; `listRemindersByPost` targets `postIdIndex`; `transitionReminder` sends the `IN` condition and maps a condition failure to `{ applied: false }`; `getDeviceTokenByOwner` targets `DeviceToken.ownerIndex`; `upsertDeviceToken` updates `registeredAt` for the same token and preserves `remindersEnabled`; creates when absent; `setRemindersEnabled` writes only that flag; other errors rethrown.
- [x] 6.2 `schedules-adapter.test.ts` (5): `at(...)` expression in the Scheduler's required `YYYY-MM-DDTHH:MM:SS` form (no `Z`), group + role from env, `ActionAfterCompletion: DELETE`, payload carries the reminder id; `delete` swallows `ResourceNotFoundException` only.
- [x] 6.3 `push-sender.test.ts` (4, fake fetch + fake token provider): correct FCM endpoint and bearer header; message shape (token, notification title/body, data with `reminderId`/`postId`); UNREGISTERED → `PushTokenInvalidError`; other non-2xx → error surfaced.
- [x] 6.4 `feed-client.test.ts` (3, fake signer + fake fetch): query text requests exactly `id type dateTime`; the signed request is sent to the endpoint from env; GraphQL `errors` are thrown.

### Step 7 — Business logic: implement

- [x] 7.1 `rules.ts` (pure): `initialFireAtFor(postDateTimeIso)` → 09:00 IST on the day before the Post's IST date (BR7.2); `snoozeFireAtFor(initialFireAtIso)` → 21:00 IST the same IST day (BR7.3); `isPastSnoozeCutoff(nowIso, initialFireAtIso)`; `hasPostPassed(nowIso, postDateTimeIso)` (BR7.4); `needsBackfill(existingForPost: Reminder[], initialFireAt)` (BR7.1 widened: no existing Reminder for the post with that exact `initialFireAt`); `isTerminal(status)` (`FIRED|CLEARED|CANCELLED`); `dedupeKey(postId, updatedAt)` for the Contract 8 handler (BR7.10).
- [x] 7.2 `stream-events.ts` (pure): `classifyPostRecord(record)` → `'PostDeleted' | 'PostDateTimeChanged' | 'Ignored'` from a DynamoDB Streams `MODIFY` record's old/new images (`deletedAt` transitioning from absent to set → `PostDeleted`; `dateTime` changed → `PostDateTimeChanged`; anything else, and `INSERT`/`REMOVE`, → `Ignored`) — Contract 8's amended semantics.

### Step 8 — Business logic: tests

- [x] 8.1 `rules.test.ts` (9): `initialFireAtFor` for an event at 02:00 IST (date rollover from UTC) and at 22:00 IST; snooze time is 21:00 IST same day; cutoff before/after 21:00; `hasPostPassed` boundary; `needsBackfill` false when an exact match exists, true when only a stale-date Reminder exists (BR7.1 widened), true when none; `isTerminal`; `dedupeKey` shape.
- [x] 8.2 `stream-events.test.ts` (5): soft-delete MODIFY → `PostDeleted`; `dateTime` change → `PostDateTimeChanged`; unrelated MODIFY → `Ignored`; INSERT → `Ignored`; REMOVE → `Ignored`.

### Step 9 — API / endpoint: four Lambdas

- [x] 9.1 `amplify/functions/reminder-api/resource.ts` (128MB/10s, `resourceGroupName: 'data'`, env: both table names, group, role ARN, `DELIVER_PUSH_ARN`, `AUTO_CLEAR_ARN`) + `handler.ts` (`createHandler(deps)`, dispatch on `event.info.fieldName`; caller identity = `event.identity.cognitoIdentityId` (IAM/guest) — never an argument):
  - `registerDeviceToken` → `upsertDeviceToken` (BR7.1's default `remindersEnabled = true`); `setRemindersEnabled` → `getDeviceTokenByOwner` (not-found error if the device never registered) → `setRemindersEnabled` — **touches no Reminder** (BR7.7).
  - `myReminders` (BR7.1 sync): `listPosts` via `FeedClient` → filter `type == EVENT` → `listRemindersByOwner` → for each Event post compute `initialFireAtFor`; if `needsBackfill` and the device's `remindersEnabled !== false` (a device with no DeviceToken yet gets no auto-creation — nothing to deliver to; documented), create `SCHEDULED` Reminder then `createOneTime(fire-<id>, initialFireAt, DELIVER_PUSH_ARN)` and `createOneTime(clear-<id>, post.dateTime, AUTO_CLEAR_ARN)`; return the owner's reminders (existing + new).
  - `snoozeReminder` (BR7.3 exactly, in this order): ownership check first (refuse otherwise) → already `SNOOZED` → re-issue `updateTime(fire-<id>, snoozeFireAt)` and return unchanged → `SCHEDULED` and now < 21:00 IST → `transitionReminder([SCHEDULED] → SNOOZED, { snoozeFireAt })` then `updateTime` → `SCHEDULED` past cutoff → refuse with a plain-language message → terminal → return unchanged with no Scheduler call.
  - `cancelReminder` (BR7.5/BR7.10): ownership check → if `SCHEDULED|SNOOZED` → `transitionReminder(→ CANCELLED)`; in every case (including already terminal) issue `delete(fire-<id>)` **and** `delete(clear-<id>)`; return the Reminder.
- [x] 9.2 `amplify/functions/reminder-stream-handler/resource.ts` (128MB/10s) + `handler.ts` (DynamoDB Streams event): for each record → `classifyPostRecord`; `PostDeleted` → `listRemindersByPost(postId)` → for each `SCHEDULED|SNOOZED` → `transitionReminder(→ CANCELLED)` + `delete` both schedules (BR7.9); idempotent via the conditional transition (a redelivery finds no `SCHEDULED|SNOOZED` rows and re-issues the schedule deletes, which are no-ops — BR7.10); `PostDateTimeChanged` → no-op (BR7.8, builder's simplicity choice, logged at debug); per-record errors isolated; the function returns `batchItemFailures` for partial-batch retry.
- [x] 9.3 `amplify/functions/deliver-push/resource.ts` (128MB/10s) + `handler.ts` (Scheduler payload `{ reminderId }`): `getReminderById` → skip unless `SCHEDULED|SNOOZED` → `getDeviceTokenByOwner` (no token or `remindersEnabled === false`? the design says the toggle affects only auto-creation, so an existing Reminder still fires — deliver if a token exists) → `PushSender.send` → `transitionReminder([SCHEDULED, SNOOZED] → FIRED)`; emit `reminder-delivery-delta` (seconds between now and the intended fire time) as a CloudWatch metric via the existing `donation-shared/logging.ts` pattern + `@aws-sdk/client-cloudwatch` (already a dependency); `PushTokenInvalidError` → log and mark FIRED anyway? **No** — leave the Reminder `SCHEDULED|SNOOZED` and log a warning (the user can still see it in Calendar); documented.
- [x] 9.4 `amplify/functions/auto-clear/resource.ts` (128MB/5s) + `handler.ts` (payload `{ reminderId }`): `transitionReminder([SCHEDULED, SNOOZED, FIRED] → CLEARED)` (BR7.4; `CANCELLED` excluded by the condition); `delete(fire-<id>)` as belt-and-braces (a snoozed reminder's fire schedule may still be pending when the event passes).
- [x] 9.5 `amplify/backend.ts` IAM (least privilege): `reminder-api` — `dynamodb:Query` on `Reminder/index/ownerIndex` and `DeviceToken/index/ownerIndex`, `GetItem/PutItem/UpdateItem` on both tables, `scheduler:CreateSchedule/UpdateSchedule/DeleteSchedule` on `arn:aws:scheduler:*:*:schedule/<group>/*`, `iam:PassRole` on the scheduler role (required to create schedules with that role); `reminder-stream-handler` — `dynamodb:Query` on `Reminder/index/postIdIndex`, `UpdateItem` on `Reminder`, `scheduler:DeleteSchedule` on the group; `deliver-push` — `GetItem/UpdateItem` on `Reminder`, `Query` on `DeviceToken/index/ownerIndex`, `cloudwatch:PutMetricData` (namespace condition `SarovarJinalaya/Reminders`); `auto-clear` — `UpdateItem` on `Reminder`, `scheduler:DeleteSchedule` on the group. The stream event source grants the read/describe stream permissions itself.
- [x] 9.6 `npm run lint` and `npm run typecheck` pass.

### Step 10 — API / endpoint: tests

- [x] 10.1 `reminder-api/handler.test.ts` (14, fakes for repository / schedules / feed client): identity from `cognitoIdentityId` only; `registerDeviceToken` upserts idempotently; `setRemindersEnabled` touches no Reminder; `myReminders` backfills only Event posts, only when `needsBackfill`, only when `remindersEnabled !== false`, creates BOTH schedules with the right times/targets, returns existing + new; `snoozeReminder`: non-owner refused before anything else; already-SNOOZED re-issues `updateTime` and returns unchanged; SCHEDULED before 21:00 → SNOOZED + `updateTime`; past cutoff refused; terminal → unchanged, no Scheduler call; `cancelReminder`: non-owner refused; SCHEDULED → CANCELLED + both deletes; already terminal → both deletes still issued, no transition.
- [x] 10.2 `reminder-stream-handler/handler.test.ts` (5): soft-delete cancels SCHEDULED/SNOOZED and deletes both schedules; leaves FIRED/CLEARED/CANCELLED untouched; redelivery (no active rows) is a no-op that still issues deletes; `PostDateTimeChanged` does nothing; one bad record → `batchItemFailures` lists only it.
- [x] 10.3 `deliver-push/handler.test.ts` (5): sends to the owner's token and marks FIRED; skips a terminal Reminder; no DeviceToken → warning, no transition; invalid token → warning, no transition; emits the delivery-delta metric.
- [x] 10.4 `auto-clear/handler.test.ts` (4): clears from SCHEDULED, SNOOZED, FIRED; leaves CANCELLED; deletes the fire schedule; conditional failure is a no-op, not an error.
- [x] 10.5 `npm run test:reminder` green; `npm test -- --coverage` green with the 80% floor; lint, typecheck, prettier clean.

### Omitted layer

- **Frontend behavior**: `services/reminder_service.dart`, the Calendar screen, OS permission prompts (flutter-app-unit).

### Step 11 — Environment/build configuration

- [x] 11.1 `README.md`: a "Calendar & Reminders" section — the five operations (guest identity, no sign-in), the lazy sync/backfill model and the on-by-default rule, fire times (09:00 IST day before; snooze 21:00 IST), the EventBridge Scheduler model (two one-time schedules per Reminder, group, execution role), the Contract 8 stream consumer and BR7.8's deliberate no-op, FCM setup (`npx ampx sandbox secret set REMINDER_FCM_SERVICE_ACCOUNT` with the Firebase service-account JSON; the APNs key upload is flutter-app-unit's Infrastructure Design item), the `ownerIndex` fix (R-04), and the permissions self-review list.

### Step 12 — Documentation and traceability

- [x] 12.1 Doc comments naming the rule each piece realizes (BR7.1–BR7.11, NFR-PERF.3, NFR-OBS.1/3).
- [x] 12.2 Write `source-manifest.json` (every path created or modified; not `node_modules/`).
- [x] 12.3 The conductor writes `code-summary.md` and `traceability.json`, and records the closure of R-04 in the stage diary.

## Rule-to-step traceability

| Rule / requirement | Realized by |
|---|---|
| BR7.1 lazy sync, on by default, widened backfill | 7.1 `needsBackfill`, 9.1 `myReminders`, 10.1 |
| BR7.2 09:00 IST day before | 7.1, 8.1 |
| BR7.3 snooze 21:00 IST, ownership first, no-op re-sync | 9.1 `snoozeReminder`, 10.1 |
| BR7.4 auto-clear from SCHEDULED/SNOOZED/FIRED | 9.4, 10.4 |
| BR7.5 owner-only cancel | 9.1, 10.1 |
| BR7.6 guest identity only | 3.2 `allow.guest()`, 9.1 identity source |
| BR7.7 toggle affects only auto-creation | 9.1 `setRemindersEnabled`, 9.3 |
| BR7.8 no-op on dateTime change | 9.2, 10.2 |
| BR7.9 cascade-cancel on soft delete | 7.2, 9.2, 10.2 |
| BR7.10 idempotency | 5.1 conditional transitions, 5.2 no-op delete, 9.1/9.2 |
| BR7.11 server-side push | 5.3, 9.3 |
| R-04 `ownerIndex` on both tables | 3.1, 4.1, 5.1, 6.1, 9.5 |
| NFR-PERF.3 EventBridge Scheduler | 3.3, 5.2, 9.1 |
| NFR-OBS.1/3 delivery-delta metric, correlation ids in schedule logs | 5.2, 9.3 |

## Known deviations declared up front

- **Four Lambdas instead of six**: the five Contract 9 operations share one `reminder-api` Lambda (`registerDeviceToken`/`setRemindersEnabled` cannot be direct resolvers — guest authorization is refused on no-Lambda custom resolvers in the installed Amplify, the same constraint every other Unit hit; and `myReminders`/`snooze`/`cancel` were already Lambda-backed). Infra spec's per-function IAM intent is preserved for the three non-API Lambdas; the API Lambda's role is the union of its five operations' needs. Infra spec amendment note recorded.
- **`listPosts` reached over IAM with SigV4** rather than Amplify's generated data client in Lambda: that client depends on a code-generated `$amplify/env/<fn>` module that exists only after a sandbox/pipeline deploy, which would break `tsc` in CI; a signed GraphQL POST has no such dependency.
- **Invalid push token leaves the Reminder pending** (not FIRED, not CANCELLED) with a warning; the design does not specify this case.
- **A device without a registered `DeviceToken` gets no auto-created Reminders on sync** — there is nothing to deliver to; the Calendar still shows events. Documented.
- **FCM secret via Amplify `secret()`** (SSM SecureString) — the same recorded deviation as every other Unit.
