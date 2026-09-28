# Unit Test Instructions — flutter-app-unit

## Test framework and setup

- **Framework**: `flutter_test` (unit + widget tests) on Flutter 3.47.4 stable; `integration_test` for the local-only device suite. Lints: `flutter_lints`.
- **Install**: `flutter pub get` after plan Step 1.2.
- No AWS credentials, no Firebase project, no `ampx sandbox`, no device, no network: every service takes its `ApiGateway`/`AuthGateway`/`PushGateway`/`http.Client`/`PreferencesStore` by injection, and every screen takes its services and root notifiers by constructor injection. The Android SDK and Xcode are not needed for anything in this file.

## How to run THIS UNIT's tests

Exact, unit-scoped command (the Flutter test tree only — never the backend's Jest suite):

```bash
flutter test test/
```

Runnable at plan Step 2.1. With coverage and the floor check:

```bash
flutter test --coverage test/
dart run tool/check_coverage.dart --min 80
```

`check_coverage.dart` reads `coverage/lcov.info` and exits non-zero below 80% lines. The floor is never lowered; a shortfall is surfaced, not hidden. Also run before hand-back: `flutter analyze` and `dart format --set-exit-if-changed .`.

The integration suite is **not** part of this pass and not part of CI: `flutter test integration_test/` needs a running `ampx sandbox` (outputs written to `lib/amplify_outputs.dart`) and a connected device/emulator, which this machine does not yet have (no Android SDK / Xcode).

## Test files and cases (≈ 170 tests across 30 files)

| File | Tests | Covers |
|---|---|---|
| `test/models/models_test.dart` | 8 | `fromJson` round-trips for all six models; enum parsing incl. `DONATION_CALL_OUT`; unknown enum tolerance; `Donation.canCancel`; `Reminder.isActive`; `Post.isEvent` |
| `test/utils/screen_state_test.dart` | 4 | `when` dispatch; `Loaded([])` ≠ `Empty` |
| `test/services/auth_service_test.dart` | 6 | Session mapping, admin from `cognito:groups`, sign-in success/cancelled/error (no raw OAuth text), sign-out failure |
| `test/services/feed_service_test.dart` | 8 | Auth mode: `identityPool` signed-out / `userPool` signed-in for `listPosts`; Contract 3 selection sets; admin ops `userPool`; create/update/delete variables; `ApiException` message; malformed JSON |
| `test/services/suggestion_service_test.dart` | 5 | Submit variables; server refusals verbatim; `myPast`; `allSuggestions`; network error |
| `test/services/donation_service_test.dart` | 5 | ONE_TIME omits `frequency`; RECURRING includes; `DonationInitiation` parse; cancel; refusal |
| `test/services/pdf_service_test.dart` | 7 | List with/without category; public auth-mode rule; download URL; PUT with `application/pdf` + non-2xx failure; confirm re-supplies title/category; delete |
| `test/services/reminder_service_test.dart` | 8 | All Contract 9 ops use `identityPool`; register variables; setEnabled; parse; permission denied → no register; token refresh re-registers; snooze cutoff → `ReminderFailure.cutoffPassed`; identity resolved while signed out |
| `test/services/app_bootstrap_test.dart` | 3 | Firebase-unavailable non-fatal; configure once; double-configure guarded |
| `test/state/auth_state_test.dart` | 6 | Initial signed-out; refresh; admin; sign-in notifies; sign-out clears; hub event refresh |
| `test/state/localization_controller_test.dart` | 6 | `hi` locale → Hindi; default English; override persisted/restored; missing key → English; never raw key; notifies |
| `test/state/device_identity_state_test.dart` | 5 | Resolve once; permission denied; registration failure retried silently; identity change notifies; toggle round-trip |
| `test/utils/ist_time_test.dart` | 5 | IST formatting incl. midnight rollover |
| `test/utils/word_count_test.dart` | 4 | Whitespace-run counting, empty, punctuation, Devanagari |
| `test/utils/feature_flags_test.dart` | 2 | Defaults off; nav reflects flags |
| `test/widgets/shared_widgets_test.dart` | 7 | ErrorState retry; EmptyState; LoadingSkeleton; confirm dialog outcomes; BottomNavBar 4/6; CalendarView markers + taps; ReminderStatusBadge |
| `test/screens/feed_screen_test.dart` | 5 | Loading→loaded; empty; error+retry; guest listing when signed out; card content |
| `test/screens/sign_in_screen_test.dart` | 4 | Tap → service; cancelled; error copy; return route |
| `test/screens/submit_suggestion_screen_test.dart` | 5 | Word count; warning never blocks; inline success; refusal preserves input; retry |
| `test/screens/my_suggestions_screen_test.dart` | 4 | Loaded/empty/error/newest-first |
| `test/screens/account_screen_test.dart` | 5 | Identity; language toggle; reminders toggle; sign-out; sign-out error |
| `test/screens/admin_post_list_screen_test.dart` | 6 | List incl. aged-out; create; edit via getPost; delete confirm; admin refusal copy; empty |
| `test/screens/admin_suggestions_screen_test.dart` | 4 | Loaded/empty/error/read-only |
| `test/screens/donate_screen_test.dart` | 5 | Amount guard; frequency picker; initiate → launch; error; cancelled checkout |
| `test/screens/my_donations_screen_test.dart` | 5 | Statuses; Cancel gating; confirm; refusal; empty |
| `test/screens/pdf_library_screen_test.dart` | 5 | Category chips; open URL; empty; error; download-URL failure |
| `test/screens/admin_pdf_library_screen_test.dart` | 5 | Upload two-step order; non-PDF refusal copy; delete confirm; list; error |
| `test/screens/calendar_screen_test.dart` | 8 | EVENT-only; past excluded; waits for identity; permission-denied explanation; snooze; cutoff refusal; cancel confirm; deep-link |
| `test/app_test.dart` | 6 | Signed-out nav; gated redirect + return; admin entry; flagged tabs hidden; Hindi title; notifiers injected once |

Per-component volume (Standard strategy, 5–8 per component) is met for every service, notifier, screen and the shared-widget set; models and small utils carry 2–8 each.

## Expected coverage

- Floor 80% lines over `lib/` (enforced by `tool/check_coverage.dart`). Expected ≥ 85%: the known uncovered lines are `lib/services/amplify_gateway.dart`, `lib/services/push_gateway.dart` and `lib/main.dart` (real Amplify/Firebase bootstraps that cannot run under `flutter test`), and `lib/amplify_outputs.dart` (stub).
- Excluded from collection: `integration_test/`, `tool/`.

## Mocking / stubbing guidance

- **Fakes, not mocking frameworks** (no `mockito`/`mocktail`): `FakeApiGateway` records `(document, variables, authMode)` and returns scripted JSON or throws `ApiException`; `FakeAuthGateway` scripts `SessionInfo` and sign-in outcomes and exposes a `StreamController<AuthEvent>`; `FakePushGateway` scripts permission and token; `FakePreferencesStore` is an in-memory map; `MockClient` from `package:http/testing.dart` for the S3 PUT. Widget tests inject `Fake*Service` classes with call recording so ordering (permission before register; confirm before delete; create-upload-url → PUT → confirm) is assertable.
- Never import `package:amplify_*` or `package:firebase_*` in a test; the gateway files are the only production files that do, and they are not unit-tested.
- Clock injected where time matters (`ist_time`, calendar "past event" filter, snooze cutoff copy); fixed UTC instants around 03:30Z (09:00 IST), 15:30Z (21:00 IST), 18:30Z (IST midnight).
- Localization in widget tests: `pumpApp(child, language: 'en'|'hi')` helper wraps the widget in `MaterialApp` with a `LocalizationController`.

## Test data management

- Fixtures via helpers in `test/support/fixtures.dart` (`aPost({type, dateTime})`, `aSuggestion()`, `aDonation({status, type})`, `aDocument({category})`, `aReminder({status})`, `aSession({signedIn, admin})`); no fixture directory, no golden files, no snapshots.

## Integration tests

`integration_test/app_test.dart` is written in this pass but runs only locally against `ampx sandbox` on a device (Google sign-in through the real hosted UI, admin gate refusal, Calendar → guest identity → device registration → reminders → snooze → cancel). It is the first real run of the Contract 9 identity-pool auth mode and the place the identity-switch question (plan rule 4) gets answered. Prerequisites and command are in the README.
