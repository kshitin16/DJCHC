# Security Requirements — feed-unit

## NFR4.1 — Data protection (inherits inception NFR4)

```
Classification: Post content (title, description, dateTime, type) is Public — the feed is
readable by anyone, signed in or not (FR2.6, BR2.4's own read filter has no auth check).
createdByGoogleId is the one field with a personal-data character (identifies which admin
created a post) but is not exposed to public readers via listPosts' own consumer surface
beyond what Contract 3 already declares.
Encryption at rest: AWS-managed DynamoDB encryption (AES-256), per NFR4's blanket requirement.
Encryption in transit: TLS 1.2+ on the AppSync GraphQL boundary (Contract 3).
```

## NFR6.1 — Access-boundary and change-review process (inherits inception NFR6)

```
NFR-AUTHZ (process): only services/feed_service.dart may call package:amplify_* or generated
AppSync/GraphQL operations for this Unit; screens/widgets never call Amplify directly
(inherited firm rule, project.md Mandated).

Trigger: a change to feed_service.dart or to the Admin-group authorization check on
create/edit/delete (BR2.3) requires a brief self-review before merging (project.md Mandated,
Q14 option E) — this Unit is directly named ("any change touching sign-in, permissions...").
```

Named `NFR6.1` (not `NFR3.x`) so the ID prefix correctly identifies which inception NFR this
item elaborates — donation-unit's NFR review (R-01) caught the same class of mistake (labeling
this recurring process rule as a sub-item of NFR3 instead of NFR6), so it is applied correctly
here from the start rather than repeated and fixed later.

## NFR-AUTHZ.1 — Authorization (BR2.3, BR2.7)

```
Model: Single role gate (RBAC, one role: Admin), evaluated via Contract 2's cognito:groups claim
Roles: "Admin" — create/edit/delete (BR2.3) and the admin management view (BR2.7); every other
reader is unauthenticated-or-not, with identical read access either way (public read, FR2.6)
Resource granularity: Operation-level — a single boolean gate per mutation/admin-query, no
per-post ownership model (any admin may edit any post, not just ones they created)
Delegation: None
Audit: Standard logging (NFR-OBS.2 below) records who performed each mutation; no special
alerting (Q3, confirmed) — a bad or wrong post is not a financial-severity failure like
donation-unit's reconciliation gap
```

## Threat model (STRIDE)

| Threat | Applicable? | Mitigation |
|---|---|---|
| Spoofing | Yes on write — a non-admin attempting to create/edit/delete under a spoofed identity | `createdByGoogleId` is set server-side from Contract 1's verified identity on write, never client-supplied — a caller cannot spoof who a post is attributed to. On read, `listPosts` is intentionally unauthenticated (no identity to spoof); see Information Disclosure below for what that public read path exposes |
| Tampering | Yes — a non-admin attempting to create/edit/delete | BR2.3's server-side Admin-group check on every mutation; the client-side admin UI is a convenience, not the enforcement point |
| Repudiation | Yes — which admin made a change | createdByGoogleId + createdAt/updatedAt give attribution; standard logging (NFR-OBS.2) adds a request-level record |
| Information Disclosure | Accepted — `createdByGoogleId` (the posting admin's stable Cognito identifier) is returned by the public, unauthenticated `listPosts` query, since Contract 3's `Post` type has no field-level auth split and this app has only one class of admin (there is no distinct "which specific admin posted this" secrecy requirement — FR2.5 only restricts who may *write*, not whose identity is visible on a post they wrote). This is a deliberate, disclosed acceptance, not an oversight: the alternative (a field-level auth rule hiding `createdByGoogleId` from non-admin readers) is not adopted at this stage since no requirement asks for admin-identity secrecy and doing so would require a schema change to Contract 3 |
| Denial of Service | Low | Best-effort availability (NFR2); no rate limiting added beyond what AppSync's own service limits provide, consistent with this app's scale |
| Elevation of Privilege | Yes — the central risk BR2.3/BR2.7 exist to prevent | `cognito:groups` is server-issued and signature-verified (Contract 2), never client-settable — same mechanism auth-unit's NFR pass already verified |
