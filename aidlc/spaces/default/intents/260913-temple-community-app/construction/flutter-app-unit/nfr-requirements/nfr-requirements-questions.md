# NFR Requirements — Questions (flutter-app-unit)

## Sources

- [scope] Workflow-selected scope: `temple-mobile-app`.

Consumed upstream artifacts:
- `aidlc/spaces/default/intents/260913-temple-community-app/construction/flutter-app-unit/functional-design/functional-spec.md`
- `aidlc/spaces/default/intents/260913-temple-community-app/construction/flutter-app-unit/functional-design/frontend-components.md`
- `aidlc/spaces/default/intents/260913-temple-community-app/inception/requirements-analysis/requirements.md` (NFR1-NFR8, especially NFR7 — accessibility, which this Unit owns)
- `aidlc/spaces/default/intents/260913-temple-community-app/inception/contract-design/contract-summary.md` (all 9 contracts — this Unit is the sole consumer of most of them)

This is a `kind: ui` Unit — per the stage's `produces_kinds` rule, only `performance-requirements.md`, `security-requirements.md`, `tech-stack-decisions.md`, and `traceability.json` are produced here (no separate `scalability-requirements.md`/`reliability-requirements.md`/`observability-requirements.md` — those categories apply only to `service`-kind Units, and this Unit owns no backend data/service of its own).

## Q1. App cold-start (launch) time: how long from tapping the app icon to the first interactive screen (Feed)?

- A. Under 3 seconds on a typical mid-range device — standard Flutter cold-start expectations, distinct from NFR1's 2-second `listPosts` content-load budget (which starts once the app is already running). This includes Flutter engine init, `AuthState`/`DeviceIdentityState` initial resolution, and the first frame render. (Recommended)
- B. A different target — specify
- X. Other (please specify)

[Answer]: A. Under 3 seconds.

## Q2. Offline/poor-connectivity behavior: every screen's functional-spec.md already defines a plain-language error+retry state for a failed network call. Is any offline-first caching (showing stale data while disconnected) needed, or does this project stay with error+retry as the complete offline story?

- A. Error+retry is the complete story — no offline-first caching layer is added at this stage. This is a low-stakes community app where a brief loss of connectivity showing "couldn't load, tap to retry" is acceptable; building an offline cache would add real complexity (cache invalidation, staleness indicators) this project's scale doesn't justify. (Recommended)
- B. Add offline-first caching for at least the Feed screen — specify
- X. Other (please specify)

[Answer]: A. Error+retry is complete.

## Q3. Client-side crash reporting: should the app integrate a crash-reporting tool (e.g. Firebase Crashlytics, free tier) so the solo builder learns about crashes without relying on users to report them?

- A. Yes — add Firebase Crashlytics (or equivalent free-tier tool). For a solo builder with no other visibility into client-side failures once the app is installed on users' phones, this is a low-cost, high-value addition; no PII is sent in crash reports beyond what the tool captures by default (device model, OS version, stack trace). (Recommended)
- B. Skip crash reporting for this release.
- X. Other (please specify)

[Answer]: A. Yes, add Crashlytics.

## Q4. Secure credential storage: confirm the app relies entirely on Amplify Auth's own default platform-secure storage (iOS Keychain, Android Keystore/EncryptedSharedPreferences) for the Cognito session, with no custom token-storage implementation?

- A. Confirmed — Amplify Auth's default secure storage is used as-is; this Unit never implements its own token persistence, encryption, or storage mechanism. (Recommended)
- B. Something different — specify
- X. Other (please specify)

[Answer]: A. Confirmed.

## Consolidated Summary Confirmation

- App cold-start target: under 3 seconds to first interactive screen.
- No offline-first caching — error+retry (already specified per-screen) is the complete offline story.
- Firebase Crashlytics (or equivalent) is added for client-side crash visibility.
- Amplify Auth's default platform-secure storage is used as-is for the Cognito session; no custom implementation.

Does this all look correct before I generate the artifacts?

- Looks correct
- Request changes

[Answer]: Looks correct
