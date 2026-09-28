# Performance Requirements — flutter-app-unit

## NFR-PERF.1 — App cold-start time (Unit-local ID; no inception-level performance NFR names this Unit's own startup path — see traceability.json)

| Field | Value |
|---|---|
| Metric | Time from tapping the app icon to the first interactive frame of the Feed screen |
| Target | < 3 seconds |
| Percentile | p95 |
| Load condition | Typical mid-range mobile device, 4G/LTE-equivalent connection |
| Measurement method | Platform-level cold-start instrumentation (e.g. Flutter's own `firstFrame` timing, or Crashlytics/Performance Monitoring's cold-start trace) |

This is distinct from feed-unit's NFR1.1 (the `listPosts` content-load budget, which starts once the app is already running) — NFR-PERF.1 covers Flutter engine initialization, `AuthState`/`DeviceIdentityState`'s initial resolution, and first-frame render, all of which happen before the Feed screen even issues its `listPosts` call.

## NFR-PERF.2 — Screen transition responsiveness

| Field | Value |
|---|---|
| Metric | Time from tapping a navigation target to the destination screen rendering (loading state, not necessarily populated data) |
| Target | < 300ms |
| Percentile | p95 |
| Load condition | Any device meeting this app's minimum supported OS version |
| Measurement method | Standard Flutter frame-timing instrumentation |

A fast transition to a loading/skeleton state (per frontend-components.md's `LoadingSkeleton`) is what this target covers — the underlying data fetch itself is governed by each backend Unit's own NFR1.x/NFR-PERF.x targets (feed-unit's `listPosts`, suggestion-unit's `myPastSuggestions`, etc.), not this Unit's own performance.

## NFR-PERF.3 — Offline/poor-connectivity behavior (Q2, confirmed)

No offline-first caching is implemented at this stage — every screen's existing error+retry state (per functional-spec.md's per-workflow error paths) is the complete offline/poor-connectivity story. This is a deliberate scope decision, not a missing target: this app's low-stakes, community-scale use case doesn't justify the added complexity (cache invalidation policy, staleness indicators, conflict resolution on reconnect) that offline-first caching would require.

## Out of scope

No throughput target applies to this Unit — it issues requests to backend Units, each of which owns its own throughput NFRs; this Unit's own performance concern is entirely client-side rendering/navigation responsiveness, covered by NFR-PERF.1/NFR-PERF.2 above.
