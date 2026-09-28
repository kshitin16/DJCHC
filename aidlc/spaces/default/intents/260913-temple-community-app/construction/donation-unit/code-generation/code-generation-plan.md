# Code Generation Plan — donation-unit (thin, flagged-off build)

## Scope

donation-unit (U4, `kind: service`, **later release**) owns the `Donation` entity (`entities.md`), three Contract 5 GraphQL operations (`initiateDonation`, `cancelDonation`, `myDonations`), the Contract 7 aggregator webhook receiver, and the scheduled reconciliation poller (`infrastructure-specification.md`). Its rules BR5.1–BR5.6 (`rules.md`) and three workflows (`functional-spec.md`) are designed and approved.

**The builder chose a thin, flagged-off build for this pass** (the payment aggregator account does not exist yet and FR5.4's tax-exemption precondition is unconfirmed). This plan therefore builds everything that does NOT depend on the real aggregator — the data model, authorization rules, validation, the idempotent webhook write, the reconciliation decision logic, and their tests — and isolates every aggregator interaction behind **one adapter interface** (`AggregatorAdapter`) with a single placeholder implementation. A backend-wide constant `DONATIONS_ENABLED = false` makes every entry point refuse cleanly until the real adapter lands. When the aggregator is chosen, exactly one file changes (`aggregator-adapter.ts`'s implementation) plus the flag.

This Unit also extends the auth-unit scaffold: it introduces `amplify/data/resource.ts` (the shared Amplify Data schema that feed-, suggestion-, pdf-library- and reminder-unit will add their models to) and the first `amplify/functions/*` directories.

Deliberately deferred to the full build (recorded as `Deferred` in `traceability.json`): the SNS `donation-reconciliation-alerts` topic and email subscription (an Environment Provisioning action per the infra spec), custom EMF metrics, and the real aggregator client.

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

Test-after per the contract: implement each layer, then write and run its tests. This is no longer the walking-skeleton Bolt, so the **80% line-coverage floor applies from here** and is enforced in `jest.config.ts` (Step 2.1). Frontend behaviour is omitted (flutter-app-unit owns `services/donation_service.dart`).

### Step 1 — Project structure and production configuration skeleton

- [x] 1.1 Add runtime/dev dependencies to the existing root `package.json`: `@aws-sdk/client-dynamodb`, `@aws-sdk/lib-dynamodb` (Lambda data access), `@types/aws-lambda` (dev). Run `npm install`. Do not change any existing script except adding `test:donation`.
- [x] 1.2 Create the directory layout: `amplify/data/resource.ts` (new shared schema file), `amplify/functions/donation-api/`, `amplify/functions/donation-webhook/`, `amplify/functions/donation-reconciler/`, and a shared `amplify/functions/donation-shared/` for code the three Lambdas have in common (types, adapter, flag, repository).
- [x] 1.3 Add `amplify/donations-flag.ts` exporting `export const DONATIONS_ENABLED = false as const` with a doc comment explaining the later-release gate (FR5.4, aggregator account pending). Every donation Lambda receives it as env `DONATIONS_ENABLED`.

### Step 2 — Test runner: record the unit-scoped command and raise the coverage floor

- [x] 2.1 In `jest.config.ts`, add `coverageThreshold: { global: { lines: 80 } }` (team.md Q6 — the second Bolt onward; never lowered later) and keep `collectCoverageFrom` excluding `amplify/backend.ts` and the `amplify/functions/*/resource.ts` definition files (declarative, no logic).
- [x] 2.2 Add script `test:donation`: `NODE_OPTIONS=--experimental-vm-modules jest --rootDir . amplify/data amplify/functions/donation` (runs only this Unit's test files). Verify once with `--passWithNoTests` at bootstrap; the script itself omits it. Confirm `npm run test:auth` still passes (existing suite stays green).

### Step 3 — Data model: implement the `Donation` model in the shared Amplify Data schema

- [x] 3.1 Create `amplify/data/resource.ts` with `defineData({ schema, authorizationModes: { defaultAuthorizationMode: 'userPool' } })`. Schema:
  - Enums `DonationType { ONE_TIME RECURRING }`, `DonationFrequency { MONTHLY QUARTERLY YEARLY }`, `DonationStatus { INITIATED PENDING SUCCEEDED FAILED CANCELLED }` — Contract 5 verbatim.
  - Model `Donation` with fields exactly per `entities.md`: `donorGoogleId` (required string), `amount` (required float), `donationType`, `frequency` (optional), `status` (required, enum), `aggregatorTransactionId` (optional), `createdAt` (required datetime), `cancelledAt` (optional), plus the internal `processedPaymentId` (optional string, `security-design.md`'s idempotency attribute — never exposed by Contract 5's custom operations).
  - Secondary indexes: `statusIndex` on `status` sorted by `createdAt` (`infrastructure-specification.md`, reconciler's PENDING lookup) and `donorIndex` on `donorGoogleId` sorted by `createdAt` (needed for `myDonations`; the same class of gap reminder-unit's R-04 found — declared here rather than left to a Scan).
  - Model authorization: `allow.ownerDefinedIn('donorGoogleId').identityClaim('sub').to(['read'])` — a donor can read only their own rows through the generated API; **no** create/update/delete via the generated model API (all writes go through the Lambdas below, which is the layer that actually enforces BR5.2/5.3/5.6 — stated explicitly per project.md's correction).
  - Custom operations, all `allow.authenticated()` (Contract 1) and handled by the `donation-api` function: `initiateDonation(amount: Float!, donationType: DonationType!, frequency: DonationFrequency): DonationInitiation!`, `cancelDonation(id: ID!): Donation!`, `myDonations: [Donation!]!` — names, arguments, and return shapes exactly as Contract 5, including custom type `DonationInitiation { donationId: ID!, checkoutUrl: AWSURL!, checkoutReference: String! }`.
- [x] 3.2 `npx tsc --noEmit` passes.

### Step 4 — Data model: tests

- [x] 4.1 `amplify/data/donation-schema.test.ts` (6 tests): the three enums carry Contract 5's exact values; `Donation` declares every `entities.md` field plus `processedPaymentId`; `statusIndex` and `donorIndex` exist with `createdAt` sort keys; the model grants owners `read` only; the three custom operations exist with Contract 5's argument names; `DonationInitiation` has the three contract fields. Assert on the schema's exported definition object (`schema.data`/`.models`/`.customOperations` as the Amplify schema builder exposes them) — no synthesis, no mocking of `@aws-amplify/backend`.

### Step 5 — Repository / data access: implement

- [x] 5.1 `amplify/functions/donation-shared/donation-repository.ts`: a small class over `DynamoDBDocumentClient` (injected, so tests pass a fake) with `create(donation)`, `getById(id)`, `queryByDonor(donorGoogleId)` (uses `donorIndex`), `queryPendingOlderThan(cutoffIso)` (uses `statusIndex`), `markPending(id, aggregatorTransactionId)` (conditional: status = INITIATED), `applySettlement(id, status, paymentId)` — the exact conditional `UpdateItem` from `security-design.md` (`SET status, processedPaymentId` with `attribute_not_exists(processedPaymentId) OR processedPaymentId <> :p`; a `ConditionalCheckFailedException` is caught and returned as `{ applied: false }` — BR5.5), and `markCancelled(id, cancelledAt)` (conditional: status = SUCCEEDED AND donationType = RECURRING). Table name from env `DONATION_TABLE_NAME`.

### Step 6 — Repository / data access: tests

- [x] 6.1 `amplify/functions/donation-shared/donation-repository.test.ts` (7 tests) with a fake document client capturing commands: create writes INITIATED + createdAt; `queryByDonor` targets `donorIndex`; `queryPendingOlderThan` targets `statusIndex` with `status = PENDING` and a `createdAt <` range; `markPending` carries the INITIATED condition; `applySettlement` sends exactly the security-design UpdateExpression/ConditionExpression and never touches `aggregatorTransactionId`; `applySettlement` maps `ConditionalCheckFailedException` to `{ applied: false }` and rethrows anything else; `markCancelled` carries the SUCCEEDED + RECURRING condition.

### Step 7 — Business logic: implement

- [x] 7.1 `amplify/functions/donation-shared/validation.ts`: `validateInitiation({ amount, donationType, frequency })` returning a typed result — BR5.2 (amount > 0, finite) and BR5.3 (frequency iff RECURRING).
- [x] 7.2 `amplify/functions/donation-shared/aggregator-adapter.ts`: `interface AggregatorAdapter { createCheckout(donation): Promise<{ checkoutUrl, checkoutReference, aggregatorTransactionId }>; getPaymentRecord(aggregatorTransactionId): Promise<'captured' | 'failed' | 'absent'>; stopMandate(aggregatorTransactionId): Promise<void>; verifyWebhookSignature(rawBody: string, signatureHeader: string, secret: string): boolean }` and `class PlaceholderAggregatorAdapter` whose three network methods throw `AggregatorNotConfiguredError` (the one file the real aggregator replaces), while `verifyWebhookSignature` is a real HMAC-SHA256 hex comparison using `crypto.timingSafeEqual` — the Razorpay-compatible shape Contract 7 assumes. BR5.1: the adapter's types carry no field that could hold a card number or UPI PIN.
- [x] 7.3 `amplify/functions/donation-shared/reconciliation.ts`: pure `decideSettlement(record: 'captured' | 'failed' | 'absent')` → `SUCCEEDED | FAILED` (BR5.4: absent counts as FAILED per the state machine), and `parseWebhook(body)` → `{ event, orderId, paymentId }` validating Contract 7's shape (`event ∈ payment.captured | payment.failed`, `payload.order_id`, `payload.payment_id` required).
- [x] 7.4 `amplify/functions/donation-shared/flag.ts`: `assertDonationsEnabled(env)` throwing `DonationsDisabledError('Donations are not available yet')` when `DONATIONS_ENABLED !== 'true'`.

### Step 8 — Business logic: tests

- [x] 8.1 `validation.test.ts` (6 tests): positive amount accepted; zero rejected; negative rejected; NaN/Infinity rejected; RECURRING without frequency rejected; ONE_TIME with frequency rejected.
- [x] 8.2 `aggregator-adapter.test.ts` (5 tests): valid HMAC accepted; tampered body rejected; wrong secret rejected; each of the three network methods throws `AggregatorNotConfiguredError`; the adapter's request type has no credential-like field (type-level test via a compile-time assertion plus a runtime key check).
- [x] 8.3 `reconciliation.test.ts` (6 tests): captured→SUCCEEDED; failed→FAILED; absent→FAILED; `parseWebhook` accepts a valid payload; rejects an unknown event; rejects a missing `order_id`.
- [x] 8.4 `flag.test.ts` (2 tests): disabled throws; `'true'` passes.

### Step 9 — API / endpoint: implement the three Lambdas

- [x] 9.1 `amplify/functions/donation-api/resource.ts` (`defineFunction`, 256MB/10s, env `DONATION_TABLE_NAME`, `DONATIONS_ENABLED`, `DONATION_AGGREGATOR_API_KEY: secret('DONATION_AGGREGATOR_API_KEY')`) and `handler.ts`: an AppSync resolver handler dispatching on `event.info.fieldName` — `initiateDonation` (flag check → validate → create INITIATED → adapter `createCheckout` → `markPending` → return `DonationInitiation`; on adapter failure the row stays INITIATED and a plain-language error is thrown — `functional-spec.md` error path), `cancelDonation` (flag check → `getById` → BR5.6 owner check against `event.identity.sub` → adapter `stopMandate` → `markCancelled`; never CANCELLED before the aggregator acknowledges), `myDonations` (flag check → `queryByDonor(event.identity.sub)`). Identity comes only from the verified JWT (`event.identity.sub`), never from arguments.
- [x] 9.2 `amplify/functions/donation-webhook/resource.ts` (256MB/10s, env `DONATION_TABLE_NAME`, `DONATIONS_ENABLED`, `DONATION_AGGREGATOR_WEBHOOK_SECRET: secret('DONATION_AGGREGATOR_WEBHOOK_SECRET')`) and `handler.ts` (Function URL event): flag off → 404; signature check FIRST (401 on failure, no DB access); `parseWebhook`; `getById(order_id)` (404 + log when absent — never guess); `applySettlement(id, decideSettlement(event), payment_id)`; 200 whether applied or a duplicate (BR5.5). The Function URL itself (auth `NONE`, `infrastructure-specification.md`) is attached in `backend.ts` via `backend.donationWebhook.resources.lambda.addFunctionUrl({ authType: FunctionUrlAuthType.NONE })` and its URL exported as an output.
- [x] 9.3 `amplify/functions/donation-reconciler/resource.ts` (256MB/60s, `schedule: 'every 1m'`, same env plus API key secret) and `handler.ts`: flag off → return; `queryPendingOlderThan(now − confirmation window)`; for each, `adapter.getPaymentRecord` → `applySettlement(decideSettlement(...))` (BR5.4 — the aggregator's record, never the timeout); per-item errors are logged and skipped so one failure does not stop the batch.
- [x] 9.4 `amplify/backend.ts`: add `data`, `donationApi`, `donationWebhook`, `donationReconciler` to `defineBackend`; grant each function read/write on `backend.data.resources.tables['Donation']` and inject its table name; enable PITR on that table (`pointInTimeRecovery: true` via the L1 table's `pointInTimeRecoverySpecification`); attach the Function URL (9.2). Existing auth-unit wiring is untouched.
- [x] 9.5 `npx tsc --noEmit` and `npm run lint` pass.

### Step 10 — API / endpoint: tests

- [x] 10.1 `donation-api/handler.test.ts` (7 tests, fake repository + fake adapter injected): flag off → `DonationsDisabledError` for all three ops; `initiateDonation` invalid amount → validation error and no `create`; happy path returns Contract 5's `DonationInitiation` shape and leaves the row PENDING; adapter failure leaves the row INITIATED; `cancelDonation` by a non-owner is refused before any adapter call; `cancelDonation` happy path calls `stopMandate` before `markCancelled`; `myDonations` queries with the caller's `sub`, never an argument.
- [x] 10.2 `donation-webhook/handler.test.ts` (6 tests): flag off → 404; bad signature → 401 and no repository call; valid captured → `applySettlement(SUCCEEDED)` and 200; valid failed → FAILED; duplicate (`applied: false`) → still 200; unknown `order_id` → 404, no write.
- [x] 10.3 `donation-reconciler/handler.test.ts` (4 tests): flag off → no query; PENDING item with captured record → SUCCEEDED; absent record → FAILED (BR5.4); one item's adapter error does not stop the others.
- [x] 10.4 `npm run test:donation` green; `npm test` (whole suite) green with the 80% floor met; `npm run lint`, `npm run typecheck`, `prettier --check` clean.

### Omitted layer

- **Frontend behavior**: `services/donation_service.dart` and Screens 8–9 belong to flutter-app-unit.

### Step 11 — Environment/build configuration

- [x] 11.1 `README.md`: a "Donations (later release, disabled)" section — what the flag does, the two secrets to set (`npx ampx sandbox secret set DONATION_AGGREGATOR_API_KEY` / `DONATION_AGGREGATOR_WEBHOOK_SECRET`, TEST-mode values for sandbox/staging and LIVE only for production per the infra spec), the webhook Function URL output name to register with the aggregator, and the exact enable procedure (implement the adapter, flip `DONATIONS_ENABLED`, self-review — project.md Mandated for payment handling).

### Step 12 — Documentation and traceability

- [x] 12.1 Doc comments naming the rule each piece realizes (BR5.1–BR5.6, NFR5.1/5.2, NFR3.1, NFR-PERF.1/2).
- [x] 12.2 Write `source-manifest.json` listing every path created or modified (including `amplify/backend.ts`, `jest.config.ts`, `package.json`, `package-lock.json`, `README.md`; not `node_modules/`).
- [x] 12.3 The conductor writes `code-summary.md` and `traceability.json`.

## Rule-to-step traceability

| Rule / requirement | Realized by |
|---|---|
| BR5.1 no raw payment details | 7.2 adapter types, 8.2 test; no field exists to hold them (3.1) |
| BR5.2 positive amount | 7.1, 8.1, 9.1, 10.1 |
| BR5.3 frequency iff RECURRING | 7.1, 8.1 |
| BR5.4 never resolve from a timeout | 7.3, 9.3, 10.3 |
| BR5.5 idempotent webhook | 5.1 `applySettlement`, 6.1, 9.2, 10.2 |
| BR5.6 donor-only cancel | 9.1, 10.1; guard also in 5.1 `markCancelled` |
| NFR3.1 webhook signature-first | 7.2, 9.2, 10.2 |
| NFR5.1 reconciliation trigger | 9.3 schedule |
| NFR5.2 atomic conditional write | 5.1, 6.1 |
| NFR4.1 encryption / NFR2.3 PITR | 9.4 |
| NFR-OBS.4 SNS alert topic | Deferred to the full build (Environment Provisioning action) |

## Known deviations declared up front

- **Thin build**: aggregator network calls are placeholders that throw `AggregatorNotConfiguredError`; `DONATIONS_ENABLED = false` gates every entry point. This is the builder's explicit choice, not an omission.
- **`donorIndex` added** beyond the infra spec's `statusIndex` — required for `myDonations` to be a Query rather than a Scan; the infra spec gets an amendment note (recorded in the stage diary).
- **Secrets** via Amplify's `secret()` (SSM Parameter Store SecureString), the same deviation from "Secrets Manager" already recorded for auth-unit; `security-design.md` explicitly allows either.
- **SNS topic and EMF metrics deferred** — provisioning/observability additions with no bearing on the flagged-off code path.
