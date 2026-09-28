# Security Requirements — suggestion-unit

## NFR4.1 — Data protection (inherits inception NFR4)

```
Classification: Suggestion text + submittedByGoogleId is Confidential — this is the one Unit in
this project whose entire purpose is a non-public, identity-attributed communication (unlike
feed-unit/pdf-library-unit's intentionally public content).
Encryption at rest: AWS-managed DynamoDB encryption (AES-256), per NFR4's blanket requirement.
Encryption in transit: TLS 1.2+ on the AppSync GraphQL boundary.
```

## NFR-AUTHZ.1 — Authorization (BR3.2, BR3.3) — the one Unit in this project enforcing its core
access rule DECLARATIVELY at the AppSync/Amplify Data layer rather than in resolver code

```
Model: Two declarative auth rules on Contract 4's schema — an owner rule (`allow: owner`, keyed
on submittedByGoogleId) on myPastSuggestions, and a group rule (`allow: groups,
groups: ["Admin"]`) on allSuggestions. Both are enforced by AppSync itself before any resolver
logic runs (BR3.3) — a request that fails either rule never reaches application code at all,
which is a STRONGER guarantee than the server-side-check pattern every other Unit's admin-gated
operations use (feed-unit, pdf-library-unit both check cognito:groups in resolver logic; this
Unit's schema-level rule can't be bypassed by a resolver bug, since there is no resolver code
path to bypass).
Resource granularity: Row-level for myPastSuggestions (each Suggestion's own submittedByGoogleId
field is the owner key); operation-level for allSuggestions (any Admin-group member sees every row)
Delegation: None
Audit: Declarative-auth refusals are NOT visible to this Unit's own application logging (Q1,
confirmed) — they happen at the AppSync gateway before any Lambda/resolver invocation. Visibility
into unauthorized-access attempts relies entirely on AppSync's own CloudWatch access logs
(enabled at the API level, project-wide, not configured per-Unit here) rather than an
application-level audit trail this Unit's own code could produce.
```

## NFR-RATE.1 — Submission rate limiting (BR3.5) — the atomic-write pattern this project established

```
NFR-RATE.1: A user's 5-per-IST-day submission cap is enforced via a single atomic DynamoDB
conditional UpdateItem (ADD count :one WHERE count < 5 OR attribute_not_exists), not a
read-then-write check — the same race-avoiding pattern this project's own persisted practice
requires for any hard per-user rate limit. Hitting the cap gets standard INFO-level logging
(who, when), no alerting (Q2, confirmed) — this is an engagement-volume event, not a security
or financial one.
```

## NFR6.1 — Access-boundary and change-review process (inherits inception NFR6)

```
NFR-AUTHZ (process): only services/suggestion_service.dart may call package:amplify_* or
generated AppSync/GraphQL operations for this Unit; screens/widgets never call Amplify directly
(inherited firm rule, project.md Mandated).

Trigger: a change to suggestion_service.dart, the declarative owner/group auth rules on Contract
4's schema, or the atomic rate-limit counter logic requires a brief self-review before merging
(project.md Mandated, Q14 option E).
```

## Threat model (STRIDE)

| Threat | Applicable? | Mitigation |
|---|---|---|
| Spoofing | Yes on write — a caller attempting to submit under someone else's identity | `submittedByGoogleId` is set server-side from Contract 1's verified identity, never client-supplied |
| Tampering | Low — no mutation exists to alter a submitted Suggestion (BR3.4: no delete/edit at all) | N/A — there is no edit surface to tamper with; a Suggestion is immutable once created |
| Repudiation | Low — a submitter disputing their own suggestion is not a modeled concern for a low-stakes free-text box | `submittedByGoogleId` + `submittedAt` still give attribution if ever needed |
| Information Disclosure | Yes — the central risk BR3.3 exists to prevent | AppSync's declarative owner/group auth rules refuse a non-owner, non-admin request at the gateway, before any application logic could leak a row — the strongest disclosure mitigation in this project, since there's no resolver-level check to get wrong |
| Denial of Service | Low, but see BR3.5 — a user submitting rapidly | The atomic conditional-write rate limit (NFR-RATE.1) bounds per-user submission volume; no broader DoS protection is added beyond AppSync's own service limits |
| Elevation of Privilege | Yes — a non-admin attempting to read `allSuggestions` | AppSync's group auth rule (Contract 2's Admin group) refuses this at the schema level, the same declarative-enforcement guarantee noted above |
