# Code Summary — donation-unit (thin, flagged-off build)

Built per the builder's explicit choice: everything that does not depend on the real payment aggregator, behind `DONATIONS_ENABLED = false`. When the aggregator account exists, the `PlaceholderAggregatorAdapter` implementation and the flag are the only things that change.

## Files created / modified

All paths workspace-relative. 31 entries in `source-manifest.json`.

| Path | Kind | Purpose |
|---|---|---|
| `package.json`, `package-lock.json` | modified | Added `@aws-sdk/client-dynamodb`, `@aws-sdk/lib-dynamodb`, dev `@types/aws-lambda`; new script `test:donation`. No existing script changed. |
| `jest.config.ts` | modified | **`coverageThreshold.global.lines: 80`** — the team's floor, in force from this Unit onward and never to be lowered; `collectCoverageFrom` now also excludes `amplify/functions/*/resource.ts` (pure declarations). |
| `amplify/backend.ts` | modified | `defineBackend({ auth, data, donationApi, donationWebhook, donationReconciler })`; auth-unit's Cognito overrides untouched. Per-Lambda least-privilege IAM (`PolicyStatement` on the `Donation` table ARN **and** `<tableArn>/index/*` — see decision 1), `DONATION_TABLE_NAME` injected, PITR enabled on `Donation`, webhook Function URL (auth `NONE`) exported as custom output `donationWebhookUrl`. |
| `README.md` | modified | "Donations (later release, disabled)" section: what the flag gates, the two secrets (`DONATION_AGGREGATOR_API_KEY`, `DONATION_AGGREGATOR_WEBHOOK_SECRET`; TEST values for sandbox/staging, LIVE only for production), the webhook URL output, the 5-step enable procedure ending in the mandated self-review. |
| `amplify/donations-flag.ts` | created | `DONATIONS_ENABLED = false as const` with the FR5.4 rationale. |
| `amplify/data/resource.ts` | created | The **shared Amplify Data schema** later units extend: `DonationType`/`DonationFrequency`/`DonationStatus` enums, `Donation` model (all `entities.md` fields + internal `processedPaymentId`, explicit `createdAt`), `statusIndex` and `donorIndex` (both sorted by `createdAt`), owner-**read-only** auth (`ownerDefinedIn('donorGoogleId').identityClaim('sub').to(['read'])`), `DonationInitiation` type, and Contract 5's `initiateDonation` / `cancelDonation` / `myDonations` (all `allow.authenticated()`, handled by `donation-api`). The doc comment states which layer enforces each rule. |
| `amplify/data/donation-schema.test.ts` | created | 7 tests on the schema definition and its transformed SDL. |
| `amplify/functions/donation-shared/types.ts` | created | Enum constants (single source shared by schema, validators, and Lambdas), `DonationRecord`, public `Donation`, `DonationInitiation`, `toPublicDonation` (strips `processedPaymentId`). |
| `amplify/functions/donation-shared/errors.ts` | created | Typed errors: `DonationsDisabledError`, `DonationValidationError`, `DonationAuthorizationError`, `DonationStateError`, `AggregatorNotConfiguredError`, `DonationCheckoutError`. |
| `amplify/functions/donation-shared/logging.ts` (+ test) | created | Structured JSON logger, no personal data in payloads (3 tests). |
| `amplify/functions/donation-shared/donation-repository.ts` (+ test) | created | `create`, `getById`, `queryByDonor` (donorIndex), `queryPendingOlderThan` (statusIndex), `markPending` (conditional on INITIATED), `applySettlement` (the security-design conditional `UpdateItem`; `ConditionalCheckFailedException` → `{ applied: false }`; never touches `aggregatorTransactionId`), `markCancelled` (conditional on SUCCEEDED + RECURRING). 9 tests with a command-recording fake client. |
| `amplify/functions/donation-shared/validation.ts` (+ test) | created | BR5.2 positive finite amount, BR5.3 frequency iff RECURRING (7 tests). |
| `amplify/functions/donation-shared/aggregator-adapter.ts` (+ test) | created | `AggregatorAdapter` interface; `PlaceholderAggregatorAdapter` — network methods throw `AggregatorNotConfiguredError`, `verifyWebhookSignature` is real HMAC-SHA256 with `timingSafeEqual`; compile-time + runtime assertion that no credential-shaped field exists (BR5.1). 5 tests. |
| `amplify/functions/donation-shared/reconciliation.ts` (+ test) | created | `decideSettlement` (absent → FAILED, BR5.4), `settlementForEvent`, `parseWebhook` (Contract 7 shape). 6 tests. |
| `amplify/functions/donation-shared/flag.ts` (+ test) | created | Fail-closed `'true'` check (2 tests). |
| `amplify/functions/donation-api/resource.ts`, `handler.ts` (+ test) | created | 256MB/10s, `resourceGroupName: 'data'`; `createHandler(deps)` dispatching on `event.info.fieldName`; identity only from `event.identity.sub`; real clients built lazily after the flag check. 9 tests. |
| `amplify/functions/donation-webhook/resource.ts`, `handler.ts` (+ test) | created | 256MB/10s; flag → 404; **signature first** (401, no DB access); parse → 400; `GetItem` by `order_id` (404 + log, never guessed); `applySettlement` → 200 whether applied or duplicate (BR5.5); 500 on repository failure so the aggregator retries; base64 bodies handled. 7 tests. |
| `amplify/functions/donation-reconciler/resource.ts`, `handler.ts` (+ test) | created | 256MB/60s, `schedule: 'every 1m'`, `DONATION_CONFIRMATION_WINDOW_MINUTES` (default 15); flag → no-op; PENDING-older-than-window query; per item `getPaymentRecord` → `decideSettlement` → `applySettlement` (BR5.4); per-item errors isolated. 6 tests. |

## Key implementation decisions

1. **Explicit IAM policies instead of `grantReadWriteData`** — Amplify exposes model tables via `Table.fromTableAttributes` without index permissions, so the grant helper would have left `statusIndex`/`donorIndex` unreadable and `myDonations` / the reconciler would fail with AccessDenied at runtime. Each Lambda gets exactly the infra-spec actions (api: Put/Get/Query/Update; webhook: Get/Update; reconciler: Query/Update) on the table and its indexes.
2. **`donation-api` in the `data` resource group** — it is both a schema handler and a table consumer; keeping it in the data stack avoids Amplify's documented data↔function circular dependency.
3. **`#status` attribute alias** — `status` is a DynamoDB reserved word; every expression uses `ExpressionAttributeNames`. Semantically identical to `security-design.md`'s pseudocode.
4. **One enum source** — `donation-shared/types.ts` defines the enum values; `data/resource.ts` re-exports them so Lambda bundles never import `@aws-amplify/backend`; the schema test asserts both match Contract 5.
5. **Lambda-written rows carry `createdAt`, `updatedAt`, `__typename`** so Amplify's generated owner-read queries work on them.
6. **Reconciler idempotency key** on the timeout path is `reconciled:<aggregatorTransactionId>` (the adapter returns only a state, not a payment id) — documented in the handler.
7. **Coverage floor bites when coverage is collected** (`npm test -- --coverage`). `collectCoverage: true` was deliberately not set globally, because a unit-scoped run (`test:auth`, `test:donation`) only exercises one Unit's files and would trip the global threshold. CI runs with `--coverage`.

## Test coverage summary

- `npm run test:donation` → **10 suites, 61 tests, 61 passed.**
- `npm test -- --coverage` (whole backend, 80% floor enforced) → **12 suites, 69 tests, 69 passed; 90.3% statements / 81.7% branches / 85.5% functions / 91.4% lines** — re-run and confirmed by the conductor.
- `npm run lint`, `npm run typecheck`, `prettier --check` → clean.
- Tests vs plan: 61 written against 43 planned (every component at or above its planned count; logging tests added). Nothing weakened.
- No integration test yet (no reachable end-to-end path while disabled); the first one to add when the aggregator lands is a sandbox-backed signed webhook → SUCCEEDED.

## Deviations from the plan

| Deviation | Why | Effect |
|---|---|---|
| Added `types.ts`, `errors.ts`, `logging.ts` beyond the plan's named files | Small shared helpers the three Lambdas need; all tested | None on behaviour |
| `donorIndex` beyond the infra spec's `statusIndex` (declared in the plan) | `myDonations` must be a Query, not a Scan | Infra spec amendment note recorded in the stage diary |
| Secrets via Amplify `secret()` (SSM SecureString → `process.env` at cold start) | Amplify Gen2's native mechanism; `security-design.md` permits SSM | Same recorded deviation as auth-unit |
| `DONATION_CONFIRMATION_WINDOW_MINUTES` default 15 | The design gave no number | Env-configurable |
| Deferred as planned: SNS alert topic + subscription, custom EMF metrics, real aggregator client | Provisioning/observability items with no bearing on the disabled path | `Deferred` in `traceability.json` |

## Open items (not defects in this pass)

- **Settlement write has no status guard** — `applySettlement` conditions only on `processedPaymentId`, exactly as the approved security design specifies. Once real: a later webhook with a *different* `payment_id` on a SUCCEEDED RECURRING mandate (a periodic charge) or a CANCELLED one would rewrite `status`. Tied to `entities.md`'s open assumption that periodic charges are not modeled. **Resolve when the aggregator's recurring API is known**, before flipping the flag.
- `coverage/` should be in `.gitignore` — it is (auth-unit's block); the developer's run wrote the directory, which is ignored.
- `npm audit`: the same 20 transitive advisories under `@aws-amplify/backend-cli`; none introduced here.

## Re-verification (2026-09-28)

Same stage-attempt reset as auth-unit (see that Unit's code-summary.md). Re-ran Plan Approval under the current attempt and verified the existing implementation directly rather than re-dispatching generation on unchanged code:

- `npm run test:donation` (scoped to `amplify/data` + `amplify/functions/donation`, which sweeps in five other units' shared-schema tests by design): 23/23 suites, 127/127 tests passing.
- `npm run typecheck`: clean.
- `npm run lint`: clean (using the `build/`/`android/`/`ios/` ignores added during auth-unit's re-verification pass).
- Repository content is unchanged: no `amplify/data/**` or `amplify/functions/donation*/**` file was touched.
