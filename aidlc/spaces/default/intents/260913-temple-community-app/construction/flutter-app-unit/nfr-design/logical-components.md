# Logical Components — flutter-app-unit

## Component inventory (Q3, confirmed)

FlutterAppUnit is a **single logical component**: the one client binary distributed to iOS and Android devices, with no internal component split of its own at this design level.

| Element | Nature | Failure domain |
|---|---|---|
| The Flutter app binary | Single distributed client artifact (iOS + Android from one Dart codebase) | One device installation — a crash or bug on one device does not affect any other install or any backend Unit |
| `services/*.dart` (6 files) | Client-side integration points, part of the single binary | No isolation from the rest of the client app — a bug in one `services/` file affects only this Unit's own runtime behavior, never a backend Unit's data or availability, since every backend Unit enforces its own boundary server-side |
| Root-level state (`AuthState`, `DeviceIdentityState`, `LocalizationController`) | In-memory client state, constructed once at app root | Same device-installation failure domain as the binary itself — no separate process, no separate deploy |

## Blast radius

A defect in this Unit is scoped to the client experience of whichever devices have installed the affected app version — it can degrade or break UI behavior (a broken screen, a stuck loading state, a client-side crash) but cannot itself corrupt or expose data owned by any backend Unit, since every write and every authorization decision is re-verified server-side (per security-design.md's NFR-AUTHZ.2 design consequence). This is a materially different blast-radius shape from every backend Unit: a backend Unit's defect can affect every client simultaneously (shared data/shared auth rule); this Unit's defect affects only the devices running the buggy client build, and is naturally bounded by normal app-store release/rollback mechanics — a Code Generation/deployment concern, not something this design stage architects further.

## Shared resources

This Unit owns no AWS resource of its own (no database, no queue, no compute service) — every persisted entity it displays belongs to one of the six backend Units (Post, Suggestion, Donation, Document, Reminder/DeviceToken). The one thing this Unit's runtime state holds locally per device is the Amplify Auth session cache and the language-override preference (security-design.md's Data protection design), neither of which is shared across devices or Units.

One external, non-AWS dependency does exist: **the Firebase project backing Crashlytics** (security-design.md's NFR-CRASH.1). This is not an AWS resource and not shared with any backend Unit, but it is a real provisioning dependency this Unit introduces — see Bridge to Infrastructure Design below.

## Bridge to Infrastructure Design

Beyond mobile app distribution itself (app-store listings, code-signing, CI build artifacts), this Unit introduces exactly one infrastructure dependency for Infrastructure Design to provision: **a Firebase project** for Crashlytics, plus its per-platform config artifacts (`google-services.json` for Android, `GoogleService-Info.plist` for iOS) and Firebase console setup (project creation, app registration, API key generation) — a one-time setup step, not an ongoing operational component, but one Infrastructure Design needs to know about explicitly rather than discover on its own. No other server-side infrastructure component exists for this Unit; the six backend Units' own Infrastructure Design covers every AWS resource this app's `services/*.dart` layer calls into.
