# Monitoring Design — flutter-app-unit

A `kind: ui` Unit has no `observability-design.md` from NFR Design (per `produces_kinds`); the observability requirement it carries is `security-design.md`'s NFR-CRASH.1 (client-side crash reporting via Firebase Crashlytics), and its measurable performance targets are `performance-design.md`'s NFR-PERF.1 (cold start) and NFR-PERF.2 (screen transition). This document says where each of those signals actually lands and what, if anything, is watched. Every server-side signal for the screens in `functional-spec.md` — resolver latency, Lambda errors, table health — belongs to the owning backend Unit's own `monitoring-design.md`; the app produces no CloudWatch metric of its own.

## Metrics & KPIs

| Metric | Source | Threshold | Why it matters |
|---|---|---|---|
| Crash-free users % / crash-free sessions % | Firebase Crashlytics (release builds only — debug collection disabled, `infrastructure-specification.md` > Firebase environment) | None configured | The headline health signal for NFR-CRASH.1: the one place a client-side defect across `components.md`'s six consumed components becomes visible, since a crash on a device never reaches any backend log. |
| Fatal vs. non-fatal issue count, per app version | Crashlytics issues list, grouped by build version | None configured | Ties a crash spike to the release that introduced it — the only correlation key available to a client with no server-side deploy marker. `FlutterError.onError` and `PlatformDispatcher.instance.onError` wiring (`security-design.md`) is what makes Dart-level crashes appear here at all. |
| ANR rate (Android) / hang rate (iOS) | Google Play Console Android vitals; App Store Connect > Metrics | None configured | Store-provided secondary crash/hang signals that need zero setup and catch platform-level freezes Crashlytics may not attribute. |
| Cold-start time (NFR-PERF.1, < 3s p95) | Manual pre-release measurement on a mid-range device: `flutter run --profile` + DevTools timeline (app start to first Feed frame) | 3s — checked by hand before each production promotion, not alerted | No production instrumentation is added (no Firebase Performance Monitoring — `infrastructure-specification.md`); the target is verified as a release-checklist step (`cicd-pipeline.md`). |
| Screen-transition time (NFR-PERF.2, < 300ms p95) | Same manual profile run, navigating to each first-release screen | 300ms — checked by hand before each production promotion | As above. |

## Alerts

| Alert | Condition | Severity | Routes to |
|---|---|---|---|
| Crashlytics "new fatal issue" / "regressed issue" email | Firebase's built-in, default-on notification when a never-seen or previously-closed fatal issue appears | Informational (email only) | The builder's Firebase-account email |
| (none other) | — | — | — |

No CloudWatch alarm exists for this Unit (it owns no AWS resource), and no custom Crashlytics velocity threshold is configured — consistent with every backend Unit's no-alerting posture at this project's scale. The one built-in Crashlytics notification is left at its default because it costs nothing to keep, requires no configuration, and is the only channel through which a client-side crash reaches a human at all; it is not a paging alert and has no runbook beyond "open the Crashlytics issue".

## SLIs / SLOs

| SLI | SLO target | Measurement window |
|---|---|---|
| Crash-free sessions % | No formal SLO — best-effort, reviewed per release in the Crashlytics console | Per app version |
| Cold start (NFR-PERF.1) | 3s p95 design target, verified manually pre-release | One profile run per production promotion |
| Screen transition (NFR-PERF.2) | 300ms p95 design target, verified manually pre-release | One profile run per production promotion |

## Logs & Tracing

**Logging**: The app writes no server-side log. In debug builds, `debugPrint` output goes to the developer console only. In release builds, the only log-like channel is Crashlytics' custom-log breadcrumbs (`FirebaseCrashlytics.instance.log(...)`), used sparingly to record which screen was active when a crash occurred — and, per `security-design.md`'s payload-scoping rule, never carrying suggestion text, a donation amount, an email, or any other personal identifier (project.md's Mandated encrypt-personal-data rule extends to not shipping it to a third-party crash tool at all).

**Correlation**: No request-ID propagation exists between the app and the backend Units' logs today; correlating a client crash with a backend error is done by timestamp and app version. Amplify's generated client does not surface a per-request correlation header the app could log, so this is a known gap accepted at this project's scale rather than designed around.

**Tracing**: Not applicable — no X-Ray on the backend side (every backend Unit's posture), no Firebase Performance Monitoring on the client side.

**Dashboards**: No custom dashboard. The Crashlytics console (per-version issue list, crash-free trends), Google Play Console Android vitals, and App Store Connect metrics are the three read-only views the builder checks after each release.
