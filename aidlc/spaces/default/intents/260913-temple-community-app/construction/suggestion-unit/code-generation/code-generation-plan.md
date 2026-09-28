# Code Generation Plan — suggestion-unit

## Scope

suggestion-unit (U3, `kind: service`, **first release**) owns the `Suggestion` entity and the internal `SuggestionDailyCount` rate-limit counter (`entities.md`), and the three Contract 4 operations: `submitSuggestion(text)` (any signed-in user), `myPastSuggestions` (owner-only), `allSuggestions` (Admin only). Rules BR3.1–BR3.6 (`rules.md`) and the workflows in `functional-spec.md` are approved; `infrastructure-specification.md` fixes two Lambdas (`submit-suggestion` 128MB/5s, `all-suggestions` 256MB/30s), a direct resolver for `myPastSuggestions`, two DynamoDB tables (the counter table with a TTL attribute), and a custom `suggestion-count` CloudWatch metric.

This Unit extends the shared `amplify/data/resource.ts`, adds two Lambdas under `amplify/functions/`, and enables TTL on the counter table in `amplify/backend.ts`. Out of scope: `services/suggestion_service.dart` and the three suggestion screens (flutter-app-unit).

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

Test-after per the contract; the project-wide 80% line-coverage floor stays in force. Frontend behaviour is omitted (flutter-app-unit).

### Step 1 — Project structure

- [x] 1.1 Add runtime dependency `@aws-sdk/client-cloudwatch` (the `suggestion-count` metric, NFR-OBS.1). `npm install`. No existing script changes except adding `test:suggestion`.
- [x] 1.2 Create `amplify/functions/suggestion-shared/`, `amplify/functions/submit-suggestion/`, `amplify/functions/all-suggestions/`, and `amplify/data/suggestion-resolvers/` (one APPSYNC_JS resolver for `myPastSuggestions`).

### Step 2 — Test runner: unit-scoped command

- [x] 2.1 Add script `test:suggestion`: `NODE_OPTIONS=--experimental-vm-modules jest --rootDir . amplify/data/suggestion amplify/functions/suggestion-shared amplify/functions/submit-suggestion amplify/functions/all-suggestions`. Verify once with `--passWithNoTests`; the script omits it. `jest.config.ts` unchanged.

### Step 3 — Data model: two tables and Contract 4's operations

- [x] 3.1 In `amplify/data/resource.ts`: model `Suggestion` (`submittedByGoogleId` required, `text` required, `submittedAt` required datetime) with generated mutations/subscriptions disabled and generated queries disabled (Contract 4's names must stay exact), secondary index `submitterIndex` (`submittedByGoogleId`, sorted by `submittedAt`), and authorization `allow.ownerDefinedIn('submittedByGoogleId').identityClaim('sub').to(['read'])` + `allow.group('Admin').to(['read'])` (BR3.3 — the declarative layer that enforces visibility; no delete anywhere — BR3.4).
- [x] 3.2 Model `SuggestionDailyCount` (`count` integer, `ttl` integer) — internal only: all generated operations disabled, authorization `allow.group('Admin').to(['read'])` only (an admin may inspect counters through the console; no client operation exposes them; the Lambda writes via IAM). Its `id` is `<sub>#<YYYY-MM-DD in Asia/Kolkata>`.
- [x] 3.3 Operations, names/arguments/returns exactly as Contract 4:
  - `submitSuggestion(text: String!): Suggestion!` — `allow.authenticated()` (BR3.2), `a.handler.function(submitSuggestion)`.
  - `myPastSuggestions: [Suggestion!]!` — `allow.authenticated()`, `a.handler.custom({ dataSource: a.ref('Suggestion'), entry: './suggestion-resolvers/myPastSuggestions.js' })`: a Query on `submitterIndex` keyed on `ctx.identity.sub`, newest first (the direct resolver the infra spec chose; `authenticated` is accepted on custom handlers — only guest is not).
  - `allSuggestions: [Suggestion!]!` — `allow.group('Admin')` (BR3.3), `a.handler.function(allSuggestions)`.
- [x] 3.4 In `amplify/backend.ts`: enable TTL on the `SuggestionDailyCount` table (`timeToLiveAttribute: { attributeName: 'ttl', enabled: true }` on its Amplify table wrapper, or the L1 fallback); enable PITR on `Suggestion` (reliability-design.md's recommendation, matching donations). Existing wiring untouched.
- [x] 3.5 `npx tsc --noEmit` passes.

### Step 4 — Data model: tests

- [x] 4.1 `amplify/data/suggestion-schema.test.ts` (6): `Suggestion` fields per `entities.md`; generated operations disabled on both models; `submitterIndex`; the three Contract 4 operations with exact names/returns; `submitSuggestion`/`myPastSuggestions` allow authenticated only, `allSuggestions` allows only `Admin`; `SuggestionDailyCount` exposes no client operation and no owner rule.

### Step 5 — Repository / data access: implement

- [x] 5.1 `amplify/functions/suggestion-shared/suggestion-repository.ts` (injected document client): `create(suggestion)` (conditional on new id), `listAll()` (Scan, follows `LastEvaluatedKey`), and `tryIncrementDailyCount(sub, istDate, ttlEpochSeconds)` — the atomic conditional `UpdateItem` from `entities.md`/BR3.5: `ADD #count :one SET #ttl = if_not_exists(#ttl, :ttl)` with condition `attribute_not_exists(#count) OR #count < :five`; a `ConditionalCheckFailedException` returns `{ allowed: false }`, any other error is rethrown. Table names from env `SUGGESTION_TABLE_NAME`, `SUGGESTION_DAILY_COUNT_TABLE_NAME`.
- [x] 5.2 `amplify/functions/suggestion-shared/metrics.ts` (injected CloudWatch client): `emitSuggestionCount()` → `PutMetricData` namespace `SarovarJinalaya/Suggestions`, metric `suggestion-count`, value 1; a failure is logged and swallowed (a metric must never fail a submission — NFR-OBS.1 is observability, not correctness).

### Step 6 — Repository / data access: tests

- [x] 6.1 `suggestion-repository.test.ts` (6): create condition; `listAll` pagination; `tryIncrementDailyCount` sends exactly the BR3.5 expressions with `:five = 5` and the key `<sub>#<date>`; condition failure → `{ allowed: false }`; other errors rethrown; `ttl` set with `if_not_exists`.
- [x] 6.2 `metrics.test.ts` (3): metric name/namespace/value; a CloudWatch error is swallowed and logged; the client is called once per emission.

### Step 7 — Business logic: implement

- [x] 7.1 `amplify/functions/suggestion-shared/rules.ts`: `MAX_WORDS = 300`, `DAILY_LIMIT = 5`, `wordCount(text)` (trim, split on whitespace runs — BR3.1), `validateText(text)` (non-empty after trim; ≤ 300 words), `istDateOf(isoNow)` (the `YYYY-MM-DD` in `Asia/Kolkata`, computed with `Intl.DateTimeFormat` — no library), `istMidnightPlus48hEpochSeconds(isoNow)` (the counter's TTL: next IST midnight + 48 h, per NFR Design's cleanup rule).

### Step 8 — Business logic: tests

- [x] 8.1 `rules.test.ts` (8): 300 words accepted, 301 rejected; multiple spaces/newlines count as one separator; empty/whitespace-only rejected; IST date for a UTC instant just before and just after IST midnight (18:30Z boundary); TTL is after the IST midnight that follows `now` by 48 h; `DAILY_LIMIT` is 5.

### Step 9 — API / endpoint: the two Lambdas and the one resolver

- [x] 9.1 `amplify/functions/submit-suggestion/resource.ts` (128MB/5s, `resourceGroupName: 'data'`) + `handler.ts` (`createHandler(deps)`): identity `sub` from `event.identity` only (BR3.2); `validateText` (BR3.1) → `tryIncrementDailyCount(sub, istDateOf(now), ttl)` → if not allowed, throw a `DailyLimitExceededError` with a plain-language message ("You can submit up to 5 suggestions a day; try again after midnight IST") and NO record created (BR3.5) → `create({ id: uuid, submittedByGoogleId: sub, text, submittedAt: now })` → `emitSuggestionCount()` (best-effort) → return the `Suggestion`.
- [x] 9.2 `amplify/functions/all-suggestions/resource.ts` (256MB/30s, `resourceGroupName: 'data'`) + `handler.ts`: admin backstop (`groups` contains `Admin`, behind the declarative rule) → `listAll()` → sort newest first (`functional-spec.md` ordering).
- [x] 9.3 `amplify/data/suggestion-resolvers/myPastSuggestions.js` (APPSYNC_JS, `// @ts-check`): request = DynamoDB `Query` on `submitterIndex` with `submittedByGoogleId = ctx.identity.sub`, `scanIndexForward: false`; response = items (the owner rule on the model is the enforcing layer; the resolver's key is the caller's own identity so no other user's rows can be requested).
- [x] 9.4 `amplify/backend.ts`: register both functions; least-privilege IAM — `submitSuggestion`: `dynamodb:UpdateItem` on the counter table only, `dynamodb:PutItem` on the `Suggestion` table only, `cloudwatch:PutMetricData` (no resource scoping exists for it — condition `cloudwatch:namespace = SarovarJinalaya/Suggestions`); `allSuggestions`: `dynamodb:Scan` on the `Suggestion` table only. Inject both table names into both functions as needed.
- [x] 9.5 `npm run lint` and `npm run typecheck` pass.

### Step 10 — API / endpoint: tests

- [x] 10.1 `submit-suggestion/handler.test.ts` (7): over-300-words rejected before any write; limit reached → error and no `create`; happy path increments THEN creates with `submittedByGoogleId = identity.sub` and `submittedAt = now`; the counter key uses the IST date; the metric is emitted after the create; a metric failure does not fail the submission; a repository error on `create` is surfaced (the counter was already incremented — documented as the accepted ordering: a failed write still costs one of the day's five, never the reverse).
- [x] 10.2 `all-suggestions/handler.test.ts` (4): non-admin refused; scans all pages; sorted newest first; empty → `[]`.
- [x] 10.3 `suggestion-resolvers/myPastSuggestions.test.ts` (4, via the `@aws-appsync/utils` double): Query targets `submitterIndex`; key equals `identity.sub` and never an argument; descending order; response returns items / empty.
- [x] 10.4 `npm run test:suggestion` green; `npm test -- --coverage` green with the 80% floor; lint, typecheck, prettier clean.

### Omitted layer

- **Frontend behavior**: `services/suggestion_service.dart` and the three suggestion screens belong to flutter-app-unit.

### Step 11 — Environment/build configuration

- [x] 11.1 `README.md`: a "Suggestion Box" section — the three operations and who may call them, the enforcing layer vs. backstop, the 300-word and 5-per-IST-day limits and how the atomic counter works, that suggestions are permanent (no delete, no read/resolved state), the custom metric, and the counter table's TTL.

### Step 12 — Documentation and traceability

- [x] 12.1 Doc comments naming the rule each piece realizes (BR3.1–BR3.6, NFR-RATE.1, NFR-OBS.1).
- [x] 12.2 Write `source-manifest.json` (every path created or modified; not `node_modules/`).
- [x] 12.3 The conductor writes `code-summary.md` and `traceability.json`.

## Rule-to-step traceability

| Rule / requirement | Realized by |
|---|---|
| BR3.1 300 words | 7.1, 8.1, 9.1, 10.1 |
| BR3.2 signed-in only, identity from token | 3.3 `allow.authenticated()`, 9.1, 10.1 |
| BR3.3 owner/admin visibility, declarative | 3.1, 3.3, 4.1, 9.3 |
| BR3.4 no delete | 3.1 (no mutation exists) |
| BR3.5 5/day IST, atomic | 5.1, 6.1, 7.1, 8.1, 9.1, 10.1 |
| BR3.6 no read/resolved tracking | 3.1 (no such field or mutation) |
| NFR-RATE.1 | 5.1, 3.4 (TTL) |
| NFR-OBS.1 suggestion-count metric | 5.2, 6.2, 9.1 |
| NFR2.3 PITR on Suggestion | 3.4 |

## Known deviations declared up front

- **`ttl` set via `if_not_exists`** inside the same atomic update (the design describes the TTL value but not which write sets it) — one request, no extra round trip.
- **Counter-then-create ordering**: a submission whose `Suggestion` write fails after the counter incremented still consumes one of the day's five. The reverse (a record without a counted slot) is impossible; accepted and documented.
- `SuggestionDailyCount` modeled in the Amplify schema (so Amplify provisions and TTL-configures the table) but with no client-facing operation — matches "internal only, not part of Contract 4".
