# Security Design — pdf-library-unit

## S3 bucket configuration (NFR-SEC.1.2, Q1)

```
BlockPublicAccess: BLOCK_ALL — no bucket policy or ACL grants public/anonymous
  s3:GetObject, s3:PutObject, or any other action. This is the actual bucket-configuration
  commitment that makes NFR-SEC.1.2's "no public access" assumption true; without it, the
  download-URL expiration control would be silently bypassable via a direct bucket URL
  (the gap NFR Requirements' review identified but only flagged as an assumption, not yet
  a committed setting).
Encryption: SSE-S3 default server-side encryption (per NFR4.1, carried forward from NFR
  Requirements' tech-stack-decisions.md).
Versioning: OFF, committed for this Bolt (corrected at this stage's review, R-03, to remove
  the earlier ambiguous "not enabled by default... not decided here" phrasing, which read as
  both a settled fact and an open decision at once). BR6.4's hard-delete semantics
  (permanent, no undo) depend on Versioning staying off — enabling it would silently give
  deleted documents a recoverable prior version, contradicting BR6.4's own documented
  intent. If this trade-off is ever revisited (e.g. to add an accidental-delete safety
  net), that is a forward-looking Infrastructure Design decision requiring its own
  amendment to BR6.4, not a setting this design stage leaves ambiguous today.
```

## Pre-signed URL security (inherits NFR-SEC.1.1, unchanged from NFR Requirements)

No new design decision beyond what NFR Requirements already specified (15-minute upload URL, 1-hour download URL, accepted residual content-substitution risk at this app's scale) — this stage's only addition is the bucket-access commitment above, which is what makes the download URL's expiration control actually meaningful.

## Lifecycle policy (Q3)

```
S3 lifecycle rule: AbortIncompleteMultipartUpload after 7 days — standard cost-hygiene
  practice for a bucket accepting large (up to 50MB) direct uploads that may use S3
  multipart upload; abandoned parts otherwise accumulate storage cost silently with no
  application-level trigger to clean them up.
```

## Authorization architecture

```
listDocuments/getDocumentDownloadUrl: no auth required — public reads (BR6.5).
createDocumentUploadUrl/confirmDocumentUpload/deleteDocument: resolver-level cognito:groups
  check (Contract 2), same mechanism every other admin-gated Unit uses — no new
  authorization mechanism designed here.
```

## Process controls (NFR6.1)

```
Access-boundary rule: only services/pdf_service.dart may call package:amplify_*/
  amplify_storage for this Unit's client-side operations.
Change-review trigger: any change to pdf_service.dart, the upload/delete Admin-group
  authorization check (BR6.3), or the pre-signed URL expiration configuration (NFR-SEC.1)
  gets a brief self-review before merging — matching security-requirements.md's NFR6.1
  trigger list exactly, corrected at this stage's review (R-01) after a prior draft
  silently substituted "S3 bucket policy/lifecycle configuration" for the pre-signed-URL
  item instead of adding to the list. The S3 bucket policy and lifecycle configuration
  (Q1, Q3) are ALSO worth a self-review when changed, but as an addition alongside the
  upstream-named triggers, not a replacement for the one item (pre-signed URL expiration)
  the requirement actually names.
```
