# Deployment Log

## Sources

- [scope] Workflow-selected scope: `temple-mobile-app`; Depth: Standard.
- Consumed: `operation/deployment-pipeline/cd-config.md`; `operation/deployment-pipeline/deployment-strategy.md`; `operation/deployment-pipeline/rollback-runbook.md`; `operation/environment-provisioning/environment-inventory.md`; `operation/environment-provisioning/validation-report.md`; `construction/build-and-test/test-results.md`.
- Verified directly against the machine and the source: `flutter doctor -v`, `amplify/**/resource.ts` (five `secret()` names), `android/app/build.gradle.kts` and `ios/Runner.xcodeproj/project.pbxproj` (app id).
- [Q1] Produce the runbook and verification spec; results recorded `Not run`. [Q4] Straight to `main`, no sandbox rehearsal.
- Rules: org.md § Deployment; team.md § Deployment Q8; phases/operation.md § Deployment Procedures.

## Status: NOT EXECUTED

No deployment has been performed. There is no AWS account connected to this
machine, so there is nothing to deploy to. Every step below is `Not run` and
carries the command that settles it.

This document is the sequence to follow on deploy day, not a record of a deploy.

## What changed during this stage

The local toolchain gap recorded in `deployment-strategy.md`, `validation-report.md`
and `construction/build-and-test/test-results.md` — "no Android SDK / Xcode /
CocoaPods" — was **stale**. A direct survey found most of it already present.

| Component | Recorded as | Actually |
|---|---|---|
| Xcode | Not installed | **27.0, installed** |
| Android Studio + SDK | Not installed | **Installed, SDK 36.0.0** |
| Android `cmdline-tools` | — | Was missing; **installed during this stage** |
| CocoaPods | Not installed | Was missing; **1.17.0 installed during this stage** |
| Flutter | 3.47.4 | 3.47.4, unchanged |
| Physical device | None | **An iPhone is connected over the network** |

`flutter doctor` now reports **no issues in any category**. Installing the
`cmdline-tools` package required accepting its Android SDK licence, which was
accepted as part of that install.

**Correct the three upstream documents.** They each carry "No Android SDK / Xcode"
as a blocking gap and it is no longer true. Leaving it would mean the next person
reading the plan believes the app cannot be built when it can.

### The app now builds — finding F-3 is closed

Build and Test recorded **F-3: "the build has never run past type-check"** — no
`flutter build`, no deployed anything, code that compiles and passes its tests but
has never been assembled into a runnable artefact. That is no longer true.

| Build | Command | Result |
|---|---|---|
| Android debug | `flutter build apk --debug` | **SUCCESS** — `build/app/outputs/flutter-apk/app-debug.apk`, 178 MB, 496s |
| iOS debug (unsigned) | `flutter build ios --debug --no-codesign` | **SUCCESS** — `build/ios/iphoneos/Runner.app`, built for device as `in.sarovarjinalaya.app` |

Gradle accepted the Android SDK Platform 35 and CMake 3.22.1 package licences
automatically during the build and installed both. The iOS build resolved the
Firebase iOS SDK and its dependencies through Swift Package Manager, which
confirms the push and crash-reporting dependencies are correctly declared even
though no Firebase project exists yet.

This does not make the app *correct* — it has still never run against a real
backend, and no integration test has ever executed. It does prove the thing F-3
said was unproven: the source assembles into an installable artefact on a real
toolchain.

## Prerequisite state

### Settled

| Prerequisite | State |
|---|---|
| Flutter toolchain | Green |
| Android toolchain | Green |
| Xcode / CocoaPods | Green |
| A real device to test on | Connected iPhone |
| Backend tests | 284 pass, 94.97% line coverage |
| App tests | 203 pass, 91.31% line coverage |

### Blocking — all account-side, all need a browser

| Prerequisite | Needed for | Exact value for this project |
|---|---|---|
| AWS account + IAM credentials | Everything | Region **`ap-south-1`** |
| AWS CLI installed and configured | `ampx`, console checks | `brew install awscli`, then `aws configure` |
| Google Cloud OAuth client (Web application) | Sign-in | Redirect `https://<cognito-domain>/oauth2/idpresponse` — the domain exists only after the first deploy |
| Firebase project | Push, Crashlytics | App id **`in.sarovarjinalaya.app`** on both platforms |
| Amplify app | The backend itself | Created in `ap-south-1`, connected to `main`, auto-build on |

### The five secrets

Verified by reading `amplify/**/resource.ts` rather than the design documents.
All five go through Amplify's `secret()` helper, which stores them in SSM
Parameter Store — **not** AWS Secrets Manager, whatever the infrastructure-design
documents say.

| Secret | Consumer |
|---|---|
| `GOOGLE_CLIENT_ID` | `amplify/auth/resource.ts` |
| `GOOGLE_CLIENT_SECRET` | `amplify/auth/resource.ts` |
| `DONATION_AGGREGATOR_API_KEY` | `donation-reconciler` |
| `DONATION_AGGREGATOR_WEBHOOK_SECRET` | `donation-webhook` |
| `REMINDER_FCM_SERVICE_ACCOUNT` | `deliver-push` |

Set locally with `npx ampx sandbox secret set <NAME>`, and in the Amplify Console
for the deployed environment.

## Deploy sequence

Each step blocks the one after it. Status is `Not run` throughout.

| # | Step | Command or action | Status |
|---|---|---|---|
| 1 | Create the AWS account | Browser; a payment card is required even on free tier | Not run |
| 2 | Install the AWS CLI | `brew install awscli` | Not run |
| 3 | Configure credentials | `aws configure` — region `ap-south-1` | Not run |
| 4 | Confirm the account answers | `aws sts get-caller-identity` | Not run |
| 5 | Create the Google Cloud OAuth client | Browser; Web application type. Leave the redirect URI for step 12 | Not run |
| 6 | Create the Firebase project | Browser; register `in.sarovarjinalaya.app` for Android and iOS; download `google-services.json`, `GoogleService-Info.plist`, and a service-account JSON | Not run |
| 7 | Set the five secrets locally | `npx ampx sandbox secret set <NAME>` for each | Not run |
| 8 | Push the branch | CI runs for the first time — its own first test | Not run |
| 9 | Turn on branch protection for `main` | GitHub settings; require the CI workflow to pass | Not run |
| 10 | Create the Amplify app | Console, region `ap-south-1`; connect `main`; one branch only; auto-build on | Not run |
| 11 | Set the five secrets in the Amplify Console | Per the `main` environment | Not run |
| 12 | Register the OAuth redirect URI | Google Cloud Console, now that the Cognito domain exists | Not run |
| 13 | Add the first `Admin` group member | Cognito console. Until this exists, nobody can administer anything | Not run |
| 14 | Generate the app's outputs file | `npx ampx generate outputs --branch main --app-id <id> --format dart --out-dir lib` | Not run |
| 15 | Run the smoke tests | `smoke-test-results.md` | Not run |
| 16 | Enable PITR, versioning, lifecycle, log retention | Per `environment-inventory.md` | Not run |
| 17 | Create the budgets and anomaly detection | Per `environment-inventory.md`; verify the action budget's scope before arming it | Not run |

**Step 9 is the one people skip.** With one environment a merge to `main` is a
production deploy, so without branch protection CI reports rather than blocks and
a red run can go live. It takes a minute and it is what makes the pre-release
checklist real.

**Step 12 is the chicken-and-egg.** The Cognito hosted-UI domain does not exist
until the first deploy completes, so the redirect URI cannot be registered
beforehand. Sign-in will fail between steps 10 and 12. That is expected, not a
defect — do not debug it before step 12.

**Step 14's hazard** is generating outputs against the wrong backend. That is the
one way a release can silently point somewhere unintended. Confirm the app id.

## First deploy: straight to `main` (Q4)

No sandbox rehearsal. The reasoning accepted here: there are no users yet, so a
broken first deploy harms nobody, and the sandbox would prove the same thing
twice.

What that choice accepts, stated plainly so it is not a surprise:

- `main` is production. The first deploy is therefore a production deploy performed by someone who has never deployed this system.
- The two known hazards — the step-12 redirect URI, and IT-1 (signed-in reminder authorization), which Build and Test predicts will fail — will both trip in production rather than in a throwaway environment.
- Neither is harmful while there are no users. Both become serious once there are, which is also when `deployment-strategy.md` says to add a staging environment.

**The trigger to revisit is the arrival of real users**, not a date. At that point
the Q4 answer should be re-asked, because its premise — nobody is affected by a
bad deploy — will have expired.

## Rollback

Unchanged from `rollback-runbook.md`; the trigger is defined in
`health-check-report.md`.

| Path | Action |
|---|---|
| Backend | Redeploy the previous commit. Amplify reconciles the stack back. Minutes. |
| App | Halt the rollout and ship a higher build number. **Cannot be reverted** on devices that already updated. |

The asymmetry is the reason the app path carries the heavier manual gate.

## Database migrations

None. The data model is declarative in `amplify/data/resource.ts` and Amplify
reconciles tables and indexes on each deploy. There is no migration script to
sequence or roll back.

The real migration hazard here is different: **removing a field or an operation is
a breaking change** for any app version already installed, and those cannot be
rolled back. Contract changes must stay additive.

## Confirmation

The decisions in this document were confirmed by the builder at this stage's
summary checkpoint: produce the runbook and verification spec with every result
`Not run` (Q1); critical-path-only smoke tests (Q2); smoke tests as the whole
health signal (Q3); straight to `main` with no sandbox rehearsal (Q4).
