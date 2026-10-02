# Performance Validation — Questions

## Sources

- [scope] Workflow-selected scope: `temple-mobile-app`; Depth: Standard; Test Strategy: Standard.
- Consumed: all seven units' `nfr-requirements/performance-requirements.md` and `scalability-requirements.md`, `nfr-design/performance-design.md` and `scalability-design.md`; `operation/observability-setup/dashboards.md` and `slo-config.md`; `construction/build-and-test/performance-test-instructions.md` and `test-results.md`.
- Rules: project.md § Testing Posture (cold start is the dominant risk at this scale; prefer device-side instrumentation and CloudWatch duration/InitDuration over a load-testing framework); team.md § Testing Posture.

## What is already settled and not re-asked

`build-and-test/performance-test-instructions.md` specifies the method in full
and it is not re-opened here:

- **No load-testing framework.** A few hundred rows and single-digit concurrency do not warrant k6. Device-side instrumentation plus CloudWatch metrics is the proportionate method, and a load test would average cold start away — the project learned this explicitly.
- **Client-measured targets** are measured from the app, on a real device, throttled to a 4G profile, against a seeded sandbox.
- **Server-side targets** (`AUTH-NFR1.2`, `DON-PERF.2`) come from CloudWatch Lambda duration.
- **Data volumes**: ~200 public posts, ~500 admin rows at the 12-month horizon, tens of documents, single-digit reminders per device.
- **Seventeen targets** are enumerated with IDs, units and thresholds. This stage inherits that list; it does not redefine it.

## Why this stage exists

Build and Test failed on finding F-1: the scope had committed to measurable
latency targets and then skipped the stage that would measure them, leaving ~17
targets `Unverified` with no owner. The builder recomposed the scope to add
Performance Validation back, which is what made their deferral legitimate rather
than an orphaned gap.

So this stage is the owner. It still cannot measure anything — there is no AWS
account, nothing is deployed, and no sandbox has ever run.

## Q1. Cold start versus the client budgets

This is the sharpest unanswered question in the project's performance story, and
`performance-test-instructions.md` raises it without resolving it.

**Seven of the seventeen targets now route through a Lambda that the original
design assumed would not exist.** The client-side budgets — mostly "under 2
seconds" — were written for a direct AppSync-to-DynamoDB resolver. A cold Lambda
on `arm64` with the Amplify client bundled typically adds **0.8 to 2.5 seconds**
of `InitDuration` before any of your code runs.

A cold `listPosts` could therefore miss a 2-second budget on init alone, while
the warm call takes 150ms. With a temple community checking the app a few times
a day, **cold starts will not be rare — they will be the common case**, because
nothing keeps the functions warm between uses.

- A. State the budgets as warm-path targets, and record cold start as a separate measured number alongside each. Honest, free, and it stops a warm-path budget being quietly failed by a cold invocation. The user still waits.
- B. A, plus raise the client-facing budgets to a cold-inclusive figure (for example 2s warm / 4s cold) so the recorded target matches what a real first-use actually feels like.
- C. Add provisioned concurrency to the user-facing Lambdas so cold starts largely disappear. Genuinely fixes the user experience; costs roughly $4-5 per function per month even at zero traffic, which on a personally funded project is the most expensive line in the whole architecture.
- D. Accept it and change nothing — measure against the existing budgets and let the cold-path misses be recorded as failures.
- X. Other (please specify)

[Answer]: B

## Q2. How much measurement is proportionate?

The specified method is 30+ samples per target, alternating cold and warm, on a
throttled device. Across seventeen targets that is several hours of careful
manual work, repeated whenever something significant changes.

- A. Full rigour on the list as specified — 30+ samples on all seventeen.
- B. Tiered. Full rigour on the handful users actually feel — app cold start, the feed read, sign-in, PDF open — and a lighter 5-10 sample sanity check on the rest. Roughly a third of the effort for most of the signal.
- C. A single pass of 5-10 samples per target, enough to catch something an order of magnitude wrong, not enough for a trustworthy p95.
- X. Other (please specify)

[Answer]: C

## Q3. When does this get measured, and does anything gate on it?

Nothing currently requires a performance measurement before a release. The
pre-release checklist covers secrets, dependencies and AWS permission changes,
but not latency.

- A. Once at the first sandbox, to establish a baseline, and then only when something plausibly affects performance. No release gate.
- B. A baseline at the first sandbox, plus a re-measure before each app release, added to the pre-release checklist as a real gate.
- C. Measure at the first sandbox only, and treat the numbers as informational with no obligation to re-measure.
- X. Other (please specify)

[Answer]: C

## Q4. What should this stage produce, given nothing is deployed?

No measurement is possible today. The same situation as Environment Provisioning
and Deployment Execution, which both produced specifications with every result
marked `Not run`.

- A. The load test plan and the NFR validation matrix, with all seventeen targets recorded `Unverified` and carrying their method, owner and threshold — plus `test-results.md` as an empty results record stating plainly that nothing has been measured.
- B. Skip the stage until there is a deployed environment to measure against.
- X. Other (please specify)

Worth knowing before choosing B: this stage was **added back to the scope
specifically to own these targets**. Build and Test's finding F-1 was resolved by
scheduling this stage, not by measuring anything. Skipping it now would leave the
seventeen targets with no owning stage again, which is the exact condition F-1
described — so B would reopen a finding the recompose closed.

[Answer]: A

## Consolidated Summary Confirmation

- Looks correct
- Request changes

[Answer]: Looks correct
