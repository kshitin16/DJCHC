# NFR Validation Matrix

## Sources

- [scope] Workflow-selected scope: `temple-mobile-app`; Depth: Standard; Test Strategy: Standard.
- Consumed: all seven units' `nfr-requirements/performance-requirements.md` and `scalability-requirements.md`, `nfr-design/performance-design.md` and `scalability-design.md`; `operation/observability-setup/dashboards.md` and `slo-config.md`; `construction/build-and-test/performance-test-instructions.md` and `test-results.md`.
- [Q1] Dual budgets — warm-path and cold-inclusive. [Q2] One light pass of 5-10 samples. [Q3] Baseline only, informational. [Q4] Matrix with every target `Unverified`.
- Rules: project.md § Testing Posture (cold start is the dominant risk at this scale).

## Status: ALL SEVENTEEN TARGETS UNVERIFIED

Nothing has been measured. No environment has ever been deployed, no sandbox has
ever run, and no sample has ever been taken.

Every row below reads `Unverified` and carries its method and owner. **This stage
is the owner.**

## Why this matrix is the point of this stage

Build and Test failed on finding F-1: the project committed to measurable latency
targets and the scope then skipped the stage that would measure them, leaving
~17 targets `Unverified` with no owning stage. The builder recomposed the scope
to add Performance Validation back.

That recompose is what made the deferral legitimate. It did not make anything
measured — and this matrix is the artifact that makes the ownership real rather
than nominal. Each target now has a named owner, a stated method, a threshold,
and a recorded reason it is not yet met.

## The cold-start correction (Q1)

**This is the substantive change this stage makes to the project's performance
targets, and it affects seven of the seventeen.**

The original budgets were written when the design assumed direct
AppSync-to-DynamoDB resolvers. Seven targets now route through a Lambda instead.
A Lambda execution environment that has not been used recently must be created
before the handler runs — the bundle is downloaded, the Node runtime starts, and
module-scope code including the Amplify and AWS SDK clients is constructed. That
`InitDuration` typically costs **0.8 to 2.5 seconds** on `arm64` before any of
the function's own logic executes.

At this project's traffic — a temple community checking the app a few times a
day, hours apart — environments will usually have been reclaimed between
visits. **A cold start is the common case here, not the 1% tail it is in a busy
application.**

A single budget therefore cannot describe both realities. Each affected target
now carries two:

- **Warm** — the original budget, for a call to an already-live environment.
- **Cold** — what a real first use is allowed to feel like, warm budget plus a 2-second cold-start allowance.

Provisioned concurrency would largely remove cold starts and was considered. It
was rejected on cost: roughly $4-5 per function per month at zero traffic, which
across the user-facing functions would exceed every other line in this
architecture combined on a personally funded project. **Revisit if the community
complains about first-open slowness** — that is the signal that the trade was
wrong, and it is a real possibility rather than a theoretical one.

## The matrix

`Status` is `Unverified` on every row: the target has a method and an owner but
no measurement.

### Lambda-backed targets — dual budget

| ID | Unit | What | Warm target | Cold target | Actual | Status | Method |
|---|---|---|---|---|---|---|---|
| FEED-NFR1.1 | feed | `listPosts` public feed | < 2 s | < 4 s | — | **Unverified** | Device, 4G, ~200 posts |
| FEED-NFR1.2 | feed | `listAllPostsForAdmin` / `getPost` | < 2 s | < 4 s | — | **Unverified** | Device, 4G, ~500 admin rows |
| FEED-NFR1.3 | feed | Create / edit / delete post | < 2 s | < 4 s | — | **Unverified** | Device, 4G |
| PDF-PERF.2 | pdf-library | Download URL issuance | < 1 s | < 3 s | — | **Unverified** | Device, 4G |
| PDF-PERF.3 | pdf-library | Upload URL issuance | < 1 s | < 3 s | — | **Unverified** | Device, 4G |
| SUGG-PERF.1 | suggestion | `submitSuggestion` | < 2 s | < 4 s | — | **Unverified** | Device, 4G |
| REM-PERF.1 | reminder | `myReminders` incl. lazy backfill | < 2 s | < 4 s | — | **Unverified** | Device, 4G |

### Direct-resolver and client targets — single budget

| ID | Unit | What | Target | Actual | Status | Method |
|---|---|---|---|---|---|---|
| AUTH-NFR1.1 | auth | Sign-in round trip | < 3 s | — | **Unverified** | Device, 4G, real Google flow |
| AUTH-NFR1.2 | auth | Admin-status check | < 5 ms | — | **Unverified** | Local claim read, no network |
| PDF-PERF.1 | pdf-library | `listDocuments` | < 2 s | — | **Unverified** | Device, 4G |
| SUGG-PERF.2 | suggestion | `myPastSuggestions` / `allSuggestions` | < 2 s | — | **Unverified** | Device, 4G |
| REM-PERF.2 | reminder | Register token / enable / snooze / cancel | < 1 s | — | **Unverified** | Device, 4G |
| REM-PERF.3 | reminder | Push delivery timing accuracy | within 2 min | — | **Unverified** | `reminder-delivery-delta` metric |
| APP-PERF.1 | flutter-app | Cold start | < 3 s | — | **Unverified** | `flutter run --profile`, DevTools timeline |
| APP-PERF.2 | flutter-app | Screen transition | < 300 ms | — | **Unverified** | Same profile pass |

`AUTH-NFR1.2` at under 5 ms is a local read of the `cognito:groups` claim from an
already-held token. It involves no network call and no Lambda, which is why it is
three orders of magnitude tighter than everything else.

### Blocked on an external precondition

| ID | Unit | What | Warm | Cold | Status | Why |
|---|---|---|---|---|---|---|
| DON-PERF.1 | donation | `initiateDonation` | < 2 s | < 4 s | **Blocked** | No payment aggregator account; `DONATIONS_ENABLED` is false |
| DON-PERF.2 | donation | Reconciliation tick | < 1 s | n/a | **Blocked** | Same. Server-side, from CloudWatch Lambda duration |

Recorded as **Blocked**, not `Unverified` — the distinction matters. An
organisational precondition that no code artifact can satisfy is not a coverage
gap; it is a release blocker for the donation feature, which the project has
already established as the right treatment for this class of item.

## Cold start measured in its own right

Not a target — a diagnostic, recorded separately so it is never averaged into a
client budget.

| Function | Metric | Target | Actual | Status |
|---|---|---|---|---|
| Each of the eleven Lambdas | CloudWatch `InitDuration` p95 | No target — observed and recorded | — | **Unverified** |

Query LQ-5 in `operation/observability-setup/log-queries.md` produces this.
`@initDuration` appears only on cold invocations, so the query separates cold
from warm by construction rather than by sampling discipline.

If the measured p95 `InitDuration` lands near the top of the 0.8-2.5 s range, the
cold budgets above are the ones that will be missed, and the provisioned-concurrency
decision is the one to reopen.

## Scalability

The scalability requirements across the units assume a community of roughly
300-1000 people with single-digit concurrency. No target in that set requires a
load test to validate, and none is in scope for measurement here.

| Dimension | Assumption | Validated? |
|---|---|---|
| Concurrent users | Single digits | Not measured — and not measurable without users |
| Feed volume | ~200 public posts, ~500 admin rows at 12 months | Seeded in the test method, not yet run |
| Document library | Tens of documents, three categories | Not measured |
| Reminders | Single digits per device | Not measured |

DynamoDB on-demand, Lambda's own concurrency scaling and AppSync absorb this
volume without configuration. The realistic ceiling is not capacity — it is cold
start, which is a latency problem at low traffic rather than a scale problem at
high traffic. That inversion is what makes a load-testing framework the wrong
tool here.

## What would move a row from Unverified to Met

1. An AWS account and credentials. **Now available** — the CLI is installed and configuration is the next step.
2. `npx ampx sandbox` — provisions a complete real environment.
3. Seed the stated data volumes.
4. Point a real device at the sandbox, throttled to 4G.
5. Take 5-10 samples per target (Q2), alternating cold and warm app starts.
6. Record actuals here; mark each row `Met`, `Not Met` or still `Unverified`.

A measurement taken from 5-10 samples is **indicative, not a p95**. When these
rows are filled in, record them as observed values with the sample count beside
them, and do not label a figure p95 that cannot support the claim.

## Honest position

This matrix does not make the project's performance known. It makes the
seventeen unknowns owned, bounded and measurable, and it corrects a budget
assumption that would otherwise have produced seven misleading failures on first
measurement.

The targets remain `Unverified`. That is the accurate state, and recording it as
anything else would be the failure this project has consistently refused.

## Confirmation

The decisions in this document were confirmed by the builder at this stage's
summary checkpoint: dual warm and cold-inclusive budgets (Q1); one light pass of
5-10 samples per target (Q2); a baseline at the first sandbox only, informational,
with no release gate (Q3); the plan and matrix with every target `Unverified` (Q4).
