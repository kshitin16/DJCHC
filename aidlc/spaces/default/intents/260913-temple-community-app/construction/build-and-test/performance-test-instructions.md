# Performance Test Instructions

## Sources

- [scope] Test Strategy: Standard. Performance instructions are above the Standard baseline; generated deliberately because this project carries ~20 measurable latency targets and **Performance Validation (4.6) is SKIP in the active scope**, so no later stage is scheduled to own them.
- Consumed: every unit's `nfr-requirements/performance-requirements.md` and `nfr-design/performance-design.md`.

## Why this file exists

The scope skipped Performance Validation. That means the latency targets below
have no scheduled owner, and Build and Test cannot measure them because they all
require a deployed environment. Rather than let them disappear, this file records
exactly how each would be measured, so whoever picks them up has a procedure
rather than a number with no method.

Every target below is **Unverified** in the Target Verification Matrix. That is a
real gap, not a formality — see `build-and-test-summary.md`.

## The targets

All are p95 unless stated otherwise.

| Target ID | Unit | What | Target |
|---|---|---|---|
| AUTH-NFR1.1 | auth | Sign-in round trip | < 3 s |
| AUTH-NFR1.2 | auth | Admin-status check | < 5 ms |
| FEED-NFR1.1 | feed | `listPosts` public feed | < 2 s |
| FEED-NFR1.2 | feed | `listAllPostsForAdmin` / `getPost` | < 2 s |
| FEED-NFR1.3 | feed | Create / edit / delete post | < 2 s |
| PDF-PERF.1 | pdf-library | `listDocuments` | < 2 s |
| PDF-PERF.2 | pdf-library | Download URL issuance | < 1 s |
| PDF-PERF.3 | pdf-library | Upload URL issuance | < 1 s per call |
| SUGG-PERF.1 | suggestion | `submitSuggestion` | < 2 s |
| SUGG-PERF.2 | suggestion | `myPastSuggestions` / `allSuggestions` | < 2 s |
| REM-PERF.1 | reminder | `myReminders` incl. lazy backfill | < 2 s |
| REM-PERF.2 | reminder | Register token / enable / snooze / cancel | < 1 s |
| REM-PERF.3 | reminder | Push delivery timing accuracy | within 2 min |
| APP-PERF.1 | flutter-app | Cold start | < 3 s |
| APP-PERF.2 | flutter-app | Screen transition | < 300 ms |
| DON-PERF.1 | donation | `initiateDonation` | < 2 s |
| DON-PERF.2 | donation | Reconciliation tick | < 1 s |

Donation targets are additionally blocked on an aggregator account.

## Load conditions the designs assume

- 4G/LTE-equivalent connection for every client-measured target.
- Feed: ~200 non-aged-out posts for the public read; ~500 rows for the admin view
  at the 12-month horizon (the admin view has no age-out filter, so it grows).
- PDF library: tens of documents across three fixed categories.
- Reminders: single-digit existing reminders per device.

These are modest volumes. The realistic risk is not throughput but **Lambda cold
start**, which is unmeasured and unaccounted for in the client-side budgets —
seven of the targets above now route through a Lambda that the original design
assumed would not exist.

## Method

Client-measured targets (everything except the two sub-second server ones) are
measured from the app, not from the API:

1. Deploy a sandbox and point a real device at it (`ampx sandbox --outputs-format dart`).
2. Seed the stated data volume — e.g. 200 posts, 500 for the admin view.
3. Throttle the device to a 4G profile (Android: emulator network profile; iOS:
   Network Link Conditioner).
4. Instrument the call site: record a timestamp at the service call and at first
   frame rendered, 30+ samples per target, alternating cold and warm app starts.
5. Report p50 and p95. Discard the first sample after a deploy — it carries the
   Lambda cold start and should be reported separately, not averaged in.

Server-side targets (`AUTH-NFR1.2`, `DON-PERF.2`) come from CloudWatch Lambda
duration metrics rather than client timing.

For the cold-start question specifically, measure each Lambda's p95 `InitDuration`
in CloudWatch and state it alongside the client budget, so the two are not
conflated.

## Tooling

No load-testing framework is warranted at this scale — a few hundred rows and a
single-digit concurrent user count. Device-side instrumentation plus CloudWatch
metrics is the proportionate method. If the user base grows past a few thousand,
revisit with k6 against AppSync.

## What would make these Met

Either schedule Performance Validation (4.6) back into the scope, or measure them
during Deployment Execution against the first real environment and record the
actuals in the Target Verification Matrix. Until one of those happens they stay
Unverified.
