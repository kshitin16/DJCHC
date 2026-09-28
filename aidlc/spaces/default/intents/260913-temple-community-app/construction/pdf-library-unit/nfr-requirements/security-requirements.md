# Security Requirements — pdf-library-unit

## NFR4.1 — Data protection (inherits inception NFR4)

```
Classification: Document content (the PDFs themselves) is Public — BR6.5 makes the library
publicly browsable/downloadable with no sign-in. uploadedByGoogleId is the one personal-data
field, identifying which admin uploaded a document, exposed the same way feed-unit's
createdByGoogleId is (public, since Contract 6 has no field-level auth split) — accepted for the
same reason: no requirement asks for admin-identity secrecy on public-facing content.
Encryption at rest: S3 default server-side encryption (SSE-S3 or SSE-KMS) for the PDF objects;
DynamoDB encryption for Document metadata records — both per NFR4's blanket requirement.
Encryption in transit: TLS 1.2+ on both the AppSync GraphQL boundary and every S3 pre-signed URL
(HTTPS-only pre-signed URLs, not HTTP).
```

## NFR-SEC.1 — Pre-signed URL security (closes the disclosed replay-protection gap)

```
NFR-SEC.1.1 (upload URL): createDocumentUploadUrl issues a pre-signed S3 PUT URL scoped to one
specific, already-unique s3Key, expiring after 15 minutes (Q1).
NFR-SEC.1.2 (download URL): getDocumentDownloadUrl issues a pre-signed S3 GET URL, expiring after
1 hour (Q1) — long enough for a normal download, short enough to prevent indefinite external
link-sharing of a URL that bypasses the app. This control is load-bearing on the S3 bucket itself
having no public/anonymous read access (S3's own default posture, kept as-is, not overridden by
a public bucket policy or ACL) — a pre-signed URL must be the only path to an object, since
`s3Key` is returned as a plain field on `Document` via `listDocuments` (Contract 6) and would
otherwise let a reader construct a direct, non-expiring S3 URL that bypasses this control entirely
(identified at this stage's review, R-03).
NFR-SEC.1.3 (replay-protection posture, Q2 confirmed): short expiration + scoped s3Key + a
separate authenticated confirmDocumentUpload call bounds CROSS-DOCUMENT damage — a leaked or
replayed upload URL can only ever write to the one s3Key it was scoped to, never any other
document's file, and only within its 15-minute window. This does NOT, on its own, bound
CONTENT-SUBSTITUTION risk at that same key: S3 accepts a pre-signed PUT URL repeatedly for its
full validity window (the URL isn't invalidated after first use), so if the URL leaks between
issuance and the admin's own upload, an attacker could PUT a different (still valid-PDF) object
to the same key before confirmDocumentUpload runs — which only checks PDF-ness, not that the
content matches what the admin actually intended to upload (identified at this stage's review,
R-02). This residual risk is explicitly ACCEPTED, not closed: Admin-group membership is a single
trusted builder at this project's scale (BR6.3), URL leakage via browser history/proxy logs/
shoulder-surfing is not a realistic threat this app's threat model needs to defend against, and
adding a stronger mechanism (e.g. a `Content-MD5` condition on the pre-signed PUT, or an
admin-side post-confirm checksum re-verification) is not warranted at this scale. This follows
the same explicit-acceptance pattern used elsewhere in this Unit's NFRs (see reliability-
requirements.md's NFR2.4 S3 Versioning note). This closes the twice-disclosed Functional Design
gap at the "bounded, explicitly accepted residual risk" level rather than leaving the claim
implying full closure.
```

## NFR6.1 — Access-boundary and change-review process (inherits inception NFR6)

```
NFR-AUTHZ (process): only services/pdf_service.dart may call package:amplify_* or generated
AppSync/GraphQL operations for this Unit; screens/widgets never call Amplify directly
(inherited firm rule, project.md Mandated).

Trigger: a change to pdf_service.dart, the upload/delete Admin-group check (BR6.3), or the
pre-signed URL expiration configuration (NFR-SEC.1) requires a brief self-review before merging
(project.md Mandated, Q14 option E).
```

## Threat model (STRIDE)

| Threat | Applicable? | Mitigation |
|---|---|---|
| Spoofing | Yes on write — a non-admin attempting to upload/delete under a spoofed identity | `uploadedByGoogleId` is set server-side from Contract 1's verified identity on `confirmDocumentUpload`, never client-supplied; upload/delete both require BR6.3's Admin-group check |
| Tampering | Yes — a non-admin attempting to upload/delete, or a replayed/leaked pre-signed URL | BR6.3's server-side Admin-group check on upload/delete mutations. NFR-SEC.1's scoped-key + separate-authenticated-confirm design bounds cross-document tampering; content-substitution tampering at the same key during the URL's validity window is an explicitly accepted residual risk (NFR-SEC.1.3), not a closed one |
| Repudiation | Yes — which admin uploaded/deleted a document | `uploadedByGoogleId` + `uploadedAt` give attribution for uploads; standard logging (NFR-OBS.2) records deletes too |
| Information Disclosure | Accepted — `uploadedByGoogleId` is publicly returned (same accepted posture as feed-unit's `createdByGoogleId`); the PDF content itself is intentionally public (BR6.5) |
| Denial of Service | Low | Best-effort availability (NFR2); no rate limiting beyond AppSync's own service limits, consistent with this app's scale |
| Elevation of Privilege | Yes — the central risk BR6.3 exists to prevent | `cognito:groups` is server-issued and signature-verified (Contract 2), same mechanism verified in auth-unit's and feed-unit's NFR passes |
