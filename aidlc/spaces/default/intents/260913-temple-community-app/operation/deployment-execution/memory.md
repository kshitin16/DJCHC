<!-- INVARIANT: examples are single-line HTML comments so a fresh template parses to total=0 (MEMORY_EMPTY). Do NOT un-comment or split across lines. t100 guards this. -->
> This file is kept up to date automatically while the stage runs. Add observations at the review step, not by editing here directly.

## Interpretations
<!-- example: 2026-05-29T10:14:32Z — chose REST over GraphQL; the consuming team only needs CRUD, revisit if subscriptions land -->
- 2026-10-01T08:42:40Z — The machine still has no AWS credentials, no AWS CLI, no Android SDK and no Xcode, and amplify_outputs.json does not exist; checked directly rather than assumed. No deployment can be executed here, so the stage's condition ("after deployment pipeline and environment are ready") is not met in the literal sense.
- 2026-10-01T10:24:01Z — The "no Android SDK / Xcode" gap carried in deployment-strategy.md, validation-report.md and build-and-test is STALE. flutter doctor -v shows Xcode 27.0, Android Studio, Android SDK 36.0.0, Flutter 3.47.4 and a connected iPhone. Only CocoaPods and the Android cmdline-tools component were missing; both installed here. Surveying the machine rather than trusting the upstream documents is what found this.
- 2026-10-01T10:34:02Z — flutter build apk --debug SUCCEEDED (496s, 178MB app-debug.apk). This closes finding F-3 from Build and Test, "the build has never run past type-check". Gradle auto-accepted the Android SDK Platform 35 and CMake 3.22.1 package licences during the build. An iOS --no-codesign build was started to prove the other platform.
- 2026-10-01T10:37:24Z — flutter build ios --debug --no-codesign also SUCCEEDED; Runner.app built for device as in.sarovarjinalaya.app, with the Firebase iOS SDK resolved through Swift Package Manager. Both platforms build.

## Deviations
<!-- example: 2026-05-29T10:14:32Z — skipped the optional caching layer the stage prose suggested; the dataset is small enough that it adds risk -->
- 2026-10-01T10:24:01Z — The builder answered Q1 with a request for help making the prerequisites available rather than picking an offered option. Treated it as a discussion request per the Other-escape rule: did the local installs, verified the real gap, added option C (hold the stage open and deploy for real), and re-presented the question.
- 2026-10-01T10:37:24Z — Amended three already-approved upstream documents (deployment-strategy.md, environment-provisioning/validation-report.md, build-and-test/test-results.md) in place with strike-through and a dated note, rather than only describing the staleness in this stage's output. A document that accurately describes a blocker that no longer exists misleads whoever reads it next.

## Tradeoffs
<!-- example: 2026-05-29T10:14:32Z — picked TDD over BDD this run; the team is unit-first and the domain is well-understood -->
- 2026-10-01T10:31:12Z — Q2 chose critical-path-only smoke tests over the variant that adds the admin allowlist check (S-7), and Q4 chose straight-to-main over a sandbox rehearsal. Together these put the project's only privilege boundary into production unproven. Did NOT re-ask: option B of Q2 offered exactly that check and was declined, and re-asking an answered question is forbidden. Recorded the consequence prominently in the artifacts and surfaced it at the gate instead.
- 2026-10-01T10:31:12Z — Q3 chose smoke tests as the whole health signal with no alarm. This is a legitimate deferral rather than a gap because observability-setup (4.4) runs next and owns alerting; noted the dependency explicitly so it cannot be quietly dropped.

## Open questions
<!-- example: 2026-05-29T10:14:32Z — confirm the retention window with compliance before the next stage hardens the schema -->
- 2026-10-01T08:42:40Z — Whether to run this stage as a first-deploy runbook with every result marked Not run, or report it skipped until credentials exist. Asked the builder rather than deciding: the prerequisites are all outside the workflow (AWS account, Google OAuth client, Firebase project, Android SDK/Xcode).
