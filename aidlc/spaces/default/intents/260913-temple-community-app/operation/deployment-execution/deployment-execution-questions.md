# Deployment Execution — Questions

## Sources

- [scope] Workflow-selected scope: `temple-mobile-app`; Depth: Standard.
- Consumed: `operation/deployment-pipeline/cd-config.md`; `operation/deployment-pipeline/deployment-strategy.md`; `operation/deployment-pipeline/rollback-runbook.md`; `operation/environment-provisioning/environment-inventory.md`; `operation/environment-provisioning/validation-report.md`; `construction/build-and-test/test-results.md`; `construction/build-and-test/integration-test-instructions.md`.
- Verified directly on this machine: no `~/.aws`, no `AWS_PROFILE` or `AWS_ACCESS_KEY_ID`, no AWS CLI, no `amplify_outputs.json`, no Android SDK or Xcode.
- Rules: org.md § Deployment; team.md § Deployment Q8 (pre-release checklist); phases/operation.md § Deployment Procedures (rollback steps and a defined smoke test are mandatory).

## What is already settled and not re-asked

Decided at Deployment Pipeline and Environment Provisioning, carried forward:

- One permanent environment; `main` is the trunk and the production backend. A merge to `main` is a production deploy.
- Region `ap-south-1`. Backend deploys itself via Amplify Hosting; CI holds zero secrets.
- Strategy: in-place reconciliation. No blue/green, no canary.
- Rollback: redeploy a prior commit for the backend; halt the rollout and ship a higher build number for the app.
- No database migration script — the data model is declarative in `amplify/data/resource.ts`.
- Pre-release checklist (no secrets committed, Dependabot clear, AWS permission changes double-checked, self-review of sign-in/permissions/payment changes).

## Current state: nothing can be deployed from this machine

| Prerequisite | State |
|---|---|
| AWS credentials and CLI | Absent |
| Amplify app created in `ap-south-1` | Not created |
| Google Cloud OAuth client | Not created |
| Firebase project (push + Crashlytics) | Not created |
| Android SDK / Xcode / CocoaPods | Not installed |
| `amplify_outputs.json` | Does not exist |

Backend and app tests are green (284 backend, 203 app; 94.97% and 91.31% line
coverage). Nothing has ever been deployed, built as an artefact, or run on a
device.

## Q1. Given nothing can be deployed here, what should this stage produce?

This stage's job is to execute a deployment and verify it. It cannot execute one.
Two honest ways to handle that:

- A. Produce the first-deploy runbook and the post-deploy verification spec — the exact deploy sequence, the smoke tests that decide whether the deploy is good, and the health checks and abort criteria — with every result recorded `Not run` and the command that settles it. The stage completes; the documents are ready for the day credentials exist.
- B. Report this stage skipped until the prerequisites exist, and come back to it with `/aidlc --stage deployment-execution` once there is an AWS account and an Amplify app. Nothing is written now.
- C. Hold this stage open while the prerequisites are actually created now, then execute the real deployment inside this same stage. Added after the builder asked for help making the prerequisites available.
- X. Other (please specify)

**Revised after the builder's reply to the first presentation of this question.**
The builder asked for help making the prerequisites available rather than
choosing A or B. A direct survey of the machine then found the recorded state
stale: Xcode 27.0 and Android Studio are installed, the Android SDK (36.0.0) is
present, Flutter 3.47.4 works, and an iPhone is connected. Only CocoaPods and the
Android `cmdline-tools` component were genuinely missing locally, and both were
installed during this stage. The remaining prerequisites are all account-side and
require the builder's own identity and payment details in a browser: an AWS
account, a Google Cloud OAuth client, a Firebase project, and the Amplify app.

Worth knowing before choosing: `cd-config.md` and `environment-inventory.md`
already carry the ordered prerequisite steps, so A would not repeat those. What A
genuinely adds is the part nothing upstream defines — **what must pass after the
deploy before you call it good**, and **what makes you roll back**. The operation
phase rules require both.

[Answer]: A

## Q2. What must pass before the first deploy is called good?

Smoke tests are the difference between "the deploy command succeeded" and "the app
works". Nothing in this project defines them yet. The eight integration checks in
`integration-test-instructions.md` are the deeper suite and need a device; smoke
tests are the fast subset run immediately after a deploy.

Candidates, in rough order of what would hurt most if broken:

- A. The critical path only — sign in with Google, the feed loads, a PDF opens. Three checks, a few minutes, run by hand on a device.
- B. Critical path plus the privilege boundary — the three above, and a non-admin account confirming the API refuses an admin operation. This is check S-7 from the validation report, the one boundary this project has never proven.
- C. Everything in B plus the backend surface without a device — an unauthenticated GraphQL call is refused, the AppSync endpoint answers, each Lambda is invokable.
- D. The full integration suite (all eight checks) as the gate — slowest, needs a device and a sandbox, but settles the 25 `Unverified` targets at the same time.
- X. Other (please specify)

[Answer]: A

## Q3. What tells you the deploy is healthy, and what makes you roll back?

`rollback-runbook.md` says how to roll back. It does not say what should trigger
one. With one environment and no users yet, there are no error-rate dashboards to
watch — so the signal has to be something that exists on day one.

- A. The smoke tests from Q2 are the whole signal — they pass, the deploy stands; one fails, redeploy the previous commit. Nothing automated.
- B. Smoke tests plus a manual CloudWatch look — check Lambda error counts and AppSync 5xx for the first hour after a deploy, roll back on anything non-zero that was zero before.
- C. Smoke tests plus a CloudWatch alarm on Lambda errors and AppSync 5xx that emails you — set up now, so the signal arrives without you remembering to look.
- X. Other (please specify)

Note that observability-setup (4.4) runs next and owns dashboards and alerting
properly. The question here is only what the *first* deploy is judged by, before
that stage has run.

[Answer]: A

## Q4. Sandbox first, or straight to `main`?

Two known hazards sit in the first deploy. The Cognito hosted-UI domain does not
exist until after the first deploy, so the Google OAuth redirect URI cannot be
registered beforehand and the first sign-in attempt will fail. And IT-1
(signed-in reminder authorization) is predicted to fail by Build and Test.

With one environment, `main` is production — so a first deploy that trips both of
these trips them in production, with nobody watching.

- A. `ampx sandbox` first — deploy the whole backend to a throwaway environment, work through the OAuth registration and IT-1 there, then merge to `main` only once the sequence is known to work. Costs a few rupees and a sandbox teardown.
- B. Straight to `main` — there are no users yet, so a broken first deploy harms nobody, and the sandbox is an extra step that proves the same thing twice.
- C. Sandbox first for the backend, and treat the first app release as internal-testing-only on Play Console with no public rollout until the backend sequence is proven.
- X. Other (please specify)

[Answer]: B

## Consolidated Summary Confirmation

- Looks correct
- Request changes

[Answer]: Looks correct
