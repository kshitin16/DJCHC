# Code Summary — flutter-app-unit

## Sources

- [scope] Workflow-selected scope: `temple-mobile-app`.
- Consumed: the approved `code-generation-plan.md` and `unit-test-instructions.md` for this Unit (see that directory), plus the flutter-app-unit design artifacts and the built backend schema `amplify/data/resource.ts`.

## What was built

The one Flutter binary (iOS + Android) over the six backend Units: 12 screens, six `services/*.dart` contract wrappers behind a single `services/`-only Amplify boundary, three root notifiers (`AuthState`, `LocalizationController`, `DeviceIdentityState`), English + Hindi localization, Crashlytics wiring, and FCM push for reminders. Screens 8–11 (Donate, My Donations, PDF Library, Admin PDF Library) are built and tested but hidden behind compile-time feature flags (`donationsEnabled = false`, `pdfLibraryEnabled = false`) pending the aggregator account and the builder's choice to surface the library.

## Files created/modified

52 `lib/` files, 33 `test/` files, 1 `integration_test/` file, 2 `tool/` files, plus the standard `flutter create` scaffold (`android/`, `ios/`, `pubspec.yaml`, `analysis_options.yaml`, `.metadata`). `.gitignore` extended with Flutter's own ignore entries plus `lib/amplify_outputs.dart`, `android/key.properties`, `*.jks`/`*.keystore`. `README.md` gained a "Mobile App" section (layout, the `services/`-only rule, the auth-mode-per-call table, the identity-switch note, feature flags, local/CI setup, Firebase one-time setup, device-build prerequisites, release checklist, the self-review trigger, and a flag that the Hindi copy needs native-speaker review before release). Full path list: `<code-generation-record>/source-manifest.json`.

## Key implementation decisions

- **Amplify boundary held exactly as designed**: only `lib/services/amplify_gateway.dart` imports `package:amplify_flutter`/`package:amplify_api`/`package:amplify_auth_cognito`; only `lib/services/push_gateway.dart` imports `package:firebase_messaging`. No screen or widget imports Amplify (project.md Mandated, verified — see Self-review below).
- Raw hand-written GraphQL documents per operation (no model codegen), matched field-for-field against the built `amplify/data/resource.ts` rather than the design documents where the two disagreed (see Deviations).
- Auth mode per call follows the plan's table: `listPosts`/`listDocuments`/`getDocumentDownloadUrl` switch between `identityPool` (signed out) and `userPool` (signed in); every Contract 9 (reminder) operation is always `identityPool`; everything else is `userPool`.
- Fakes, not a mocking framework: `FakeApiGateway`/`FakeAuthGateway`/`FakePushGateway`/`FakePreferencesStore` plus `http`'s `MockClient` for the one real HTTP call (the S3 PUT). No `mockito`/`mocktail` dependency was added.
- Plain `ChangeNotifier`/`ValueNotifier` throughout — no state-management package.

## Deviations from the plan (declared in the plan itself, carried here)

| From | Deviation | Why |
|---|---|---|
| tech-stack-decisions.md | `amplify_storage_s3` not added | Contract 6 uses pre-signed URLs; nothing calls Amplify Storage |
| frontend-components.md | `lib/state/` folder added to the layer-first list | Root notifiers are neither models nor screens; the team's list is a baseline, not exhaustive |
| infrastructure-specification.md | Application/bundle ID set to `in.sarovarjinalaya.app` | The spec named none; needed before Firebase app registration |
| functional-spec.md Screens 8–11 | Built but compile-time flagged off | donation-unit is a thin flagged build; no aggregator account yet |
| reminder-unit design | Identity switch on sign-in/out re-syncs rather than migrates reminders | Plan rule 4; the sandbox-integration finding is still open (see below) |

## One additional deviation found and fixed during verification

The plan did not call out Flutter's own localization delegate setup, and the generated `lib/app.dart` declared `supportedLocales: [en, hi]` without registering `flutter_localizations`' `Global{Material,Widgets,Cupertino}Localizations.delegate`s. Under the app's own string table (`AppStrings`) this is invisible for ordinary text, but it left Flutter's built-in Material/Widgets/Cupertino strings unresolvable for `hi` and surfaced as two widget-test failures (`a Hindi device locale renders the app in Hindi`, `a language change from Account re-renders the whole shell`). Fixed by adding the `flutter_localizations` SDK dependency (`pubspec.yaml`) and the three delegates to `MaterialApp` (`lib/app.dart`). Both tests pass after the fix; no other file was touched to make this pass.

## Test coverage summary

- **203 / 203 tests passing** (`flutter test --coverage test/`, exit 0).
- **91.34% line coverage** (1867/2044 lines, 42 files) against the 80% floor (`dart run tool/check_coverage.dart --min 80`) — the plan predicted ≥85%, citing the real Amplify/Firebase bootstrap files and the generated `amplify_outputs.dart` stub as the expected uncovered lines; the actual number landed above that estimate.
- `flutter analyze`: no issues. `dart format --set-exit-if-changed .`: clean (0 changed after a one-time reformat of 80 files that predated a completed formatting pass).
- `integration_test/app_test.dart` is written and compiles (verified via `flutter analyze`) but is **not run** in this pass — it needs a running `ampx sandbox` and a connected device/emulator, neither available on this machine (no Android SDK / Xcode). This is per plan and per `cicd-pipeline.md`; it stays out of CI.

## Self-review (project.md Mandated — sign-in/permission changes)

This Unit's identity path (`lib/services/auth_service.dart`, `lib/services/amplify_gateway.dart`, `lib/state/auth_state.dart`) and gating logic (`lib/app.dart`) were reviewed before hand-back:
- Every screen/widget file was checked for `package:amplify_*` and `package:firebase_*` imports — none found outside the two designated gateway files.
- Client-side gating in `lib/app.dart` (`AppShell._signedInTabs`, the Admin entry, tab visibility) is confirmed UX-only: every one of it is a read of `AuthState`'s already-resolved values, and the doc comment states plainly that the enforcing layer is each backend Unit's own AppSync authorization rule, not this file.
- Every Contract 9 (reminder) call in `lib/services/reminder_service.dart` uses `AuthMode.identityPool`; the public reads (`listPosts`, `listDocuments`, `getDocumentDownloadUrl`) switch correctly on `AuthState.isSignedIn`.
- No secret, credential, or API key is hardcoded; `lib/amplify_outputs.dart` (the one file that would carry backend config) is git-ignored, and the fix above touched only localization wiring, not the auth/gating surface.

## Known gap carried to Build and Test / sandbox integration

The identity-switch behaviour disclosed in the plan (rule 4) — whether an already-scheduled reminder under a prior Identity Pool identity produces a duplicate push after a sign-in/out — is unresolved by design (the builder's simplicity preference for the reminder module, recorded in `project.md`). It is verifiable only against a real `ampx sandbox` and device, which is why `integration_test/app_test.dart` exists but is not run here.

## Nothing for the human to decide right now

Every target in this pass was met without a tradeoff that needs a builder decision. The one open item — the reminder identity-switch behaviour — was already the builder's explicit, recorded choice; it surfaces again only if sandbox integration testing shows an actual duplicate-push problem.
