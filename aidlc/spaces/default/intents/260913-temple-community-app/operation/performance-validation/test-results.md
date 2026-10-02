# Performance Test Results

## Sources

- [scope] Workflow-selected scope: `temple-mobile-app`; Depth: Standard; Test Strategy: Standard.
- Consumed: `load-test-plan.md` and `nfr-validation-matrix.md` (this stage); `construction/build-and-test/performance-test-instructions.md` and `test-results.md`; `operation/observability-setup/dashboards.md` and `log-queries.md`.
- [Q2] 5-10 samples per target. [Q3] Baseline only, informational. [Q4] Results recorded as not measured.

## Result: NOT MEASURED

No performance measurement has been taken. No environment has been deployed, no
sandbox has run, and no sample exists.

This is the results record for a measurement that has not happened. It is written
rather than omitted because a missing results file reads as an oversight, and
this is a stated position: the measurement is possible, the method is defined,
and the prerequisite is a deployed environment that does not yet exist.

**No figure in this project should be reported as a measured performance number.**
There are none.

## What has actually been established

To keep the boundary clear between what is known and what is not:

| Established | Evidence |
|---|---|
| The code compiles and its tests pass | 284 backend tests, 94.97% line coverage; 203 app tests, 91.31% — `build-and-test/test-results.md` |
| Both platforms build into runnable artefacts | `flutter build apk --debug` and `flutter build ios --debug --no-codesign` both succeeded — `deployment-execution/deployment-log.md` |
| A real device is available to measure on | A connected iPhone; the Android toolchain is green |
| The measurement method is defined | `load-test-plan.md`, inherited from `performance-test-instructions.md` |
| The targets have an owning stage | This one — `nfr-validation-matrix.md` |

| Not established | Why |
|---|---|
| Any latency figure, warm or cold | Nothing deployed |
| Any cold-start duration | Nothing deployed |
| Behaviour at the stated data volumes | Nothing seeded |
| Behaviour under concurrency | Out of scope at this scale, by decision |

## Results table

Blank by construction. Fill it in after the first sandbox session, with the
sample count beside every figure.

### Lambda-backed — dual budget

| ID | What | Warm target | Warm actual | Cold target | Cold actual | Samples | Status |
|---|---|---|---|---|---|---|---|
| FEED-NFR1.1 | `listPosts` public feed | < 2 s | — | < 4 s | — | 0 | **Not measured** |
| FEED-NFR1.2 | `listAllPostsForAdmin` / `getPost` | < 2 s | — | < 4 s | — | 0 | **Not measured** |
| FEED-NFR1.3 | Create / edit / delete post | < 2 s | — | < 4 s | — | 0 | **Not measured** |
| PDF-PERF.2 | Download URL issuance | < 1 s | — | < 3 s | — | 0 | **Not measured** |
| PDF-PERF.3 | Upload URL issuance | < 1 s | — | < 3 s | — | 0 | **Not measured** |
| SUGG-PERF.1 | `submitSuggestion` | < 2 s | — | < 4 s | — | 0 | **Not measured** |
| REM-PERF.1 | `myReminders` incl. lazy backfill | < 2 s | — | < 4 s | — | 0 | **Not measured** |

### Single budget

| ID | What | Target | Actual | Samples | Status |
|---|---|---|---|---|---|
| AUTH-NFR1.1 | Sign-in round trip | < 3 s | — | 0 | **Not measured** |
| AUTH-NFR1.2 | Admin-status check | < 5 ms | — | 0 | **Not measured** |
| PDF-PERF.1 | `listDocuments` | < 2 s | — | 0 | **Not measured** |
| SUGG-PERF.2 | `myPastSuggestions` / `allSuggestions` | < 2 s | — | 0 | **Not measured** |
| REM-PERF.2 | Register / enable / snooze / cancel | < 1 s | — | 0 | **Not measured** |
| REM-PERF.3 | Push delivery timing accuracy | within 2 min | — | 0 | **Not measured** |
| APP-PERF.1 | App cold start | < 3 s | — | 0 | **Not measured** |
| APP-PERF.2 | Screen transition | < 300 ms | — | 0 | **Not measured** |

### Blocked

| ID | What | Status | Why |
|---|---|---|---|
| DON-PERF.1 | `initiateDonation` | **Blocked** | No payment aggregator account; `DONATIONS_ENABLED` false |
| DON-PERF.2 | Reconciliation tick | **Blocked** | Same |

### Cold start diagnostic

| Function | `InitDuration` p95 | Samples | Status |
|---|---|---|---|
| All eleven Lambdas | — | 0 | **Not measured** |

From query LQ-5. This is the measurement that decides whether the cold budgets
above are achievable, and whether the provisioned-concurrency decision needs
reopening.

## Bottleneck analysis

None performed — a bottleneck analysis requires measurements to analyse.

The **predicted** bottleneck, stated as a hypothesis so a later measurement can
confirm or refute it rather than being read as a finding: **Lambda cold start on
the seven Lambda-backed paths**, with the public feed read (`FEED-NFR1.1`) the
most user-visible instance because it is the first screen after sign-in.

Secondary candidates, in order:

1. The admin feed listing at ~500 rows, now paginated — the pagination fix landed at Code Generation and has never been exercised against real data volume.
2. `allSuggestions`, which scans and sorts in the Lambda.
3. `myReminders` with lazy backfill, which does more work on first call per device than on subsequent ones.

None of these is a finding. They are where to look first.

## Auto-scaling validation

Not applicable and not performed. There is nothing configured to scale: DynamoDB
is on-demand, Lambda concurrency is AWS-managed, AppSync scales without
configuration. No scaling policy exists to validate.

## Capacity planning

No recommendation, because no measurement supports one. The design assumption —
300-1000 community members, single-digit concurrency, ~200 public posts growing
to ~500 admin rows over 12 months — is well within every service's default
behaviour, and the free-tier analysis in
`environment-provisioning/environment-inventory.md` already covers the cost
shape at that volume.

Revisit if the community grows past a few thousand, which is the same threshold
at which a real load test becomes the right tool.

## How to complete this record

1. `aws configure` (region `ap-south-1`), then `npx ampx sandbox`
2. Seed the stated volumes
3. Follow `load-test-plan.md` — 5-10 samples per target, cold and warm kept separate
4. Run query LQ-5 for the cold-start diagnostic
5. Fill in the tables above with the sample count beside every figure
6. Mirror the outcomes into `nfr-validation-matrix.md`

**Never record a target as Met without an actual figure beside it.** A false pass
lets a release inherit confidence nothing earned — the same rule this project
applied to the environment validation checks, and the reason this file says
`Not measured` seventeen times instead of staying silent.

## Confirmation

The decisions in this document were confirmed by the builder at this stage's
summary checkpoint: dual warm and cold-inclusive budgets (Q1); 5-10 samples per
target (Q2); a baseline at the first sandbox only, informational (Q3); results
recorded as not measured (Q4).
