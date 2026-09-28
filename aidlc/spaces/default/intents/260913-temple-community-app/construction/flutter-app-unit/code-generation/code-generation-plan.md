# Code Generation Plan — flutter-app-unit

## Sources

- [scope] Workflow-selected scope: `temple-mobile-app`.
- Consumed: `flutter-app-unit/functional-design/{functional-spec.md, frontend-components.md}`, `nfr-requirements/{tech-stack-decisions.md, security-requirements.md, performance-requirements.md}`, `nfr-design/{performance-design.md, security-design.md, logical-components.md}`, `infrastructure-design/{infrastructure-specification.md, cicd-pipeline.md, monitoring-design.md}`, `inception/contract-design/contract-summary.md` (Contracts 1–6, 9), `inception/units-generation/unit-of-work.md` (U6), `inception/requirements-analysis/requirements.md` (FR1–FR7), and the six backend Units' built schema in `amplify/data/resource.ts` (the operation names, argument names and return shapes the app must call exactly).
- Rules in force: team.md Code Style (layer-first `lib/`, plain `ValueNotifier`/`ChangeNotifier`, `flutter_lints`, `dart format`), project.md Mandated (only `services/` may import `package:amplify_*`; personal data encrypted in transit — TLS via Amplify; self-review for sign-in/permission changes; never hardcode secrets), construction.md (complete runnable files; error handling at every integration boundary; tests cover happy path + ≥2 error/edge cases; never tautological), the 80% line-coverage floor (never lowered).

## What this Unit is

The one Flutter binary (iOS + Android) over the six backend Units. Twelve screens from `functional-spec.md`; six `services/*.dart` files, one per contract; three root-level notifiers (`AuthState`, `LocalizationController`, `DeviceIdentityState`); English + Hindi; Crashlytics; FCM push for reminders. First release ships Screens 1–7 and 12; Screens 8–11 (Donate, My Donations, PDF Library, Admin PDF Library) are built now but hidden behind a compile-time feature flag until donation-unit's aggregator account exists (donations) and the builder chooses to surface the library (pdf) — the same "thin, flagged-off" stance the backend took for donations.

## Layout decision (approval-visible)

- The Flutter project root **is the workspace root** (`pubspec.yaml`, `lib/`, `test/`, `android/`, `ios/` beside the existing `amplify/`, `package.json`, `README.md`) — Amplify Gen2's standard Flutter layout, and the layout `cicd-pipeline.md` assumes (`lib/amplify_outputs.dart`).
- Package name `sarovar_jinalaya`; Android application ID and iOS bundle ID **`in.sarovarjinalaya.app`** (the "production application ID" the infra spec refers to but does not name — change it here before the Firebase apps are registered if a different one is wanted).
- `flutter create . --project-name sarovar_jinalaya --org in.sarovarjinalaya --platforms android,ios` scaffolds the platform folders; existing files (`README.md`, `.gitignore`) are never overwritten — Flutter's ignore entries are merged into the existing `.gitignore` by hand, plus `lib/amplify_outputs.dart`, `android/key.properties`, `*.jks`, `*.keystore`, `ios/Runner/GoogleService-Info.plist` is NOT ignored (committed per the infra spec, once it exists).
- Toolchain on this machine: Flutter 3.47.4 (stable) is installed; the Android SDK, Xcode and CocoaPods are **not**. `flutter analyze` and `flutter test` run on the host without them; `flutter build`/device runs and the `integration_test/` suite need them and are out of this pass (Step 12 documents the one-time setup).

## Dependencies (pubspec.yaml)

Runtime: `amplify_flutter`, `amplify_auth_cognito`, `amplify_api` (tech-stack-decisions.md); `firebase_core`, `firebase_crashlytics`, `firebase_messaging` (NFR-CRASH.1; FCM token + permission for Contract 9); `shared_preferences` (language override only — a non-sensitive preference, security-design.md); `url_launcher` (open a PDF pre-signed URL / the aggregator checkout URL externally); `http` (the direct-to-S3 PUT for Contract 6 uploads, `Content-Type: application/pdf`); `file_picker` (admin picks a PDF); `intl` (number/date formatting). Dev: `flutter_test`, `flutter_lints`, `integration_test`.
Not added: `amplify_storage_s3` — tech-stack-decisions.md lists it, but Contract 6 moves bytes only through pre-signed URLs; the app never calls Amplify Storage, so the package would be an unused dependency (recorded deviation). `table_calendar` or similar — `CalendarView` is written in-house (a month grid is ~150 lines and fully testable).

## Architecture rules the developer follows

1. **Amplify boundary**: exactly one file imports `package:amplify_api` / `package:amplify_flutter` for data — `lib/services/amplify_gateway.dart` (`AmplifyGateway implements ApiGateway`: `configure()`, `query/mutate(document, variables, authMode)`, `fetchSession()`, `signInWithGoogle()`, `signOut()`, `onAuthEvent`). Every other `services/*.dart` file depends on the small `ApiGateway`/`AuthGateway` interfaces (`lib/services/gateways.dart`) so it is unit-testable with a fake; screens depend on services by constructor injection; **no screen or widget imports `package:amplify_*`** (project.md Mandated). `amplify_auth_cognito` is imported by `amplify_gateway.dart` only.
2. **Raw GraphQL documents**, one per operation, written by hand from `amplify/data/resource.ts` (no model codegen): `listPosts`, `listAllPostsForAdmin`, `getPost(id)`, `createPost(input)`, `updatePost(id,input)`, `deletePost(id)`; `submitSuggestion(text)`, `myPastSuggestions`, `allSuggestions`; `initiateDonation(amount,donationType,frequency)`, `myDonations`, `cancelDonation(id)`; `listDocuments(category)`, `getDocumentDownloadUrl(id)`, `createDocumentUploadUrl(title,category)`, `confirmDocumentUpload(s3Key,title,category)`, `deleteDocument(id)`; `myReminders`, `registerDeviceToken(pushToken,platform)`, `setRemindersEnabled(enabled)`, `snoozeReminder(id)`, `cancelReminder(id)`. Selection sets = exactly the contract's fields.
3. **Authorization mode per call** (the carried obligation from the backend passes): `listPosts`, `listDocuments`, `getDocumentDownloadUrl` → `identityPool` (IAM) when signed out, `userPool` when signed in; every Contract 9 operation → **always `identityPool`** (guest identity, FR7.8); everything else → `userPool`.
4. **Identity note (disclosed, not solved here)**: Amplify's Identity Pool issues a *different* identity id once a user signs in, so Contract 9's "this device's reminders" are keyed per sign-in state. The app re-syncs (`myReminders`, BR7.1 backfill) whenever `DeviceIdentityState.identityId` changes, so reminders keep working across sign-in/out; whether the earlier identity's already-scheduled reminders produce a duplicate push is a sandbox-integration finding for Build and Test (no cancel-all logic is added now — the builder's simplicity preference for the reminder module).
5. **Client-side gating is UX only** (NFR-AUTHZ.2): `AppShell` hides/redirects by `AuthState.isSignedIn`/`isAdmin`; every screen's error state renders the server's refusal plainly.
6. **Crashlytics wiring is explicit** (security-design.md): `main()` sets `FlutterError.onError = FirebaseCrashlytics.instance.recordFlutterFatalError` and `PlatformDispatcher.instance.onError` → `recordError(fatal: true)`, after `Firebase.initializeApp()` — all inside a guard so an unconfigured Firebase (no `google-services.json` yet) logs once and never blocks startup; `setCrashlyticsCollectionEnabled(!kDebugMode)`.
7. **Startup order** (performance-design.md): blocking = `Amplify.configure` + in-memory `fetchAuthSession` → `AuthState`; async after first frame = guest identity resolution, Firebase init, nothing else. Notification permission is requested only on first Calendar visit.
8. **Personal data**: no crash-report custom keys; log lines never include suggestion text, amounts, emails or push tokens.
9. **Every interactive control carries a `Key` (`ValueKey('feed.retry')` style)** for widget tests and future automation (stage rule: test ids on interactive elements).
10. `dart format` + `flutter analyze` (flutter_lints) clean; `data-testid`-equivalent keys as above.

## Testing Contract

```json
{
  "version": 1,
  "methodology": "test-after",
  "source": "team",
  "ordering": "implement each applicable testable layer, then write and",
  "scope": "temple-mobile-app",
  "test_strategy": "standard",
  "project_type": "greenfield",
  "applicable_notes": [
    {
      "layer": "org",
      "text": "We treat tests as a first-class deliverable in every Bolt. The specific\nmethodology (TDD, BDD, ATDD, or classic test-after) is affirmed at\npractices-discovery and recorded in `team.md` under this heading with explicit\n`Methodology` and `Ordering` fields; Code Generation resolves those fields\nindependently from coverage, tooling, and scope notes.\n\nWhen no posture has been affirmed, our default per scope is:\n- **Methodology**: test-after\n- **Ordering**: implement each applicable testable layer, then write and run\n  that layer's tests.\n- `mvp`, `enterprise`, `feature`, `infra`, `classic` add an 80% line-coverage\n  floor and CI execution before merge.\n- `bugfix`, `security-patch` add a targeted regression for the specific\n  bug/vulnerability and require the existing suite to remain green.\n- `express` uses the Minimal strategy: requirement-driven unit tests (one per\n  requirement, with a happy-path floor per component); existing tests remain\n  green.\n- `poc`, `refactor`, `workshop` add no extra new-test floor and require the\n  existing suite to remain green.\n\nThe active `Test Strategy` still applies in every scope and determines test\nvolume/types. Scope floors are additive; they never reduce or replace the\nselected strategy.\n\nBuild and Test verifies defined coverage floors and affirmed quality targets;\nthey may not be weakened to make a step pass.\n\nAffirm a stricter posture in `team.md` if the team commits to one."
    },
    {
      "layer": "team",
      "text": "- **Methodology**: test-after\n- **Ordering**: implement each applicable testable layer, then write and\n  run that layer's tests, with the walking-skeleton Bolt held to a lighter\n  smoke-level bar across the board — including the admin allowlist gate —\n  and the standard 80% line-coverage floor applying from the second Bolt\n  onward.\n\nAffirmed specifics (Q4-Q7):\n\n- **Test-after, not TDD/BDD** (Q4): writing code first, then its tests,\n  fits a builder who doesn't yet have confidence in the API/widget shapes\n  of either Flutter or Amplify Gen2 — test-first would compound that\n  learning-curve risk.\n- **Walking-skeleton Bolt test rigor: light smoke-level check everywhere in\n  the skeleton, including the admin allowlist gate** (Q5 — Answer A). The\n  quality agent's review recommended a stricter option for the admin gate\n  specifically (a real pass/fail assertion proving non-admins are\n  rejected, since it's a security boundary), but the human deliberately\n  chose the lighter, uniform smoke-level bar for the entire skeleton\n  instead. This is recorded as the builder's considered choice, not an\n  oversight — a proper test for the admin gate's server-side enforcement\n  is expected to land with the fuller coverage floor from the second Bolt\n  onward, once the architecture is proven end-to-end.\n- **Coverage target beyond the skeleton: the org default's 80%\n  line-coverage floor, adopted as-is** (Q6). The quality agent flagged\n  that the 80% floor's applicability was ambiguous under the custom\n  `temple-mobile-app` scope signal (it isn't in the org default's named\n  scope list); the builder resolved this directly by choosing to adopt the\n  80% target rather than a looser or undefined bar.\n- **CI + backend test framework: GitHub Actions with Jest** (Q7). A single\n  GitHub Actions workflow runs on every push/PR to `main`: `flutter\n  analyze` + `flutter test --coverage` on the Flutter app side, and\n  ESLint/`tsc --noEmit` + Jest on the Amplify Gen2/TypeScript backend\n  side (Lambda handlers, AppSync resolver logic) — blocking merge on\n  failure. This is the project's only enforcement mechanism for test\n  quality, since there is no second reviewer to catch a skipped or\n  weakened test. If Amplify Hosting's own build pipeline is used for\n  deploys, a test step must be added to `amplify.yml` deliberately —\n  Amplify Hosting does not run app-level tests by default.\n- Test-type mix (carried forward from the quality agent's contribution,\n  not separately re-asked, since it elaborates rather than contradicts the\n  affirmed methodology): Flutter unit tests for business logic,\n  `flutter_test` widget tests for UI, and `integration_test` for\n  higher-risk end-to-end flows (Cognito/Google-federation sign-in, the\n  admin allowlist gate, and later the donation flow) — integration-level\n  coverage matters more than usual here because a unit test that mocks the\n  Amplify client can pass while the real integration is still broken. On\n  the backend, Jest unit tests for Lambda handlers and schema/contract\n  checks against the AppSync GraphQL schema, exercised against Amplify\n  Gen2's local sandbox (`ampx sandbox`) rather than a live deployed\n  environment."
    }
  ],
  "obligations": {
    "strategy": "standard",
    "strategy_volume": [
      "Five to eight tests per component.",
      "Unit tests plus integration tests for key boundaries.",
      "Add E2E, performance, or security tests when requirements demand them."
    ],
    "scope_floor": [
      "Keep the existing test suite green.",
      "This scope adds no extra new-test floor beyond the selected test strategy."
    ],
    "combination_rule": "Apply every selected-strategy obligation and every scope-floor obligation; neither replaces the other, and a targeted scope regression may add the narrowest necessary test type beyond the strategy default."
  },
  "plan_profile": {
    "methodology": "test-after",
    "runner_step": "Bootstrap the minimal test runner/configuration and record the exact unit-scoped command.",
    "runner_ready_before_first_test": true,
    "testable_layers": [
      "Data model / database behavior",
      "Repository / data access",
      "Business logic",
      "API / endpoint",
      "Frontend behavior"
    ],
    "steps": [
      "Project structure and production configuration skeleton.",
      "Bootstrap the minimal test runner/configuration and record the exact unit-scoped command.",
      "Data model / database behavior - implement.",
      "Data model / database behavior - write and run its tests after implementation.",
      "Repository / data access - implement.",
      "Repository / data access - write and run its tests after implementation.",
      "Business logic - implement.",
      "Business logic - write and run its tests after implementation.",
      "API / endpoint - implement.",
      "API / endpoint - write and run its tests after implementation.",
      "Frontend behavior - implement.",
      "Frontend behavior - write and run its tests after implementation.",
      "Environment/build configuration.",
      "Documentation and traceability."
    ]
  },
  "input_sha256": "sha256:817e454c78e3d1ec2c498999a8752124a36e6c73860f504900f17dbf0ec17f6a",
  "contract_sha256": "sha256:322e5d191e27095d9fb5ca26b5cd076c3c99c52b68d46d1e676c77d2a10d3881"
}
```

The contract's `plan_profile.steps` map onto this Unit's layers as: data model = `lib/models/`; repository/data access = `lib/services/` (the gateway + six contract wrappers); business logic = `lib/state/` + `lib/utils/`; API/endpoint = not applicable server-side (this Unit exposes no API — its "endpoint" layer is the `services/` boundary already covered); frontend behavior = `lib/screens/` + `lib/widgets/`.

## Steps

### Step 1 — Project structure and production configuration skeleton (traces: NFR6.1, team.md Code Style)

- [x] 1.1 `flutter create . --project-name sarovar_jinalaya --org in.sarovarjinalaya --platforms android,ios`; delete the generated `test/widget_test.dart` and the counter `lib/main.dart` body; keep `analysis_options.yaml` (`include: package:flutter_lints/flutter.yaml`).
- [x] 1.2 `pubspec.yaml`: name, description, `version: 0.1.0+1`, the dependencies above; `flutter: uses-material-design: true`.
- [x] 1.3 Merge Flutter's ignore entries into the existing `.gitignore` (`/build/`, `.dart_tool/`, `.flutter-plugins*`, `*.iml`, `.idea/`, platform build dirs) plus `lib/amplify_outputs.dart`, `android/key.properties`, `*.jks`, `*.keystore`, `coverage/`.
- [x] 1.4 Layer-first folders: `lib/models/`, `lib/screens/`, `lib/widgets/`, `lib/services/`, `lib/state/`, `lib/utils/`, `lib/l10n/` (string tables); `test/` mirrors `lib/`; `integration_test/`.
- [x] 1.5 Platform config: Android `minSdk 24` (Amplify), `applicationId "in.sarovarjinalaya.app"`, the hosted-UI intent-filter for scheme `sarovarjinalaya` on `HostedUIRedirectActivity` (`sarovarjinalaya://callback/`, `sarovarjinalaya://signout/`), `POST_NOTIFICATIONS`/`INTERNET` permissions, `key.properties`-driven release signing in `build.gradle.kts` guarded so a missing file falls back to debug signing; iOS `Info.plist` `CFBundleURLSchemes: [sarovarjinalaya]`, `UIBackgroundModes: [remote-notification]`, bundle id `in.sarovarjinalaya.app`. Firebase plugin wiring (`com.google.gms.google-services`) is declared but must tolerate the absence of `google-services.json` until the Firebase project exists — see 12.2.
- [x] 1.6 Write a local stub `lib/amplify_outputs.dart` (`const amplifyConfig = '{}';`) exactly as CI will (`cicd-pipeline.md`), git-ignored; `tool/stub_amplify_outputs.sh` creates it when absent.

### Step 2 — Test runner ready (traces: team.md Q7, coverage floor)

- [x] 2.1 `flutter pub get`; verify `flutter test test/` runs (`--reporter compact`) — the exact unit-scoped command recorded in `unit-test-instructions.md`.
- [x] 2.2 `tool/check_coverage.dart`: parses `coverage/lcov.info`, prints line coverage, exits non-zero below `--min 80` (default 80). Wired as the CI coverage-floor step and documented. Never lowered.
- [x] 2.3 `test/support/`: `fake_gateways.dart` (`FakeApiGateway` recording document/variables/authMode and returning scripted JSON or throwing; `FakeAuthGateway` with scriptable session/sign-in outcomes), `fake_services.dart` (one fake per service for widget tests), `fixtures.dart` (`aPost()`, `aSuggestion()`, `aDonation()`, `aDocument()`, `aReminder()`), `pump_app.dart` (wraps a screen in `MaterialApp` + `LocalizationController`).

### Step 3 — Data model layer (traces: Contracts 3, 4, 5, 6, 9)

- [x] 3.1 `lib/models/post.dart` (`Post`, `PostType` with `fromGraphQl`/unknown-value tolerance, `isEvent`), `suggestion.dart`, `donation.dart` (`Donation`, `DonationType`, `DonationFrequency`, `DonationStatus`, `DonationInitiation`, `canCancel` = SUCCEEDED && RECURRING), `document.dart` (`Document`, `DocumentCategory`, `DocumentUploadTarget`), `reminder.dart` (`Reminder`, `ReminderStatus`, `DeviceToken`, `DevicePlatform`, `isActive` = SCHEDULED|SNOOZED). All immutable, `fromJson`/`toJson`, `==`/`hashCode`, AWSDateTime parsed as UTC.
- [x] 3.2 `lib/utils/screen_state.dart`: sealed `ScreenState<T>` = `Loading | Loaded(T) | Empty | Error(message)` with `when()`.

### Step 4 — Data model tests

- [x] 4.1 `test/models/models_test.dart` (8): each `fromJson` round-trip; enum parsing incl. `DONATION_CALL_OUT`; unknown enum value → tolerant fallback, never a throw (contract-summary.md additive rule); `Donation.canCancel`; `Reminder.isActive`; `Post.isEvent`.
- [x] 4.2 `test/utils/screen_state_test.dart` (4): `when` dispatch for all four states; `Loaded([])` is not `Empty` (screens decide emptiness explicitly).

### Step 5 — Repository / data-access layer: services (traces: NFR6.1, NFR-AUTHZ.2, contracts)

- [x] 5.1 `lib/services/gateways.dart`: `ApiGateway` (`Future<Map<String,dynamic>> query/mutate({document, variables, AuthMode authMode})`, `class ApiException` with the server's first GraphQL error message), `AuthGateway` (`fetchSession()` → `SessionInfo{isSignedIn, sub, email, groups, identityId}`, `signInWithGoogle()`, `signOut()`, `Stream<AuthEvent> events`), `AuthMode { userPool, identityPool }`.
- [x] 5.2 `lib/services/amplify_gateway.dart` — the ONLY Amplify data/auth import: plugins `AmplifyAuthCognito` + `AmplifyAPI`, `configure(amplifyConfig)`, GraphQL via `GraphQLRequest<String>` with `APIAuthorizationType.userPools`/`.iam`, response `errors` → `ApiException`, `signInWithWebUI(provider: AuthProvider.google)`, `fetchAuthSession()` → `CognitoAuthSession` (`identityIdResult`, id-token `cognito:groups`), `Amplify.Hub` auth events → `events`.
- [x] 5.3 `lib/services/auth_service.dart` (Contracts 1, 2): `currentSession()`, `signInWithGoogle()`, `signOut()`, `isAdmin(groups)`; errors mapped to plain-language `AuthFailure` (cancelled vs failed).
- [x] 5.4 `lib/services/feed_service.dart` (Contract 3): `listPosts({required bool signedIn})` (auth mode rule 3), `listAllForAdmin()`, `getPost(id)`, `create(input)`, `update(id, input)`, `delete(id)`; documents in `lib/services/documents/feed_documents.dart`.
- [x] 5.5 `lib/services/suggestion_service.dart` (Contract 4): `submit(text)`, `myPast()`, `allSuggestions()`.
- [x] 5.6 `lib/services/donation_service.dart` (Contract 5): `initiate(amount, type, frequency)` → `DonationInitiation`, `myDonations()`, `cancel(id)`; `frequency` omitted from variables for ONE_TIME.
- [x] 5.7 `lib/services/pdf_service.dart` (Contract 6): `list({category, signedIn})`, `downloadUrl(id, {signedIn})`, `createUploadUrl(title, category)`, `uploadBytes(uploadUrl, bytes)` (HTTP PUT, `Content-Type: application/pdf`, injected `http.Client`), `confirmUpload(s3Key, title, category)`, `delete(id)`.
- [x] 5.8 `lib/services/reminder_service.dart` (Contract 9 + device identity + push): `resolveIdentity()` (via `AuthGateway.fetchSession().identityId`), `requestPermissionAndToken()` (injected `PushGateway` interface wrapping `FirebaseMessaging`: `requestPermission()`, `getToken()`, `onTokenRefresh`, `platform`), `register(pushToken, platform)`, `myReminders()`, `setEnabled(bool)`, `snooze(id)`, `cancel(id)` — all Contract 9 calls with `AuthMode.identityPool`; errors → plain-language `ReminderFailure` (snooze cutoff passed / not yours / network).
- [x] 5.9 `lib/services/push_gateway.dart` (`FirebasePushGateway`, the only `firebase_messaging` import) with `onMessageOpenedApp`/`getInitialMessage` exposing `postId` from the FCM `data` payload.
- [x] 5.10 `lib/services/app_bootstrap.dart`: `configureAmplify(gateway, amplifyConfig)` and `initFirebase()` (guarded; returns `FirebaseAvailability.unavailable` when `google-services.json`/`GoogleService-Info.plist` are absent, logging once).

### Step 6 — Service tests (fake gateways; no Amplify, no network)

- [x] 6.1 `test/services/auth_service_test.dart` (6): session mapping incl. `isAdmin` from `cognito:groups`; signed-out session; sign-in success; sign-in cancelled → `AuthFailure.cancelled`; sign-in error → plain message, no raw OAuth text; sign-out failure surfaced.
- [x] 6.2 `test/services/feed_service_test.dart` (8): `listPosts` uses `identityPool` when signed out and `userPool` when signed in; selection set = Contract 3 fields; admin ops use `userPool`; `createPost` variable shape `{input:{type,title,description,dateTime}}`; `updatePost` sends only provided fields; `deletePost`; GraphQL error → `ApiException` with the server message; malformed JSON → typed failure.
- [x] 6.3 `test/services/suggestion_service_test.dart` (5): submit variables; 300-word/5-per-day server refusal surfaced verbatim as plain text; `myPast` newest-first passthrough; `allSuggestions`; network error.
- [x] 6.4 `test/services/donation_service_test.dart` (5): ONE_TIME omits `frequency`; RECURRING includes it; `DonationInitiation` parsing; `cancel`; server refusal (not cancellable) surfaced.
- [x] 6.5 `test/services/pdf_service_test.dart` (7): `list` with and without category; auth-mode rule for public reads; `downloadUrl` returns the URL string; `uploadBytes` PUTs with `application/pdf` and fails on non-2xx; `confirmUpload` re-supplies title/category; `delete` returns the id.
- [x] 6.6 `test/services/reminder_service_test.dart` (8): every op uses `identityPool`; `register` variables; `setEnabled`; `myReminders` parsing; permission denied → no register call and `permissionGranted=false`; token refresh re-registers; `snooze` cutoff refusal → `ReminderFailure.cutoffPassed`; identity resolution reads `identityId` even when signed out.
- [x] 6.7 `test/services/app_bootstrap_test.dart` (3): Firebase unavailable path is non-fatal; Amplify configure called once; double-configure guarded.

### Step 7 — Business logic: state + utils (traces: FR4.1, NFR-PERF.1, NFR-AUTHZ.2)

- [x] 7.1 `lib/state/auth_state.dart` (`ChangeNotifier`: `isSignedIn`, `sub`, `email`, `isAdmin`, `refresh()`, `signIn()`, `signOut()`; subscribes to `AuthGateway.events`).
- [x] 7.2 `lib/state/localization_controller.dart` + `lib/l10n/app_strings.dart` (`AppStrings.en`, `AppStrings.hi` maps; `t(key)` falls back to English, never a raw key; initial language from device locale, override persisted via `shared_preferences` — injected `PreferencesStore` interface).
- [x] 7.3 `lib/state/device_identity_state.dart` (`identityId`, `permissionGranted`, `remindersEnabled`, `ensureResolved()`, `ensureRegistered()`; notifies on identity change so Calendar re-syncs — rule 4).
- [x] 7.4 `lib/utils/ist_time.dart` (fixed +05:30 formatting for event dates/times and "9:00 AM IST day before" copy), `lib/utils/word_count.dart` (whitespace-run count, mirrors suggestion-unit BR3.1), `lib/utils/feature_flags.dart` (`const donationsEnabled = false; const pdfLibraryEnabled = false;` — compile-time, `--dart-define`-overridable).

### Step 8 — Business-logic tests

- [x] 8.1 `test/state/auth_state_test.dart` (6): initial signed-out; refresh maps session; admin derived from groups; sign-in updates + notifies; sign-out clears; gateway event triggers refresh.
- [x] 8.2 `test/state/localization_controller_test.dart` (6): device locale `hi` → Hindi; other → English; override persisted and restored; missing Hindi key falls back to English; `t()` never returns a raw key; language change notifies.
- [x] 8.3 `test/state/device_identity_state_test.dart` (5): resolves identity once; permission denied path; registration failure retried on next call, no throw; identity change notifies; toggle round-trip.
- [x] 8.4 `test/utils/ist_time_test.dart` (5) incl. IST-midnight rollover; `test/utils/word_count_test.dart` (4); `test/utils/feature_flags_test.dart` (2).

### Step 9 — Frontend: shared widgets, screens, shell (traces: FR1.3, FR2.x, FR3.x, FR4.1, FR7.x, functional-spec.md workflows)

- [x] 9.1 `lib/widgets/`: `ErrorState` (message + retry), `EmptyState`, `LoadingSkeleton`, `ConfirmDestructiveActionDialog`, `BottomNavBar` (4 tabs; 6 when flags on), `PostCard`, `SuggestionListItem`, `DonationListItem`, `DocumentListItem`, `CalendarView` (month grid, event markers, date tap), `ReminderStatusBadge`, `RemindersToggle`, `LanguageToggle`.
- [x] 9.2 `lib/screens/feed_screen.dart` (Screen 1: 4 states, retry, Sign In / Account action in the app bar).
- [x] 9.3 `sign_in_screen.dart` (Screen 2: Google button, cancelled/error copy, returns to the intended route).
- [x] 9.4 `submit_suggestion_screen.dart` (Screen 3: live word count, advisory warning ≥ 280 words, never blocks submit; inline success; error preserves input).
- [x] 9.5 `my_suggestions_screen.dart` (Screen 4), `account_screen.dart` (Screen 5: identity, `LanguageToggle`, `RemindersToggle`, sign out with inline error).
- [x] 9.6 `admin/admin_post_list_screen.dart` + `admin/post_form_screen.dart` (Screen 6: list incl. aged-out, create/edit via `getPost`, confirm-then-delete, "admin access required" copy on server refusal).
- [x] 9.7 `admin/admin_suggestions_screen.dart` (Screen 7, read-only).
- [x] 9.8 `donate_screen.dart`, `my_donations_screen.dart` (Screens 8–9: amount > 0 guard, `FrequencyPicker` only for RECURRING, hand-off via `url_launcher` to `checkoutUrl`, cancel with confirm dialog) — behind `donationsEnabled`.
- [x] 9.9 `pdf_library_screen.dart`, `admin/admin_pdf_library_screen.dart` (Screens 10–11: category chips, open pre-signed URL externally, pick-PDF → upload → confirm, confirm-then-delete) — behind `pdfLibraryEnabled`.
- [x] 9.10 `calendar_screen.dart` (Screen 12): `listPosts` filtered to EVENT with future `dateTime`, silent identity resolution, first-visit permission prompt, `myReminders` sync, day list with `ReminderStatusBadge`, Snooze (only while SCHEDULED/FIRED per BR7.3 copy), Cancel (confirm dialog), permission-denied explanation, deep-link to a `postId` from a push tap.
- [x] 9.11 `lib/app.dart` (`SarovarJinalayaApp`: `MaterialApp` theme, routes, `AppShell` with `BottomNavBar`, gating: signed-in-only routes redirect to Sign In and return; Admin entry only when `isAdmin`; flagged tabs hidden) and `lib/main.dart` (startup order per rule 7; Crashlytics handlers per rule 6).

### Step 10 — Frontend tests (`flutter_test` widget tests with fake services)

- [x] 10.1 `test/widgets/shared_widgets_test.dart` (7): `ErrorState` retry tap; `EmptyState`; `LoadingSkeleton`; confirm dialog cancel vs confirm; `BottomNavBar` 4 vs 6 tabs by flags; `CalendarView` marks event dates and reports taps; `ReminderStatusBadge` label per status.
- [x] 10.2 `test/screens/feed_screen_test.dart` (5): loading → loaded; empty; error + retry re-calls; signed-out uses guest listing; post card shows type badge and IST date.
- [x] 10.3 `test/screens/sign_in_screen_test.dart` (4): tap → service called; cancelled copy; error copy has no raw OAuth text; success pops to intended route.
- [x] 10.4 `test/screens/submit_suggestion_screen_test.dart` (5): word count updates; warning near limit but Submit stays enabled; success inline; server refusal preserves input; network error retry.
- [x] 10.5 `test/screens/my_suggestions_screen_test.dart` (4); `test/screens/account_screen_test.dart` (5: identity shown, language toggle switches strings, reminders toggle calls service, sign-out, sign-out error inline).
- [x] 10.6 `test/screens/admin_post_list_screen_test.dart` (6): list incl. aged-out; New Post → create; Edit loads via `getPost`; delete requires confirm; server "admin" refusal copy; empty state.
- [x] 10.7 `test/screens/admin_suggestions_screen_test.dart` (4); `test/screens/donate_screen_test.dart` (5: positive-amount guard, frequency picker visibility, initiate → launch URL, error); `test/screens/my_donations_screen_test.dart` (5: statuses, Cancel only when SUCCEEDED+RECURRING, confirm, refusal); `test/screens/pdf_library_screen_test.dart` (5); `test/screens/admin_pdf_library_screen_test.dart` (5: upload two-step order, non-PDF refusal copy, delete confirm).
- [x] 10.8 `test/screens/calendar_screen_test.dart` (8): only EVENT posts shown; past events excluded; sync waits for identity; permission denied explanation; snooze → service; cutoff refusal inline; cancel confirm → service; deep-link selects the post's date.
- [x] 10.9 `test/app_test.dart` (6): signed-out nav has no Admin entry; gated route redirects to Sign In and returns after sign-in; admin sees Admin entry; flagged tabs hidden by default; Hindi locale renders Hindi title; root notifiers injected once.
- [x] 10.10 `flutter test --coverage test/` green; `dart run tool/check_coverage.dart --min 80` passes; `flutter analyze` and `dart format --set-exit-if-changed .` clean.

### Step 11 — Environment/build configuration

- [x] 11.1 `integration_test/app_test.dart`: the sandbox-backed flows from `cicd-pipeline.md` (Google sign-in, admin gate refusal, Calendar → guest identity → register → reminders → snooze → cancel) written and compiling, tagged/documented as **local-only** (needs `ampx sandbox` outputs + a device); not run in CI and not run in this pass.
- [x] 11.2 Android release signing via `android/key.properties` (absent → debug signing; never committed); `android/app/build.gradle.kts` minSdk 24, `google-services` plugin applied only when `google-services.json` exists.
- [x] 11.3 `tool/stub_amplify_outputs.sh`, `tool/check_coverage.dart` documented; `.gitignore` verified (`git check-ignore lib/amplify_outputs.dart android/key.properties`).

### Step 12 — Documentation and traceability

- [x] 12.1 `README.md`: "Mobile App" section — layout, the `services/`-only Amplify rule, auth-mode-per-call table, identity note (rule 4), feature flags, running locally (`ampx sandbox --outputs-format dart --outputs-out-dir lib`, stub for CI), Firebase one-time setup (`flutterfire configure`, APNs key), Android SDK / Xcode / CocoaPods prerequisites for device runs, release steps summary, the self-review checklist for sign-in/gating changes; Hindi copy flagged for native-speaker review.
- [x] 12.2 Doc comments naming the contract/FR each service and screen realizes.
- [x] 12.3 Write `source-manifest.json` (every path created or modified, with trailing-`/` directory claims for `android/`, `ios/`, `lib/`, `test/`, `integration_test/`, `tool/`).
- [x] 12.4 The conductor writes `code-summary.md` and `traceability.json`.

## Known deviations (declared up front)

| From | Deviation | Why |
|---|---|---|
| tech-stack-decisions.md | `amplify_storage_s3` not added | Contract 6 uses pre-signed URLs; nothing would call Amplify Storage |
| frontend-components.md | `lib/state/` folder added to the layer-first list | Root notifiers are neither models nor screens; team.md's list is a baseline, not exhaustive |
| infrastructure-specification.md | Application/bundle ID set to `in.sarovarjinalaya.app` | The spec names none; needed before Firebase registration |
| functional-spec.md Screens 8–11 | Built but compile-time flagged off | donation-unit is a thin flagged build; no aggregator account yet |
| reminder-unit design | Identity switch on sign-in/out re-syncs rather than migrates reminders | Rule 4; verified at sandbox integration |
