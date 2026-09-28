# Unit Test Instructions — donation-unit

## Test framework and setup

- **Framework**: Jest 29 + `ts-jest` (ESM), `testEnvironment: 'node'` — the runner auth-unit bootstrapped in `jest.config.ts`. This Unit adds the project's **80% line-coverage floor** (`coverageThreshold.global.lines: 80`) because it is the first Unit past the walking-skeleton Bolt (team.md Q6). That threshold is never lowered afterwards.
- **Install**: `npm install` at the workspace root after plan Step 1.1 adds `@aws-sdk/client-dynamodb`, `@aws-sdk/lib-dynamodb`, and `@types/aws-lambda`.
- No AWS credentials, no `ampx sandbox`, no network: every Lambda handler and the repository take their DynamoDB document client and aggregator adapter by injection, and tests pass fakes.

## How to run THIS UNIT's tests

Exact, unit-scoped command:

```bash
NODE_OPTIONS=--experimental-vm-modules npx jest --rootDir . amplify/data amplify/functions/donation
```

Wired as `npm run test:donation`. It matches only `amplify/data/**` and `amplify/functions/donation-*/**` test files (the `donation` path prefix covers `donation-api`, `donation-webhook`, `donation-reconciler`, and `donation-shared`). Runnable at plan Step 2.2 (verified once with `--passWithNoTests`; the script omits that flag).

With unit-scoped coverage:

```bash
NODE_OPTIONS=--experimental-vm-modules npx jest --rootDir . amplify/data amplify/functions/donation --coverage --collectCoverageFrom='amplify/data/**/*.ts' --collectCoverageFrom='amplify/functions/donation-*/**/*.ts' --collectCoverageFrom='!amplify/functions/*/resource.ts'
```

Never use a bare `npm test` for this Unit's own verification (Build and Test runs every Unit's scoped command; the whole-suite run is a separate, single step there).

## Test files and cases (43 tests across 8 files)

| File | Tests | Covers |
|---|---|---|
| `amplify/data/donation-schema.test.ts` | 6 | Enum values, `Donation` fields incl. `processedPaymentId`, both secondary indexes with `createdAt` sort keys, owner-read-only model auth, the three Contract 5 custom operations and `DonationInitiation` |
| `amplify/functions/donation-shared/donation-repository.test.ts` | 7 | Command shapes sent to a fake document client: create, `donorIndex` query, `statusIndex` PENDING range query, `markPending` condition, the exact idempotent `applySettlement` expressions (BR5.5/NFR5.2), `ConditionalCheckFailedException` → `{ applied: false }`, `markCancelled` condition |
| `amplify/functions/donation-shared/validation.test.ts` | 6 | BR5.2 (positive/zero/negative/non-finite), BR5.3 (frequency iff RECURRING) |
| `amplify/functions/donation-shared/aggregator-adapter.test.ts` | 5 | HMAC verification accept/tamper/wrong-secret; placeholder methods throw `AggregatorNotConfiguredError`; no credential-shaped field (BR5.1) |
| `amplify/functions/donation-shared/reconciliation.test.ts` | 6 | `decideSettlement` captured/failed/absent (BR5.4); `parseWebhook` valid / unknown event / missing `order_id` (Contract 7) |
| `amplify/functions/donation-shared/flag.test.ts` | 2 | `DONATIONS_ENABLED` gate |
| `amplify/functions/donation-api/handler.test.ts` | 7 | Flag-off refusal; validation before create; happy `initiateDonation` returns Contract 5 shape and leaves PENDING; adapter failure leaves INITIATED; non-owner cancel refused (BR5.6); cancel calls `stopMandate` before `markCancelled`; `myDonations` uses `identity.sub` |
| `amplify/functions/donation-webhook/handler.test.ts` | 6 | Flag-off 404; bad signature 401 with no DB call (NFR3.1); captured→SUCCEEDED; failed→FAILED; duplicate still 200 (BR5.5); unknown `order_id` 404 |
| `amplify/functions/donation-reconciler/handler.test.ts` | 4 | Flag-off no-op; captured→SUCCEEDED; absent→FAILED (BR5.4); per-item error isolation |

Per-component volume (Standard strategy, 5–8 per component): schema 6, repository 7, validation 6, adapter 5, reconciliation 6, api 7, webhook 6, reconciler 4 (+2 flag). The reconciler's 4 plus the shared flag tests it exercises meet the floor for that component.

## Expected coverage

- Global floor **80% lines** enforced by `jest.config.ts` from this Unit onward.
- Expected for this Unit's own files: ≥ 90% lines. `amplify/functions/*/resource.ts` (pure `defineFunction` declarations) and `amplify/backend.ts` (CDK wiring) are excluded from collection — they have no branching logic and are exercised by `ampx sandbox`, not Jest.

## Mocking / stubbing guidance

- **Fake, don't mock modules**: the repository takes a `DynamoDBDocumentClient`-shaped object with a `send(command)` method; tests supply a recorder that captures each command's `input` and returns canned outputs (including throwing an error whose `name === 'ConditionalCheckFailedException'` for the duplicate case). Handlers take `{ repository, adapter, env }` via a factory (`createHandler(deps)`) so the exported Lambda `handler` is the factory applied to real clients and tests call the factory with fakes.
- **Aggregator**: tests use a `FakeAggregatorAdapter` implementing the interface with controllable results; `PlaceholderAggregatorAdapter` is tested only for its throwing behaviour and its real HMAC check.
- **Never** mock `@aws-amplify/backend`; the schema test reads the exported schema definition.
- **Secrets**: only names appear in tests (`DONATION_AGGREGATOR_WEBHOOK_SECRET`); the HMAC tests use an obviously fake constant like `test-secret`, never a real-looking key.

## Test data management

- Fixtures are plain object literals built by small helpers (`aDonation({ status: 'PENDING' })`, `aWebhookBody({ event: 'payment.captured' })`) inside each test file; no shared fixture directory, no snapshot files.
- Timestamps are fixed ISO strings; the reconciler's cutoff is computed from an injected `now()`.

## Integration tests

None at the backend level in this pass: with `DONATIONS_ENABLED=false` there is no reachable end-to-end path. When the real adapter lands, an `ampx sandbox`-backed integration test of the webhook Function URL (signed test payload → Donation SUCCEEDED) is the first integration test to add, per team.md's affirmed mix.
