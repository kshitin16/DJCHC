# NFR Design — Questions (flutter-app-unit)

## Sources

- [scope] Workflow-selected scope: `temple-mobile-app`.

Consumed upstream artifacts:
- `aidlc/spaces/default/intents/260913-temple-community-app/construction/flutter-app-unit/nfr-requirements/performance-requirements.md`
- `aidlc/spaces/default/intents/260913-temple-community-app/construction/flutter-app-unit/nfr-requirements/security-requirements.md`
- `aidlc/spaces/default/intents/260913-temple-community-app/construction/flutter-app-unit/nfr-requirements/tech-stack-decisions.md`
- `aidlc/spaces/default/intents/260913-temple-community-app/construction/flutter-app-unit/functional-design/functional-spec.md`
- `aidlc/spaces/default/intents/260913-temple-community-app/construction/flutter-app-unit/functional-design/frontend-components.md`
- `aidlc/spaces/default/intents/260913-temple-community-app/inception/contract-design/contract-summary.md`

This Unit is `kind: ui` — only `performance-design`, `security-design`, and `logical-components` apply (no `scalability-design`/`reliability-design`/`observability-design`; this Unit has no server-side scaling, resilience, or telemetry surface of its own). NFR Requirements and frontend-components.md already settled most decisions (no offline caching, Crashlytics for crash reporting, Amplify Auth's default secure storage); what remains is genuinely a design question.

## Q1. Startup sequencing for NFR-PERF.1 (cold start < 3s p95): frontend-components.md says `DeviceIdentityState` is resolved "silently at app start (or lazily on first Calendar visit)" — an unresolved either/or. Should device-guest-identity resolution and Crashlytics initialization block the first frame, or run asynchronously after it?

- A. Async, non-blocking — `AuthState` (already-cached Amplify Auth session, in-memory JWT decode) is the only thing resolved before the first frame; `DeviceIdentityState` (guest identity + push registration) and Crashlytics both initialize in the background after the first frame renders, and only block when Calendar is first visited (device identity) if not already resolved. This protects the 3s cold-start budget from two dependencies (a guest identity-pool call, a crash-reporting SDK init) that have nothing to do with rendering the Feed screen. (Recommended)
- B. Block the first frame on device-identity + Crashlytics init — specify why
- X. Other (please specify)

[Answer]: A. Async, non-blocking.

## Q2. Screen-transition responsiveness (NFR-PERF.2, < 300ms to a loading/skeleton state): is immediately rendering `LoadingSkeleton`/`ScreenState.Loading` on navigation (per frontend-components.md's existing per-screen state pattern), with the actual backend call proceeding async, sufficient design, or does hitting 300ms need an additional technique (e.g. pre-building the next route's widget tree, prefetching data on hover/press-down)?

- A. The existing pattern is sufficient — every screen's `ValueNotifier<ScreenState<T>>` already renders `Loading` synchronously on navigation before any Contract call resolves, so the 300ms budget covers only widget construction and the frame render, not any network round trip; standard Flutter `Navigator` push/frame timing comfortably clears 300ms without a special technique. (Recommended)
- B. An additional technique is needed — specify which
- X. Other (please specify)

[Answer]: A. Existing pattern is sufficient.

## Q3. Logical component boundary: is the Flutter app its own single logical component (the one client binary), with no internal component split of its own at this design level, and no shared/backend infrastructure to design here (every backend capability is owned by one of the six backend Units it calls)?

- A. Single logical component, no internal split — the app is one client binary; its only "failure domain" is a single device installation (a crash on one device does not affect any other install or any backend Unit), and it owns no infrastructure of its own to design (no database, no queue, no compute) beyond the six `services/*.dart` integration points already specified in frontend-components.md. (Recommended)
- B. Something different — specify
- X. Other (please specify)

[Answer]: A. Single logical component, no internal split.

## Consolidated Summary Confirmation

- Device-guest-identity resolution and Crashlytics init run asynchronously after the first frame; only `AuthState` (already-cached Amplify Auth session) resolves before it. Protects the < 3s cold-start budget.
- Screen transitions rely on the existing immediate-`LoadingSkeleton`/`ScreenState.Loading` render on navigation — no additional pre-building or prefetching technique is needed to clear the < 300ms budget.
- The Flutter app is one single logical component (one client binary, one device-install failure domain), with no internal split and no infrastructure of its own beyond the six `services/*.dart` integration points.

Does this all look correct before I generate the artifacts?

- Looks correct
- Request changes

[Answer]: Looks correct
