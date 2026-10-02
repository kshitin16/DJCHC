# Deployment Strategy

## Sources

- [scope] Workflow-selected scope: `temple-mobile-app`; Depth: Standard.
- Consumed: `construction/flutter-app-unit/infrastructure-design/cicd-pipeline.md`; every backend unit's `infrastructure-design/cicd-pipeline.md`; `construction/ci-pipeline/ci-config.md`; `construction/ci-pipeline/quality-gates.md`; `construction/build-and-test/build-and-test-summary.md`.
- [Q1] One permanent environment now; staging added when there are users a bad deploy would affect.
- [Q2] No deploy branch — `main` is the trunk and the environment.
- Rules: org.md § Deployment, § Way of Working; team.md § Way of Working Q2, § Deployment Q8.

## Shape

Two independent delivery paths that happen to live in one repository, because they
have genuinely different mechanics:

| | Backend (Amplify Gen2) | App (Flutter) |
|---|---|---|
| Artefact | CloudFormation stacks, deployed in place | A signed `.aab` / `.ipa` that users install |
| Who deploys | Amplify Hosting, watching the branch | The builder, from their own machine |
| Trigger | merge to `main` | a deliberate release |
| Rollback | redeploy a prior commit | halt the rollout; ship a higher build number |
| Blast radius | every user at once | only devices that took the update |

The asymmetry matters: a bad backend deploy affects everyone immediately and can be
reverted in minutes. A bad app release reaches users gradually and **cannot** be
reverted — neither store allows downgrading a device that already updated. That is
why the app path carries the heavier manual gate.

## Environments

**One permanent environment**, plus ephemeral developer sandboxes (Q1).

| Environment | Source | Lifetime | Purpose |
|---|---|---|---|
| `main` | the trunk | permanent | The live backend. One Cognito User Pool, one set of DynamoDB tables, one S3 bucket, the Lambdas, the AppSync API, the Scheduler group. |
| `ampx sandbox` | the builder's working tree | ephemeral | Every pre-release check. Torn down after. |

### Why one, and what it costs

Each permanent Amplify branch environment provisions a complete, separate set of
AWS resources. A second one roughly doubles the baseline spend for a temple
community app with no users yet.

What that buys up front is nothing, because there is nobody to protect from a bad
deploy. What it costs later, once there are worshippers relying on the app, is
real: a change would reach them without ever having run against live AWS outside a
sandbox.

So this is explicitly **a starting posture, not a permanent one**. The trigger to
add staging is the arrival of real users, not a date.

### What a sandbox does and does not cover

A sandbox is a full, real AWS environment — real Cognito, real DynamoDB, real S3.
Everything the unit tests fake is real in a sandbox, which is why it is where the
25 `Unverified` targets from Build and Test actually get settled.

What it does not cover: production data volume, concurrent users, and the specific
identifiers production will carry. A sandbox proves the system works; it does not
prove it works at scale, which is `performance-validation`'s job.

## Backend deployment

**Trigger:** merge to `main`. Amplify Hosting watches the branch and deploys
itself — it needs no AWS credentials in GitHub Actions, which is why CI holds zero
secrets. That property is worth preserving.

**Gate before merge:** CI must be green (lint, format, type-check, tests, the 80%
coverage floor), plus the pre-release checklist below. The gate is on the *merge*,
because with one environment a merge is a production deploy. There is no promotion
step to gate separately.

That is a meaningful change from the Infrastructure Design, which assumed `main`
deployed to staging and a second promotion reached production. With one
environment, **merging to `main` puts it live.** Anyone working on this needs to
know that.

**Strategy:** in-place replacement. Amplify Gen2 reconciles the deployed stack to
match the source on each deploy. Blue-green and canary are not available here and
would be disproportionate at this scale.

**Migrations:** the data model is declarative in `amplify/data/resource.ts`. Amplify
reconciles tables and indexes. There is no migration script to sequence, but
**removing a field or an operation is a breaking change** for any app version
already in users' hands — and unlike the backend, those cannot be rolled back.
Contract changes are additive by the contract ownership rules; that rule is what
makes app-version skew safe, and it must hold.

## App deployment

Built locally, never in CI — no macOS runner, no signing material in Actions.

| Step | Action |
|---|---|
| 1 | Confirm `main` carries every backend change this app version depends on |
| 2 | `ampx generate outputs --branch main --app-id <amplify-app-id> --format dart --out-dir lib` — regenerate the gitignored outputs file against the live backend, replacing the sandbox one |
| 3 | Local pre-release verification (below) passes |
| 4 | Bump `version` in `pubspec.yaml`; the build number must strictly increase — both stores reject a reused one |
| 5 | Android: `flutter build appbundle --release`, signed via `android/key.properties`; upload to Play Console **internal testing**, smoke on a real device, then staged rollout (20% → 100%) |
| 6 | iOS: `flutter build ipa --release` with Xcode automatic signing; upload via Transporter; TestFlight smoke on a real device; submit with **phased release** enabled |
| 7 | Watch Crashlytics and store vitals over the first days |

Step 2 changed from `--branch production` to `--branch main` (Q2). The failure it
guards against is unchanged and still the sharpest one in the list: an outputs file
generated against the wrong backend is the one way a release can silently point
somewhere unintended.

### Local pre-release verification

Against a running `ampx sandbox`, on the builder's machine:

1. `flutter test integration_test/` on a connected device — Google-federation sign-in through the real OAuth screen, the admin allowlist gate refusing a non-admin server-side, and the Calendar/reminder registration flow.
2. A `flutter run --profile` pass measuring cold start and screen transitions.
3. A brief self-review of any change touching sign-in, permissions, `services/*.dart`, or payment handling — `project.md` Mandated.

**None of this has ever been run.** It needs the Android SDK or Xcode, neither of
which is installed. Until it does, the app has never been built or executed.

> ~~Neither is installed.~~ **Amended 2026-10-01 at Deployment Execution:** no longer true — Xcode 27.0, Android Studio and the Android SDK were already installed; CocoaPods and the Android `cmdline-tools` component were installed at that stage, `flutter doctor` reports no issues, and both `flutter build apk --debug` and `flutter build ios --debug --no-codesign` succeeded. The integration tests and the profile
> pass still have not been run — those need a deployed backend, not a toolchain.

## Pre-release checklist (team.md Q8)

Replaces org.md's "tech lead + product owner sign-off", which does not map to a
solo builder:

- No secrets committed — pre-commit hook and GitHub scanning both clean
- No open dependency warnings — Dependabot clear or explicitly triaged
- Any AWS permissions or auth change double-checked
- Self-review of any sign-in, permissions or payment change

With one environment, this checklist gates **every merge to `main`**, not just an
app release. That is a heavier obligation than the two-environment design assumed,
and it is the main cost of the Q1 choice.

## Known gaps carried into deployment

| Gap | Effect |
|---|---|
| The CI workflow has never run in GitHub | Its first push is itself a test |
| Branch protection on `main` not confirmed | Without it CI reports rather than blocks — and with one environment, an unblocked merge is a production deploy |
| ~~No Android SDK / Xcode / CocoaPods~~ **Resolved 2026-10-01** | ~~No app can be built or released at all until installed~~ Toolchain green; both platforms build |
| IT-1, signed-in reminder authorization | Predicted to fail; one sandbox sign-in settles it |
| 25 `Unverified` targets | Most convert at the first sandbox deploy |
| Payment aggregator account absent | Donations stay flag-gated off |
| Firebase project not created | No push, no crash reporting |
| Google OAuth credentials not registered | No sign-in at all |
| Accessibility (NFR7) | Unbuilt, unowned, no gate |

The last four are all prerequisites rather than risks: nothing deploys usefully
until Firebase and Google OAuth exist.

## When to revisit

- **Add staging** when real users arrive. At that point the deploy-branch question from Q2 reopens, and it should be answered then rather than assumed.
- **Reconsider local-only app builds** if a second person ever contributes. A single machine holding the only signing keys is a single point of failure for releases.
- **Revisit in-place backend deploys** if downtime during a deploy ever becomes user-visible.
