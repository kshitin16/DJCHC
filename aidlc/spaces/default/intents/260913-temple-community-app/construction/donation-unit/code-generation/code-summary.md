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

---

# Revision 1 (review findings)

The builder reviewed the pass above and asked for every finding to be fixed. This
section records what changed; nothing above was deleted, and superseded claims are
struck through where they appear.

Verification after the revision (this Unit's scoped command, no coverage run
written to `coverage/`):

- `npm run test:donation` → **23 suites, 137 tests, all passing** (the scoped
  command sweeps in five other units' `amplify/data` tests by design). Of those,
  **10 suites / 71 tests are donation-unit's own**: schema 7, repository 14,
  validation 7, adapter 5, reconciliation 6, flag 2, logging 3, api 10, webhook 8,
  reconciler 9.
- `npx tsc --noEmit` → clean.
- `npm run lint` → clean.
- `npx prettier --check amplify jest.config.ts eslint.config.js` → clean.
- Whole-suite coverage, checked once with the report directed outside the
  repository (`--coverageDirectory` pointed at a scratch path, `text-summary`
  only, so `coverage/` was not rewritten): **48 suites, 281 tests, all passing;
  94.83% lines / 93.45% statements / 82.36% branches / 87.74% functions** — the
  80% line floor the new CI job enforces is met with room to spare. No threshold
  was changed.

## F-1 (Major) — `applySettlement` could overwrite a terminal state

`amplify/functions/donation-shared/donation-repository.ts`

The settlement write now carries a **terminal-state guard** alongside the
idempotency clause, still as **one atomic conditional `UpdateItem`** (no
read-then-write):

`(#status = :initiated OR #status = :pending) AND (attribute_not_exists(processedPaymentId) OR processedPaymentId <> :p)`

- The guard is on *non-terminal* status rather than `PENDING` alone, deliberately.
  `SUCCEEDED`, `FAILED` and `CANCELLED` are the terminal states in
  `functional-spec.md`, and those are the ones that must never be rewritten.
  `INITIATED` is kept settleable because the aggregator's checkout page can be
  paid — and its webhook delivered — before `markPending` has committed, and the
  webhook looks the row up by `order_id` (= `Donation.id`), not by the aggregator
  reference. Guarding on `PENDING` alone would have made the fix drop real
  payments; this is a considered widening of the brief's `#status = :pending`
  suggestion, not a weakening of it.
- A rejected write stays a **clean, logged no-op**: `{ applied: false }`, never an
  exception. `ReturnValuesOnConditionCheckFailure: 'ALL_OLD'` makes DynamoDB
  return the row it refused, so the no-op log line names the status that blocked
  it (`currentStatus`) — still one round trip. The webhook answers `200` (which is
  what stops the aggregator retrying a delivery that will never be accepted) and
  the reconciler counts it as a duplicate.
- Both overwrite paths named in the review are covered by **behavioural** tests,
  not by asserting on the expression string: `donation-repository.test.ts` gained
  a one-row table simulator (`fakeTable`) that actually evaluates the
  `ConditionExpression` and applies the `UpdateExpression`. Tests: a reconciler
  tick whose synthetic `reconciled:<txn>` key does *not* collide cannot turn a
  SUCCEEDED row FAILED; a late `payment.failed` carrying a different `payment_id`
  cannot either; every one of the three terminal statuses is refused; PENDING and
  INITIATED still settle, and a replayed delivery is then a clean no-op.
  `donation-webhook/handler.test.ts` adds the end-to-end version (late
  `payment.failed` on a SUCCEEDED row → `200`, no state change).

This closes the **Open items** entry above: ~~"Settlement write has no status
guard … Resolve when the aggregator's recurring API is known, before flipping the
flag"~~ — superseded, the guard is in place now. The periodic-recurring-charge
question it was tied to (`entities.md`'s open assumption that periodic charges are
not modelled) is *not* closed by this: with the guard, a second charge on a
SUCCEEDED recurring mandate is refused rather than silently rewriting the row.
That is the safe behaviour, and modelling periodic charges as their own rows
remains work for the full build.

## F-2 (Major) — the coverage floor was claimed but unenforced

`.github/workflows/ci.yml` (new)

The gap was real: `jest.config.ts` declares `coverageThreshold.global.lines: 80`,
`npm test` runs without `--coverage`, and there was no `.github/` directory at
all — so nothing enforced the floor.

Fixed by adding the workflow rather than by softening the claim, because
`team.md` § Testing Posture (Q7) already specifies exactly this workflow, and it
is the project's only automated guard against a skipped or weakened test (solo
builder, no second reviewer). It runs on push and pull request to `main`, blocks
on failure, and has two jobs:

- **backend** — `npm ci`, `npm run lint`, prettier check (code only, see below),
  `npm run typecheck`, then `npx jest --coverage`, which is what arms the 80%
  line floor.
- **app** — `flutter pub get`, `dart format --set-exit-if-changed` (verified clean
  locally over `lib test integration_test`), `flutter analyze`,
  `flutter test --coverage`. `integration_test/` is not run here (it needs a
  device or emulator).

**This is not ownership of the CI Pipeline stage (3.7).** Stage 3.7 may extend or
restructure the file — caching, deploy jobs, matrix builds, an `amplify.yml` test
step (`team.md` Q7 notes Amplify Hosting does not run app tests by default). What
must not be removed is that the coverage floor fails the build.

The prettier step is scoped to `amplify jest.config.ts eslint.config.js` instead
of `npm run format:check`, because `format:check` also covers `README.md`, which
prettier would reflow (hand-aligned tables written before this workflow existed,
in sections this Unit does not own). Reformatting that documentation is a
deliberate separate change, so it is surfaced here rather than hidden: **gap —
`npm run format:check` currently fails on `README.md` formatting, not introduced
by this Unit.** No quality target was lowered; a check was scoped and the
remainder reported.

Consequently, decision 7 above — ~~"CI runs with `--coverage`"~~ — was a claim
about something that did not exist. It is now true.

## F-3 (Minor) — a failed `markPending` left an orphan

`amplify/functions/donation-api/handler.ts`,
`amplify/functions/donation-reconciler/handler.ts`,
`amplify/functions/donation-reconciler/resource.ts`,
`amplify/functions/donation-shared/donation-repository.ts`

**Which option, and why:** the reconciler now also sweeps stale `INITIATED` rows.
The alternative — making the transition durable *before* the checkout call — was
rejected because `markPending` writes the status **and** the aggregator reference
in one update, and the reference does not exist until `createCheckout` returns;
writing PENDING first would only move the same orphan to a PENDING row with no
reference, which the poller already has to skip.

Three changes together make the state recoverable:

1. **The donor is no longer blocked.** If `markPending` fails after the checkout
   was created, `initiateDonation` logs an ERROR carrying the donation id *and*
   the aggregator reference (so it is never lost) and still returns the real
   `DonationInitiation`. Stranding a payable checkout behind an error helped
   nobody.
2. **A real payment still settles.** Because F-1's guard keeps `INITIATED`
   settleable, the aggregator's webhook resolves such a row by `order_id` exactly
   as it would a PENDING one.
3. **The stuck row becomes visible.** Each tick queries `INITIATED` rows older
   than `DONATION_INITIATED_SWEEP_MINUTES` (new env, default 1440 — far past any
   webhook retry schedule, so a payment in flight is never reported as stuck) via
   the same `statusIndex`. A row with no aggregator reference is logged at ERROR
   as needing manual reconciliation against the aggregator dashboard and counted
   as `orphaned` in the tick summary; it is **never** resolved to FAILED, because
   project.md's firm rule is that the aggregator's own record decides the outcome
   and here there is no reference to ask about. A row that *does* carry a
   reference is reconciled normally. The deferred NFR-OBS.4 alert topic is the
   natural alarm target for the `orphaned` count.

A failure of the orphan-sweep query is logged and swallowed rather than thrown:
the PENDING sweep in the same tick is the load-bearing work and must still count.

## F-4 (Minor) — unbounded queries

`amplify/functions/donation-shared/donation-repository.ts`

Both queries now paginate to exhaustion through a shared `queryAllPages` helper
that follows `LastEvaluatedKey` into `ExclusiveStartKey`. DynamoDB caps a page at
1 MB, so the previous single call returned a prefix: `myDonations` would have
dropped a long donation history, and the reconciler would have left stale PENDING
rows unreconciled indefinitely.

`queryPendingOlderThan` and the new `queryInitiatedOlderThan` are thin wrappers
over one generic `queryByStatusOlderThan(status, cutoffIso)`, so the two sweeps
cannot drift apart. Tested with a three-page fake that asserts every page is
followed and the right `ExclusiveStartKey` is sent.

## F-5 (Minor) — retry surfaced a raw exception

`amplify/functions/donation-shared/donation-repository.ts`

`applySettlement` already mapped `ConditionalCheckFailedException` to
`{ applied: false }`; the remaining path that could leak a raw DynamoDB exception
was `create`, whose `attribute_not_exists(id)` condition threw unmapped. It now
raises a typed `DonationStateError`. **No raw `ConditionalCheckFailedException`
escapes the repository any more**, which is what makes the word "idempotent"
accurate rather than aspirational, and both callers log the rejection explicitly
instead of treating it as an invisible non-event.

## F-6 (Minor) — summary drift on shared files

The four shared files described in the table above as though this Unit still owns
them have since been extended by later Units. One accurate sentence each; the
original table rows stand, with the over-broad part struck through:

- **`amplify/backend.ts`** — ~~"`defineBackend({ auth, data, donationApi, donationWebhook, donationReconciler })`"~~:
  donation-unit added `data` and its three donation functions with their IAM, the
  `Donation` table's PITR and the webhook Function URL; feed-, suggestion-,
  pdf-library- and reminder-unit have since added their own functions, stream
  event sources, a schedule group and storage wiring to the same file.
- **`jest.config.ts`** — donation-unit added `coverageThreshold.global.lines: 80`
  and the `amplify/functions/*/resource.ts` exclusion, which still stand;
  feed-unit added the `@aws-appsync/utils` `moduleNameMapper` and the
  `post-resolvers/**/*.js` coverage glob, and suggestion-unit added the
  `suggestion-resolvers/**/*.js` glob.
- **`package.json`** — donation-unit added `@aws-sdk/client-dynamodb`,
  `@aws-sdk/lib-dynamodb`, dev `@types/aws-lambda` and the `test:donation`
  script; later Units added their own dependencies (S3, CloudWatch, Scheduler,
  signature-v4, `@aws-appsync/utils`) and `test:*` scripts alongside them.
- **`amplify/data/resource.ts`** — donation-unit created this file and owns the
  three donation enums, the `Donation` model with both its indexes, the
  `DonationInitiation` type and Contract 5's three operations; the `Post`,
  `Suggestion`, `Document` and reminder models, their resolvers and their
  operations belong to the Units that added them.

## F-7 (Minor, judgement) — `processedPaymentId` exposure

`amplify/data/resource.ts`, `amplify/functions/donation-shared/types.ts`

The claim was wrong as written and is corrected in the code's own doc comments:
Contract 5's three custom operations never return the field (`toPublicDonation`
strips it), but declaring it on the model also puts it in the generated
`getDonation` / `listDonations` selection set, where the owner-read rule lets a
donor read it **on their own rows**.

**Judgement: corrected the claim, kept the field.** The value is an
aggregator-issued settlement reference, not a payment credential, so BR5.1 (never
hold a card number or UPI PIN) is not implicated at all; the exposure is
owner-scoped, to the same person who made that payment. Weighed against that, a
schema change would deviate from the approved plan's Step 3.1 field list for no
security gain. The doc comment now records exactly how to hide it if a later
release wants to — drop it from `a.model({...})` and let the Lambdas write the
attribute straight to DynamoDB — so the option stays open and the record is
honest.

## Deferred doc corrections

The two plan-approval documents were not edited (editing them revokes the
approval fingerprint mid-task). These corrections are for the builder to apply
afterwards:

**`code-generation-plan.md`**

1. Step 5.1, the `applySettlement` description — "the exact conditional
   `UpdateItem` from `security-design.md` (`SET status, processedPaymentId` with
   `attribute_not_exists(processedPaymentId) OR processedPaymentId <> :p`…)".
   Correct text: `SET status, processedPaymentId` conditioned on
   `(#status = :initiated OR #status = :pending) AND (attribute_not_exists(processedPaymentId) OR processedPaymentId <> :p)`
   — the idempotency clause from `security-design.md` plus the terminal-state
   guard added by review F-1.
2. Step 5.1, the repository method list — add `queryByStatusOlderThan(status, cutoffIso)`
   and `queryInitiatedOlderThan(cutoffIso)` (review F-3), and note that every
   `Query` paginates through `LastEvaluatedKey` (review F-4).
3. Step 6.1, "`applySettlement` sends exactly the security-design
   UpdateExpression/ConditionExpression" — the ConditionExpression now also
   carries the status guard; the test file asserts the full expression and, since
   revision 1, proves the guard behaviourally with a condition-evaluating table
   fake.
4. Step 9.3, the reconciler description — add the stale-`INITIATED` orphan sweep
   and the `DONATION_INITIATED_SWEEP_MINUTES` env (default 1440), review F-3.
5. Step 11.1 / Step 12.2 — `.github/workflows/ci.yml` is now part of this Unit's
   environment/build configuration and appears in `source-manifest.json`
   (review F-2).

**`unit-test-instructions.md`**

6. "Test files and cases (43 tests across 8 files)" — the file is now **71 tests
   across 10 files**. Per-file counts: schema 7, repository 14, validation 7,
   adapter 5, reconciliation 6, flag 2, logging 3, api 10, webhook 8,
   reconciler 9. (`logging.test.ts` is the tenth file, present since the original
   pass; the counts above the original figures come from the revision's added
   cases.) Every component remains at or above its planned volume; nothing was
   removed or weakened.
7. The table row for `donation-repository.test.ts` — add the terminal-state guard
   cases (F-1) and the pagination case (F-4); the row for
   `donation-reconciler/handler.test.ts` — add the orphan-sweep cases (F-3); the
   row for `donation-api/handler.test.ts` — add the `markPending`-failure
   recovery case (F-3); the row for `donation-webhook/handler.test.ts` — add the
   already-terminal `200` case (F-1).
8. "Test framework and setup" — the 80% floor is now actually enforced, by
   `.github/workflows/ci.yml`'s `npx jest --coverage` step on every push and PR to
   `main` (review F-2), not only declared in `jest.config.ts`.
