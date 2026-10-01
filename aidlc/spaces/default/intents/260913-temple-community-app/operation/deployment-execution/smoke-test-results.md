# Smoke Test Results

## Sources

- [scope] Workflow-selected scope: `temple-mobile-app`; Depth: Standard.
- Consumed: `operation/deployment-pipeline/deployment-strategy.md`; `operation/environment-provisioning/validation-report.md` (check S-7); `construction/build-and-test/integration-test-instructions.md`; `construction/build-and-test/test-results.md`.
- [Q2] Critical path only — sign in with Google, the feed loads, a PDF opens.
- Rules: phases/operation.md § Deployment Procedures ("deployments to production must have a defined smoke test").

## Status: NOT RUN

Nothing has been deployed, so no smoke test has been executed. Every check below
reads `Not run` and carries the command or action that settles it.

This document defines the smoke suite. Until this stage ran, the project had none
— the operation phase rules require one and nothing upstream supplied it.

## What a smoke test is here

The fast check that runs immediately after a deploy and decides whether the
deploy stands. It is not the integration suite: `integration-test-instructions.md`
has eight deeper checks that need a sandbox and a device and settle the 25
`Unverified` targets. The smoke suite is the subset you run every single time,
by hand, in a few minutes.

**It is also the entire health signal for this project** (Q3). If a smoke check
fails, the deploy is rolled back. There is no second signal.

## The suite (Q2 — critical path only)

Three checks. Run them in this order; each depends on the one before.

### SM-1 — Sign in with Google

| | |
|---|---|
| **Action** | Open the app on a real device. Tap sign-in. Complete the Google flow. |
| **Pass** | You land in the app as a signed-in user. |
| **Fail** | Any error on the Google screen, a redirect that dead-ends, or a return to the signed-out state. |
| **Status** | **Not run** |

This exercises the most moving parts of anything in the app: the Cognito User
Pool, the Google external provider, the hosted-UI domain, the OAuth redirect
registration, and the identity pool roles. If SM-1 passes, most of the identity
layer is proven at once.

**Expected to fail before step 12** of the deploy sequence. The redirect URI
cannot be registered until the Cognito domain exists, which is only after the
first deploy. Do not treat that as a real failure — complete step 12, then retry.

### SM-2 — The feed loads

| | |
|---|---|
| **Action** | From the signed-in state, open the feed. |
| **Pass** | The feed renders. An empty feed with its empty state is a pass — there are no posts yet. |
| **Fail** | An error state, an infinite spinner, or a crash. |
| **Status** | **Not run** |

This proves the AppSync API answers, the `feed-api` Lambda runs, its execution
role can reach the `Post` table, and the app's `services/` layer is wired to the
real backend rather than the stub outputs file.

An empty feed passing is the point: SM-2 tests the path, not the content.

### SM-3 — A PDF opens

| | |
|---|---|
| **Action** | Open the PDF library and open one document. |
| **Pass** | The document renders. |
| **Fail** | A download error, a permission error, or a blank viewer. |
| **Status** | **Not run** |

This proves the S3 bucket exists with the right access rules, `document-api`
runs, and the storage path works end to end. It needs at least one PDF uploaded
first — if the library is empty, the check is **inconclusive**, not a pass. Note
it as such rather than calling it green.

## What is deliberately NOT in the suite

### The admin allowlist gate — and what that costs

Q2 offered a variant that added one check: a non-admin account confirming the API
refuses an administrative operation. That is check **S-7** in
`validation-report.md`, which calls it the first one to run. It was offered and
**not chosen**; the critical-path-only suite was chosen instead.

Recording the consequence, because it is sharp and it compounds with Q4:

- The admin allowlist is this project's **only privilege boundary**. It is what separates a worshipper from someone who can post to the temple's feed and read every suggestion-box submission.
- It has **never been proven**. `team.md` Q5 records a deliberate choice at practices discovery to hold the walking skeleton to a smoke-level bar here rather than a real pass/fail assertion. That was a considered decision, not an oversight — but it means no test has ever confirmed a non-admin is refused.
- Q4 chose straight-to-`main` with no sandbox rehearsal. So the first environment this boundary meets is production.
- Together: the boundary reaches production unproven and the smoke suite will not catch it.

This is not presented as a reason to change the answer — the question was asked,
the option was visible, and the choice was made. It is recorded here so that
whoever reads this on deploy day knows the gap exists and can close it in about a
minute whenever they choose to: sign in with a second Google account that is not
in the `Admin` group, attempt to create a post, and confirm the API refuses it.

The right place for that check to land permanently is `integration_test/`, where
`team.md` already says the fuller coverage floor applies from the second Bolt
onward.

### The other eight integration checks

`integration-test-instructions.md` defines eight checks including **IT-1**
(signed-in reminder authorization), which Build and Test predicts will fail. They
need a deployed environment and a device. They are not part of the smoke suite
and they are not gated by it — run them after the first deploy settles, where
they also convert most of the 25 `Unverified` targets.

## How to record a run

When these are actually run, replace each `Not run` with `Pass`, `Fail` or
`Inconclusive`, and add the date, the environment and the app build number. Never
write `Pass` for a check that was not executed — a false pass lets a deployment
inherit confidence nothing earned.

| Check | Result | Date | Build |
|---|---|---|---|
| SM-1 Sign in with Google | Not run | — | — |
| SM-2 The feed loads | Not run | — | — |
| SM-3 A PDF opens | Not run | — | — |

## Confirmation

The decisions in this document were confirmed by the builder at this stage's
summary checkpoint: critical-path-only smoke tests (Q2), with the admin
allowlist check offered and not selected; smoke tests as the whole health signal
(Q3); straight to `main` (Q4).
