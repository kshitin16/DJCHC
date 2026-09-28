# Security Requirements — auth-unit

## NFR3.1 — Authentication

```
Method: OAuth 2.0 / OIDC via Cognito hosted UI, Google as the sole federated identity provider (BR1.1)
Token lifetime: ID/access token 1 hour, refresh token 30 days — Amplify/Cognito defaults, kept as-is (Q1)
MFA requirement: None beyond Google's own account security — applies uniformly to regular users and Admin-group members (Q2)
Session management: Managed entirely by Amplify Auth's token refresh; no server-side session store this Unit owns. Cognito's refresh-token grant reissues the ID/access token from the user pool's CURRENT group membership at each refresh, not a cached snapshot from original sign-in — so an admin-group change (BR1.3) is picked up at the next silent refresh, bounded by the access token's 1-hour lifetime, not by the 30-day refresh-token lifetime or "next sign-in"
Password policy: N/A — Cognito never collects or checks a password; Google federation is the only sign-in path (BR1.1)
```

Cognito Advanced Security Features (compromised-credential detection, adaptive authentication) are not enabled — they add cost and target a password-based attack surface this Unit does not have, since Google federation is the only sign-in path.

## NFR3.2 — Authorization

```
Model: Single role gate (RBAC with one role: Admin), evaluated via cognito:groups (BR1.2)
Roles: "Admin" (Cognito group) — every other signed-in identity is an ordinary user with no elevated role
Resource granularity: Group-level only; this Unit defines no per-resource permission — each consuming Unit (FeedUnit, PdfLibraryUnit, SuggestionUnit) enforces its own operation-level check against this claim
Delegation: None — Admin group membership is managed directly by AWS Cognito (console/CLI), not delegated within the app
Audit: Admin group membership changes rely on AWS's default CloudTrail record of the underlying Cognito admin API calls; no additional application-level audit log (Q3)
```

## NFR3.3 — Data protection

```
Classification: The ID token's sub/email claims (Contract 1) are personal data (NFR4) — classified Confidential
Encryption at rest: N/A for this Unit — Cognito manages its own user pool storage; AuthUnit persists no data of its own (see entities.md)
Encryption in transit: TLS 1.2+, enforced by Cognito's hosted UI and Amplify Auth's own HTTPS-only endpoints (NFR4)
PII handling: sub and email are read by every consuming Unit (Contract 1) but never logged in plaintext by this Unit's own sign-in flow (STRIDE Information Disclosure mitigation)
Data residency: Inherits whatever AWS region the Cognito user pool is deployed to — deferred to Infrastructure Design, per requirements.md's Open Questions
```

## NFR3.5 — Access-boundary and change-review process (NFR6)

Inception NFR6 states two firm process rules that apply directly to this Unit, since AuthUnit IS the sign-in/permissions surface:

```
NFR-AUTHZ (process): only the services/ layer (services/auth_service.dart) may call
package:amplify_* or generated AppSync/GraphQL operations directly for this Unit's
sign-in and admin-check logic; screens/widgets never call Amplify directly
(inherited as a firm project-wide rule, team.md Q12/project.md Mandated — not
re-decided here, only restated as this Unit's binding instance of it).

Trigger: any change to auth_service.dart, to Cognito user pool configuration,
or to the Admin group's usage — requires a brief self-review by the builder
before merging, even though the builder works solo (project.md Mandated, Q14
option E). This is a process control, not a runtime behavior, and is therefore
not testable by an automated NFR validation method — it is verified by the
builder's own commit discipline.
```

Added at this stage's review (R-02) — inception NFR6 was previously pointed at NFR3.2 (the authorization/RBAC model), which does not actually cover either half of NFR6 (the services/-layer boundary or the self-review trigger). NFR3.5 above is the real target.

## NFR3.4 — Threat model (STRIDE)

| Threat | Applicable? | Mitigation |
|---|---|---|
| Spoofing | Yes — a stolen/replayed ID token could impersonate a user | Short-lived (1h) access/ID tokens; TLS everywhere; Google federation means no password to phish directly against this app |
| Tampering | Yes — a tampered JWT | Cognito signs every issued JWT (RS256); any consuming Unit verifies the signature before trusting `sub`/`cognito:groups` |
| Repudiation | Low — this Unit issues no mutating operations of its own | CloudTrail records Cognito admin API calls (group changes); consuming Units own their own audit needs |
| Information Disclosure | Yes — `sub`/`email` are personal data | Never logged in plaintext; encrypted in transit; each consuming Unit stores only what it needs (Contract 1) |
| Denial of Service | Low — Cognito hosted UI is an AWS-managed service with its own DoS protections | No app-level rate limiting added on top of Cognito's own service limits — best-effort availability (NFR2), not a target requiring extra investment |
| Elevation of Privilege | Yes — the central risk this Unit exists to prevent | `cognito:groups` is server-issued and signature-verified, never client-settable; BR1.2/BR1.3 establish that a revocation takes effect at the next Cognito token refresh — a ≤1-hour exposure window in practice, not the 30-day refresh-token lifetime (corrected at this stage's review, R-01) |

## Out of scope

No PCI-DSS/HIPAA/GDPR-specific compliance framework applies to this Unit directly — the donation flow (donation-unit) is where NFR3/NFR5's payment-specific rules bind. This Unit's compliance-relevant obligation is limited to NFR4 (encrypt personal data at rest/in transit), already satisfied by Cognito's own managed defaults.
