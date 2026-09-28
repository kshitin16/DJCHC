<!-- INVARIANT: examples are single-line HTML comments so a fresh template parses to total=0 (MEMORY_EMPTY). Do NOT un-comment or split across lines. t100 guards this. -->
> This file is kept up to date automatically while the stage runs. Add observations at the review step, not by editing here directly.

## Interpretations
- 2026-09-14T16:10:00Z — resolved frontend-components.md's ambiguous "resolved silently at app start (or lazily on first Calendar visit)" for DeviceIdentityState as: resolution *starts* async right after the first frame, non-blocking, so it doesn't compete with the cold-start budget; it only blocks the caller if Calendar is reached before it settles.

## Deviations
- 2026-09-14T16:20:00Z — corrected security-design.md's Crashlytics wiring claim after iteration-1 review (R-01): the plugin does NOT auto-wire FlutterError.onError/PlatformDispatcher.instance.onError; this is required manual main() setup, now stated as a Code Generation implementation requirement rather than default behavior.

## Tradeoffs
- 2026-09-14T16:10:00Z — no scalability/reliability/observability-design artifacts produced for this Unit; it is `kind: ui` and produces_kinds scopes those three to `service` only. This Unit's only observability surface (crash reporting) is covered under security-design.md's NFR-CRASH.1 instead.

## Open questions
<!-- example: 2026-05-29T10:14:32Z — confirm the retention window with compliance before the next stage hardens the schema -->
