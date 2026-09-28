# Security Requirements — flutter-app-unit

## NFR4.1 — Data protection (inherits inception NFR4)

```
Classification: This Unit holds no data of its own — every entity it renders is owned by a
backend Unit (Post, Suggestion, Donation, Document, Reminder/DeviceToken). Its own
data-protection surface is limited to what it caches locally on-device: the active Cognito
session (Contract 1) and the local language-override preference (frontend-components.md's
LocalizationController).
Credential storage (Q4, confirmed): the Cognito ID/access/refresh tokens are persisted entirely
via Amplify Auth's own default platform-secure storage (iOS Keychain, Android Keystore/
EncryptedSharedPreferences) — this Unit implements no custom token persistence, encryption, or
storage mechanism of its own.
Encryption in transit: TLS 1.2+ on every Contract call (inherited from each backend Unit's own
NFR4.x requirement; this Unit adds no separate transport-layer decision).
```

## NFR6.1 — Access-boundary and change-review process (inherits inception NFR6)

```
NFR-AUTHZ (process): only the six files under services/ (auth_service.dart, feed_service.dart,
suggestion_service.dart, donation_service.dart, pdf_service.dart, reminder_service.dart) may
call package:amplify_* or generated AppSync/GraphQL operations — the firm rule already stated in
frontend-components.md's API Integration Points section and team.md's Q12. No screen or widget
imports Amplify directly.

Trigger: a change to any services/ file, or to the client-side admin/sign-in gating logic in the
Screen Access Control workflow, requires a brief self-review before merging (project.md
Mandated, Q14 option E).
```

## NFR-AUTHZ.2 — Client-side gating is a UX convenience, never the security boundary

```
functional-spec.md's Screen Access Control workflow already states this explicitly (step 4): a
non-admin's client-side navigation block to an Admin screen is a UX convenience only — the
actual authorization boundary is each backend Unit's own server-side AppSync/Amplify Data
authorization (auth-unit's Contract 2 cognito:groups check for FeedUnit/PdfLibraryUnit,
suggestion-unit's declarative owner/group auth rules, reminder-unit's guest-identity scoping).
Restated here as this Unit's own NFR posture: any client-side gate this Unit implements
(hiding an Admin nav entry, redirecting an unauthenticated user) is defense-in-depth for UX
clarity, not a security control this Unit is responsible for enforcing correctly on its own —
a bug in this Unit's client-side gating logic cannot, by itself, grant unauthorized access to
any backend data, since every backend Unit enforces its own boundary independently.
```

## NFR-CRASH.1 — Client-side crash reporting (Q3, confirmed)

```
Firebase Crashlytics (or an equivalent free-tier crash-reporting tool) is integrated so the
solo builder learns about client-side crashes without relying on user reports. No PII beyond
the tool's own default capture (device model, OS version, stack trace, non-fatal exception
context) is sent — specifically, no suggestion text, donation amount, or personal identifier
is deliberately included in a custom crash-report payload; only what the tool captures
automatically from an unhandled exception's own context.
```

## Threat model (STRIDE)

| Threat | Applicable? | Mitigation |
|---|---|---|
| Spoofing | Low — this Unit issues no server-trusted claims of its own | Every identity claim (Google `sub`, admin group, guest identity) is resolved and verified server-side by the owning backend Unit, never asserted by this Unit's own client code |
| Tampering | Low, for the same reason | Client-side form validation (frontend-components.md's Form Validation section) is explicitly advisory only — every backend Unit re-validates server-side; a tampered client request is rejected the same as a well-formed one that violates a rule |
| Repudiation | N/A — this Unit performs no server-side logging of its own | Attribution/audit is each backend Unit's own concern |
| Information Disclosure | Low | Crash reports (NFR-CRASH.1) are the one place this Unit could leak data if not careful — mitigated by relying on the tool's own default (non-custom) payload |
| Denial of Service | N/A — no server surface of this Unit's own to exhaust | Each backend Unit owns its own DoS posture |
| Elevation of Privilege | Low, per NFR-AUTHZ.2 | Client-side gating bugs cannot themselves elevate privilege, since every backend Unit independently enforces its own authorization |
