# Security Design — flutter-app-unit

## Data protection design (NFR4.1)

```
Credential storage: no custom design — Amplify Auth's default platform-secure storage
  (iOS Keychain, Android Keystore/EncryptedSharedPreferences) is used as-is (Q4, NFR
  Requirements). This Unit implements no token persistence, encryption, or storage
  mechanism of its own; there is nothing to architect beyond "use the SDK default."
Local-only cached data: the active Cognito session (delegated to Amplify Auth's own
  storage above) and the local language-override preference (a plain string, no
  sensitivity, stored via standard platform shared-preferences — no encryption design
  needed for a non-sensitive UI preference).
Encryption in transit: TLS 1.2+ on every Contract call — inherited from Amplify's
  generated client (HTTPS-only by default) and each backend Unit's own NFR4.x design;
  this Unit adds no separate transport-layer decision.
```

## Access-boundary and change-review process design (NFR6.1)

```
Layer-boundary enforcement: only the six services/*.dart files (auth_service.dart,
  feed_service.dart, suggestion_service.dart, donation_service.dart, pdf_service.dart,
  reminder_service.dart) may import package:amplify_* or call generated AppSync/GraphQL
  operations, per frontend-components.md's API Integration Points section and the firm
  rule affirmed at Practices Discovery (team.md Q12). This is a code-organization
  convention enforced by code-review discipline, not a runtime control this design stage
  can architect further — flutter_lints has no import-boundary rule, so holding this
  boundary depends on the builder's own discipline at review time.
Change-review trigger: a change to any services/*.dart file, or to the client-side
  admin/sign-in gating logic in the Screen Access Control workflow, gets a brief
  self-review before merging (project.md Mandated, Q14 option E) — again a process
  control, not an infrastructure design decision.
```

## Client-side gating is a UX convenience, never the security boundary (NFR-AUTHZ.2)

```
Design consequence: this Unit's client-side gates (hiding an Admin nav entry from a
  non-admin, redirecting an unauthenticated user away from a signed-in-only screen) are
  read-only convenience checks against AuthState's already-resolved cognito:groups claim
  and isSignedIn flag — no server round trip, no additional design needed beyond reading
  values AuthState already holds (frontend-components.md). Every actual authorization
  decision is made server-side by the owning backend Unit's own AppSync/Amplify Data
  authorization rule (auth-unit's Contract 2 group check, suggestion-unit's owner/group
  rules, reminder-unit's guest-identity scoping) — restated here as this Unit's design
  boundary: a bug in this Unit's gating logic can at most show or hide a UI element
  incorrectly; it cannot itself grant unauthorized data access, since it makes no
  authorization decision that any backend Unit trusts.
```

## Client-side crash reporting design (NFR-CRASH.1) — Q1 startup-sequencing decision applies here too

```
Tool: Firebase Crashlytics Flutter plugin, initialized asynchronously after runApp()
  (per performance-design.md's Q1 answer — initialization never blocks the first frame).
Global error capture (Code Generation implementation requirement — NOT automatic): the
  Crashlytics Flutter plugin does not wire Dart/Flutter-level error capture on its own.
  main() MUST explicitly:
    1. Assign FlutterError.onError = FirebaseCrashlytics.instance.recordFlutterFatalError,
       so uncaught errors inside the Flutter framework/widget tree are captured.
    2. Register PlatformDispatcher.instance.onError to call
       FirebaseCrashlytics.instance.recordError(error, stack, fatal: true) and return true,
       so uncaught errors in async callbacks outside the Flutter framework are captured too.
  Only native (platform-level) crashes are captured automatically by the underlying native
  SDK without this wiring; the majority of a Flutter UI app's own crashes are Dart/Flutter-
  or async-level, so both handlers above are required for NFR-CRASH.1 to actually be met —
  skipping this step would silently defeat the NFR while looking configured.
Payload scoping: no custom crash-report payload is constructed — only the plugin's own
  default capture (device model, OS version, stack trace, non-fatal exception context) is
  sent. In particular, no screen deliberately attaches suggestion text, a donation amount,
  or a personal identifier to a crash report; this is a deliberate absence of a feature,
  not a redaction step applied to data that would otherwise be sent.
```

## Threat model realization (STRIDE)

The mitigations `security-requirements.md`'s threat model already identified are realized entirely by the sections above — no separate design artifact is needed:
- **Spoofing / Tampering**: addressed by never trusting a client-asserted identity or form value (Access-boundary design + client-side gating design above); every backend Unit independently re-verifies.
- **Information Disclosure**: addressed by Crashlytics' default (non-custom) payload (Client-side crash reporting design above) being this Unit's one potential leak surface, and by TLS in transit (Data protection design above).
- **Elevation of Privilege**: addressed by NFR-AUTHZ.2's design consequence above — a client-side gating bug cannot itself elevate privilege.
- **Repudiation / Denial of Service**: not applicable to this Unit (no server-side logging or server surface of its own), per `security-requirements.md`'s own threat model.

## Input validation

No custom validation architecture is designed here beyond what `frontend-components.md`'s Form Validation section already specifies (word-count warning, positive-amount check, required-field checks) — all of it explicitly advisory; the authoritative rejection is always server-side in the owning backend Unit's own `rules.md`. There is no client-side security control to architect, only UX-quality validation.
