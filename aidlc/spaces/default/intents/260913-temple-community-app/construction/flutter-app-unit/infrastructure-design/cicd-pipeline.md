# CI/CD Pipeline — flutter-app-unit

This Unit is the Flutter side of the single project-wide GitHub Actions workflow team.md (Q7) affirmed: `flutter analyze` + `flutter test --coverage` on every push/PR to `main`, blocking merge. Unlike every backend Unit, its "deploy" is not an Amplify Hosting promotion but an app-store release — and by the builder's decision at this stage (Q3: A) that release is produced **locally on the builder's machine**, not in CI. So the pipeline below has a CI half (verification, automated, no secrets) and a release half (manual, ordered, on one machine). The screens it verifies are those in `functional-spec.md`; the contracts its tests mock or exercise are the nine in `contract-summary.md`; the component boundary it protects is `security-design.md`'s `services/*.dart` layer, mapped from `components.md`'s six consumed components; the performance checks come from `performance-design.md`; and the single-component blast radius that makes a client-only rollback sufficient comes from `logical-components.md`.

## CI stages (GitHub Actions, Linux runner, every push/PR to `main`)

| Stage | What runs | Gate | flutter-app-unit relevance |
|---|---|---|---|
| Checkout + toolchain | Pinned Flutter stable via `subosito/flutter-action`, `flutter pub get` | Fails the job on a resolution error | One pinned Flutter version in the workflow file, bumped deliberately — the same discipline as the backend's pinned Node version. |
| Backend-outputs stub | Write a placeholder `lib/amplify_outputs.dart` (`const amplifyConfig = '{}';`) | None | The real file is generated and git-ignored (`infrastructure-specification.md` > IaC approach), so CI would otherwise fail to compile. The stub lets analyze and unit/widget tests run with **no AWS credentials in CI** (Q4: A); no test may call a real backend. |
| Format + lint | `dart format --set-exit-if-changed .` then `flutter analyze` (with `flutter_lints`, team.md Q9) | Blocks merge | `flutter analyze` is also this Unit's compile-level check — CI never runs `flutter build`, which would need signing material or a real outputs file. The `services/`-only import boundary (team.md Q12) is NOT enforced by `flutter_lints`; the change-review trigger below is what holds it. |
| Unit + widget tests | `flutter test --coverage` (unit tests for business logic, `flutter_test` widget tests for each screen's five states — team.md's affirmed mix); Amplify calls mocked at the `services/` seam | Blocks merge on any failure | This is the whole automated test surface for the Unit in CI (Q4: A). |
| Coverage floor | `lcov` summary of `coverage/lcov.info` against the affirmed floor: smoke-level for the walking-skeleton Bolt, **80% line coverage from the second Bolt onward** (team.md Q5/Q6), implemented as a small script step that fails below the floor | Blocks merge | The floor is enforced in CI because this is the project's only mechanism against a skipped or weakened test (team.md Q7). |
| Secret scanning | Pre-commit `gitleaks`/`detect-secrets` on staged diffs + GitHub secret scanning and push protection (project.md Mandated, team.md Q13) | Blocks commit / blocks push | Specifically relevant here: `android/key.properties`, the upload keystore, and any exported Apple certificate are exactly the files that must never land in a commit. `.gitignore` carries all three plus `lib/amplify_outputs.dart`. |
| Dependency alerts | Dependabot on `pubspec.yaml` (team.md Q13) | Advisory — triaged before each release (team.md Q8) | Covers `amplify_flutter`, `amplify_auth_cognito`, `amplify_api`, `amplify_storage_s3`, `firebase_core`, `firebase_crashlytics`, `firebase_messaging`. |
| Release build | **Not run in CI** | — | Q3: A. No macOS runner, no signing secrets, no store-upload credentials in GitHub Actions. |

## Local pre-release verification (before every production promotion)

Runs on the builder's machine against `ampx sandbox` — the only environment a device build can exercise pre-release, since there are no flavors and no staging-targeted build (Q1: B):

1. `ampx sandbox --outputs-format dart --outputs-out-dir lib` running, so `lib/amplify_outputs.dart` points at the sandbox backend.
2. `flutter test integration_test/` on a connected device or emulator — the higher-risk flows team.md names: Google-federation sign-in (a real Google test account through the browser OAuth screen), the admin allowlist gate (a non-admin is refused server-side), and the first-release Calendar/reminder registration flow; later, the donation hand-off. This is a line item on the manual production checklist, not a CI step (Q4: A).
3. A `flutter run --profile` pass measuring cold start (< 3s p95) and screen transitions (< 300ms p95) — `monitoring-design.md`'s manual NFR-PERF.1/PERF.2 verification.
4. Any change to sign-in, permissions/screen gating, `services/*.dart`, or (later) the donation hand-off gets the brief self-review project.md Mandates (Q14 option E) — the change-review trigger `security-design.md` names for this Unit.

## Release procedure (manual, builder's machine)

| Step | Action | Gate |
|---|---|---|
| 1 | Confirm the backend the release will talk to is already promoted: the `production` Amplify branch carries every backend change this app version depends on (contracts are additive, `contract-summary.md`, so an older app version keeps working against the newer backend — but never ship an app that calls a field or operation the production backend does not yet have) | Manual checklist (team.md Q8): no secrets committed, Dependabot alerts clear or triaged, AWS permission/auth changes double-checked |
| 2 | `ampx generate outputs --branch production --app-id <amplify-app-id> --format dart --out-dir lib` — regenerate the git-ignored outputs file from the production backend (replacing the sandbox one) | The file's Cognito/AppSync identifiers match the production branch (a wrong-branch outputs file is the one way a "production" build could silently point at staging) |
| 3 | Local pre-release verification above passes (integration tests, profile run, self-review) | All green |
| 4 | Bump `version` in `pubspec.yaml` (build number strictly increasing — both stores reject a reused build number) | — |
| 5 | Android: `flutter build appbundle --release` (signed with the upload key via `android/key.properties`); upload the `.aab` to the Play Console **internal testing** track, smoke it on a real device, then promote to production (staged rollout, e.g. 20% → 100%) | Play Console pre-launch report clean |
| 6 | iOS: `flutter build ipa --release` (or Xcode Product > Archive) with Xcode automatic signing; upload via Transporter/Xcode Organizer to App Store Connect; TestFlight smoke on a real device; submit for review with **phased release** enabled | App Review approval |
| 7 | Watch Crashlytics and store vitals for the new version over the first days (`monitoring-design.md`) | — |

## Rollback

There is no server-side artifact to roll back for this Unit — `logical-components.md`'s blast radius is exactly the devices running a bad build, so rollback means stopping that build from spreading and getting a good one out:

- **Android**: in the Play Console, **halt the staged rollout** immediately (users who have not yet received the update stay on the previous version), then either promote the previous release again or ship a fixed build with a higher build number. Play does not support "downgrading" already-updated devices; those users receive the fix on the next release.
- **iOS**: **pause the phased release** in App Store Connect. Apple offers no downgrade either: the remedy is a fixed build submitted with an expedited-review request. A previous build cannot be re-submitted with the same version number.
- **Backend compatibility on rollback**: because every contract change is additive (`contract-summary.md`'s ownership rules), a rolled-back older app version continues to work against the current production backend; a rollback of the *backend* (an Amplify Hosting redeploy to a prior commit, per the backend Units' own `cicd-pipeline.md`) must likewise never remove a field or operation a shipped app version calls.

## Secrets management in CI/CD

| Secret | Where it lives | Where it must never be |
|---|---|---|
| Android upload keystore + `android/key.properties` (store/key passwords) | Builder's machine only; a backup in the builder's own encrypted storage / password manager | The repository (git-ignored), GitHub Actions secrets (nothing in CI signs anything — Q3: A) |
| Apple Distribution certificate + provisioning profile | Xcode automatic signing on the builder's machine (Keychain) | The repository, GitHub Actions, any exported `.p12` on disk beyond the Keychain |
| APNs authentication key (`.p8`) | Downloaded once from the Apple Developer account and uploaded once to the Firebase console; the local copy deleted afterwards | The repository, CI, Secrets Manager (it belongs to Firebase, not to any AWS resource) |
| Firebase service-account credential (FCM) | reminder-unit's Secrets Manager secret (`reminder-fcm-service-account`), per that Unit's `cicd-pipeline.md` | Anywhere in this Unit's repository or build |
| `google-services.json` / `GoogleService-Info.plist` | Committed — non-secret app configuration; the embedded API key is restricted to the registered app IDs | Treated as secrets (they are not; treating them so would only complicate CI for no gain) |
| Google OAuth Client ID/Secret | auth-unit's Secrets Manager secret, referenced from `amplify/auth/resource.ts` | This Unit — the mobile app never sees Google's client secret; it only follows Cognito's hosted-UI redirect |
| `lib/amplify_outputs.dart` | Generated locally, git-ignored; contains endpoint IDs and a public Cognito App Client ID (no secret) | Committed (it would pin every developer and CI run to one backend and go stale); stubbed in CI instead |

This is the one Unit in the project whose CI holds **zero secrets of any kind** — a direct consequence of building releases locally, and the reason the CI half above can run on a fork's pull request safely.
