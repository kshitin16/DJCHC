# NFR Design — Questions (pdf-library-unit)

## Sources

- [scope] Workflow-selected scope: `temple-mobile-app`.

Consumed upstream artifacts:
- `aidlc/spaces/default/intents/260913-temple-community-app/construction/pdf-library-unit/nfr-requirements/*.md`
- `aidlc/spaces/default/intents/260913-temple-community-app/construction/pdf-library-unit/functional-design/functional-spec.md`
- `aidlc/spaces/default/intents/260913-temple-community-app/inception/contract-design/contract-summary.md` (Contracts 2, 6)

NFR Requirements' security-requirements.md (NFR-SEC.1.2) already states the download-URL expiration control depends on the S3 bucket having no public/anonymous access outside a pre-signed URL. This stage is where that load-bearing assumption becomes an actual bucket-configuration commitment.

## Q1. S3 bucket public access: commit to the actual bucket configuration that makes NFR-SEC.1.2's assumption true.

- A. `BlockPublicAccess.BLOCK_ALL` on the bucket, with no bucket policy or ACL granting public/anonymous `s3:GetObject` — every read goes through `getDocumentDownloadUrl`'s pre-signed URL, never a direct public bucket URL. This is the only configuration that actually makes NFR-SEC.1.2's assumption true, and matches this project's Well-Architected security defaults (block public access unless deliberately serving public static content, which this Unit does NOT do directly — it serves through pre-signed URLs instead). (Recommended)
- B. Something different — specify
- X. Other (please specify)

[Answer]: A. BlockPublicAccess.BLOCK_ALL.

## Q2. CDN in front of downloads: does this Unit need CloudFront in front of S3 for PDF downloads, or is a direct S3 pre-signed URL (current design) sufficient?

- A. No CDN — a direct S3 pre-signed GET URL is sufficient at this app's download volume (a few hundred readers, intermittent). Adding CloudFront would mean managing cache invalidation for a pre-signed-URL-backed origin (CloudFront caching a URL with an embedded expiring signature is its own complexity) for no meaningful latency or cost benefit at this scale. (Recommended)
- B. Add CloudFront — specify why
- X. Other (please specify)

[Answer]: A. No CDN.

## Q3. Incomplete multipart upload cleanup: large PDF uploads (up to 50MB, per NFR Requirements) may use S3 multipart upload; should incomplete/abandoned multipart uploads be cleaned up automatically?

- A. Yes — an S3 lifecycle rule aborting incomplete multipart uploads after 7 days. This is a standard cost-hygiene practice (abandoned multipart parts otherwise accumulate storage cost silently) and needs no application-level logic, just a bucket lifecycle configuration. (Recommended)
- B. Skip this — specify why
- X. Other (please specify)

[Answer]: A. Yes, lifecycle rule at 7 days.

## Consolidated Summary Confirmation

- The S3 bucket blocks all public access (`BlockPublicAccess.BLOCK_ALL`); every read goes through a pre-signed URL.
- No CDN — direct S3 pre-signed URLs are sufficient at this app's download volume.
- An S3 lifecycle rule aborts incomplete multipart uploads after 7 days.

Does this all look correct before I generate the artifacts?

- Looks correct
- Request changes

[Answer]: Looks correct
