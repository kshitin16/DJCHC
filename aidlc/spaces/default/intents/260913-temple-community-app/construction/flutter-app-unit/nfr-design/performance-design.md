# Performance Design — flutter-app-unit

## Design for NFR-PERF.1 (cold-start < 3s p95) — Q1, confirmed

Startup is split into a blocking path and an async path so that only work with no relationship to the Feed screen's first frame competes for the 3-second budget:

**Blocking (before first frame):**
- Flutter engine init and root widget build (standard, no custom optimization possible here).
- `AuthState` construction: resolved via an awaited, no-network-call read of the Amplify Auth SDK's already-persisted session (Keychain/Keystore-backed, per `tech-stack-decisions.md`) — the SDK's session-fetch API (e.g. `fetchAuthSession()`) is `Future`-returning by shape even when it serves entirely from local cache, but since it makes no network round trip it resolves in-process on the next microtask, not after any I/O wait; Amplify Auth caches the decoded session locally and only refreshes tokens lazily on expiry.

**Async, non-blocking (after first frame renders):**
- `DeviceIdentityState` resolution (Cognito guest identity via Amplify Auth's unauthenticated identity-pool path) — this is a network call (Contract-adjacent, Amplify Auth internal) with no bearing on rendering Feed, so it starts in the background immediately after the first frame and completes silently. If the user reaches Calendar before it resolves, Calendar's own `myReminders` call waits on it (frontend-components.md's existing "resolved silently at app start" framing is disambiguated here: the resolution *starts* at app start, but does not block it).
- Firebase Crashlytics SDK initialization — standard practice is to initialize early but never block UI on it; done here as a fire-and-forget async call immediately after `runApp()`.
- OS notification-permission request (only triggered on first Calendar visit per functional-spec.md's Register Device Token workflow, not at app start at all).

This ordering means the 3-second budget is spent entirely on engine init + root build + the in-memory `AuthState` read, none of which involves a network round trip — comfortably inside budget on the stated load condition (mid-range device, 4G-equivalent).

## Design for NFR-PERF.2 (screen transition < 300ms p95) — Q2, confirmed

Every screen already renders its `ValueNotifier<ScreenState<T>>`'s `Loading` state synchronously on navigation (frontend-components.md's per-screen state pattern), before the corresponding `services/*.dart` call is even issued. The 300ms budget therefore covers only:
1. `Navigator` push/route transition (standard Flutter frame timing).
2. Building and rendering the destination screen's `LoadingSkeleton` widget tree.

Neither step involves I/O, so no additional technique (route pre-building, press-down prefetching) is designed — the existing pattern already decouples "screen becomes visible" from "data has arrived," which is what NFR-PERF.2 actually measures (see performance-requirements.md's own framing: "loading state, not necessarily populated data").

## Design for NFR-PERF.3 (offline/poor-connectivity) — inherited, no new design

Confirmed at NFR Requirements: no offline-first caching. Every screen's existing error+retry state (functional-spec.md's per-workflow error paths) is the complete story; this stage adds no cache-invalidation, staleness-indicator, or conflict-resolution design, consistent with that already-made scope decision.

## Performance budget summary

| Target | Design approach |
|---|---|
| NFR-PERF.1 (cold start, < 3s p95) | Blocking path = engine init + in-memory `AuthState` read only; device identity, Crashlytics, and push-permission resolution all deferred to async, non-blocking work |
| NFR-PERF.2 (screen transition, < 300ms p95) | Existing synchronous `Loading`-state render on navigation; no additional pre-building/prefetching needed |
| NFR-PERF.3 (offline/poor connectivity) | No caching layer — error+retry per screen (already designed in functional-spec.md) |

No CDN, resource pooling, or connection-pooling design applies — this Unit issues no requests of its own beyond calling the six backend Units' `services/*.dart` wrappers, and Amplify's generated client already pools its own HTTP connections internally.
