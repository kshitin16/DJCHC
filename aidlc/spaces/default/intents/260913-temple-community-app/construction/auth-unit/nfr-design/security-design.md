# Security Design — auth-unit

## Authentication architecture (NFR3.1)

```
Identity Provider: Google (OIDC), federated through Cognito's hosted UI
Cognito User Pool: single pool, single App Client
App Client type: PUBLIC (no client secret) — Q2, confirmed. A secret embedded in a
  distributed mobile binary is extractable and therefore not a real secret; Cognito's own
  guidance for mobile/SPA clients is to omit it and rely on Authorization Code + PKCE instead.
OAuth flow: Authorization Code Grant with PKCE (Proof Key for Code Exchange) — the
  standard, secure flow for a public client with no server-side component to hold a secret.
Token lifetime: Amplify/Cognito defaults (1h access/ID token, 30-day refresh token) — Q1
  from NFR Requirements, unchanged here.
MFA: none, per NFR Requirements Q2 — Google's own account security is the accepted basis.
```

## Authorization architecture (NFR3.2/NFR6.1)

```
Model: cognito:groups claim, "Admin" group, evaluated independently by each consuming Unit
  (FeedUnit, PdfLibraryUnit, SuggestionUnit) against Contract 2's shared claim shape.
AuthUnit's own design responsibility: none beyond configuring the "Admin" Cognito Group and
  ensuring the User Pool's token generation includes cognito:groups in the ID token by
  default (Cognito's standard behavior for group-based claims — no custom Lambda trigger
  needed to inject it).
Group membership management: via AWS Console/CLI (AdminAddUserToGroup/AdminRemoveUserFromGroup),
  per requirements.md FR1.2's "editable list... not a hardcoded value" — Cognito Groups
  satisfy this natively without a custom admin-management UI or Lambda.
```

## Encryption design

```
At rest: Cognito's own managed encryption of the User Pool's stored user records — no
  design decision required, this is AWS's default.
In transit: TLS 1.2+ enforced by Cognito's hosted UI endpoints and Amplify Auth's HTTPS-only
  client configuration — no custom TLS configuration needed.
```

## Input validation / secrets management

No custom input validation surface exists in this Unit (Cognito's hosted UI handles the Google OAuth exchange; this Unit never collects a password or other credential directly). No secret is stored by this Unit at deploy time beyond the Cognito App Client's own configuration, which itself holds no secret (Q2) — there is nothing for AWS Secrets Manager/SSM Parameter Store to hold for this specific Unit.

## Threat model realization (NFR3.4)

The six STRIDE categories NFR Requirements' threat table actually applies to this Unit are realized as follows (corrected at this stage's review, R-01/R-02, after an earlier draft mischaracterized the Spoofing mitigation and only walked 4 of the categories it had counted; corrected again at R-03 after that count itself was still wrong — the upstream table has six rows, not five, and the sixth, Elevation of Privilege, was omitted entirely):

- **Spoofing** (a stolen/replayed ID token could impersonate a user): mitigated by short-lived (1h) access/ID tokens and TLS everywhere (Authentication architecture's Token lifetime setting) — matching security-requirements.md's own stated mitigation exactly. PKCE plays no role in this mitigation: it protects the authorization-code exchange step of the OAuth sign-in redirect against interception/hijacking, a different threat (a stolen authorization code, not a stolen/replayed issued token) than the one this STRIDE row names.
- **Tampering** (a tampered JWT): mitigated by Cognito signing every issued JWT with RS256 (Authentication architecture) — any consuming Unit verifies the signature before trusting `sub`/`cognito:groups`, matching security-requirements.md exactly.
- **Repudiation** (this Unit issues no mutating operations of its own): CloudTrail records the underlying Cognito admin API calls (group membership changes) by default — see Audit logging below; no separate design action needed beyond what's already stated there.
- **Information Disclosure** (`sub`/`email` are personal data): mitigated by TLS in transit and never logging these values in plaintext (Encryption design above).
- **Denial of Service** (Cognito hosted UI is AWS-managed with its own DoS protections): no app-level rate limiting is added on top of Cognito's own service limits — best-effort availability (NFR2) is the accepted posture, not a target requiring extra design investment here.
- **Elevation of Privilege** ("the central risk this Unit exists to prevent" per security-requirements.md): mitigated by `cognito:groups` being server-issued and signature-verified — never client-settable (Authorization architecture above) — with a ≤1-hour practical revocation-exposure window (a group removal takes effect at the next Cognito token refresh, bounded by the 1h access/ID token lifetime, not the 30-day refresh-token lifetime).

## Process controls (NFR3.5)

```
Access-boundary rule: only services/auth_service.dart may call package:amplify_* — a
  code-organization convention, not an infrastructure design decision; enforced by code
  review discipline, not a runtime control this design stage can architect.
Change-review trigger: any change to auth_service.dart or to this Unit's Cognito
  configuration (amplify/auth/resource.ts) gets a brief self-review before merging — a
  process control, likewise not something with an infrastructure design counterpart.
```

## Audit logging

CloudTrail records the underlying Cognito admin API calls (group membership changes) by default — already the accepted posture from NFR Requirements (Q3). No additional application-level audit log is designed here.
