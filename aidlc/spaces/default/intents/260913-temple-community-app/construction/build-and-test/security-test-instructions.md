# Security Test Instructions

## Sources

- [scope] Test Strategy: Standard. Security instructions are above the Standard baseline; generated deliberately because the project carries firm security rules in `project.md` § Mandated / § Forbidden and handles personal data plus a future payment flow.
- Consumed: every unit's `nfr-requirements/security-requirements.md` and `nfr-design/security-design.md`; `aidlc/spaces/default/memory/project.md`.

## Checks that already pass, with evidence

| Check | Method | Result |
|---|---|---|
| No secrets in source | `gitleaks` pre-commit hook; reviewer greps over `lib/`, `pubspec.yaml`, `amplify/` | No findings |
| Secrets referenced, not embedded | Google and FCM credentials are `secret()` references (SSM SecureString) | Confirmed in source |
| No raw payment credentials | No card/CVV/UPI-PIN field in the donation types or schema; appears only in comments forbidding it | Confirmed in source |
| Admin operations server-gated | 19 `allow.group('Admin')` rules in `amplify/data/resource.ts`, plus `requireAdmin` backstops in handlers | Confirmed in source |
| Amplify import boundary | Grep across `lib/`: only `lib/services/amplify_gateway.dart` and `lib/services/gateways.dart` touch `package:amplify_*` | Confirmed; no screen or widget |
| Owner-scoped reads | `myPastSuggestions` and reminder reads key on the server's identity, never a client-supplied id | Confirmed in source |
| Rate limit is race-proof | Single atomic conditional `UpdateItem`, verified by a condition-evaluating test fake | Confirmed; 284 tests pass |
| Dependency vulnerabilities | GitHub Dependabot on `package.json` and `pubspec.yaml` | Enabled per team practice (verify in repo settings) |

## Checks that require a deployed environment

These are the security equivalents of the integration suite and cannot run here.

### ST-1 — Authorization matrix, enforced server-side

For every operation across all six backend units, call it as: signed-out guest,
signed-in non-admin, signed-in admin. Record allowed/refused. The expected matrix
is in `integration-test-instructions.md` IT-4. **A refusal must come from AppSync**,
not from the app declining to show a control. Any operation that a non-admin can
reach is a finding regardless of what the UI does.

### ST-2 — Cross-tenant access attempts

With two signed-in accounts A and B:

- B calls `myPastSuggestions` — must return only B's suggestions, never A's
- B calls reminder operations with A's reminder id — must be refused as not-owner
- B calls `getDocumentDownloadUrl` for a deleted document — must be refused

Suggestion confidentiality is the whole point of that feature, so ST-2 is the
sharpest check in this file.

### ST-3 — S3 object-level isolation

- Attempt to GET a `documents/` key directly without a pre-signed URL — must fail
- Attempt a pre-signed PUT to a key outside `documents/<CATEGORY>/<uuid>.pdf` —
  must be refused by `parseS3Key`
- Attempt path traversal (`documents/../`, backslashes, wrong segment counts) —
  must be refused
- Confirm the bucket denies public reads from an unauthenticated client

### ST-4 — Webhook signature verification

Blocked until an aggregator exists. When it does: replay a webhook with a
tampered body and a valid-looking signature, and with a stale timestamp. Both
must be refused before any table access. The handler already checks the
signature first with a constant-time comparison — confirm that holds against
real aggregator payloads.

### ST-5 — Transport and at-rest encryption

- Confirm every client call is TLS 1.2+ (Amplify default; verify no plain HTTP
  endpoint is reachable)
- Confirm DynamoDB encryption at rest on all tables, S3 SSE-S3 on the bucket,
  and Cognito's managed encryption — this is the `project.md` Mandated rule about
  personal data

### ST-6 — Log hygiene

Exercise each Lambda and inspect CloudWatch: no push token, no FCM secret, no
Google credential, no suggestion body, no donor identity beyond an id. The
reviewers confirmed this in source; confirm it in actual log output.

## Pipeline gates already in place

`.github/workflows/ci.yml` runs on push and PR to `main` and blocks on failure:
backend `eslint` + `tsc --noEmit` + `jest --coverage` (which arms the 80% floor),
and app `dart format --set-exit-if-changed` + `flutter analyze` + `flutter test --coverage`.

**It has never executed in GitHub.** Its first run is itself a security-relevant
check: a green local run does not prove the gate works.

## Gaps recorded rather than closed

- No SAST beyond ESLint. `eslint-plugin-security` was suggested at practices
  discovery and not adopted; it remains a cheap addition.
- No DAST. Proportionate to skip at this scale, but note it.
- Content-type validation on PDF upload trusts the client-declared type, with no
  size cap and no magic-byte check. Accepted risk under the security design.
