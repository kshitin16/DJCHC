# NFR Requirements — Questions (pdf-library-unit)

## Sources

- [scope] Workflow-selected scope: `temple-mobile-app`.

Consumed upstream artifacts:
- `aidlc/spaces/default/intents/260913-temple-community-app/construction/pdf-library-unit/functional-design/functional-spec.md`
- `aidlc/spaces/default/intents/260913-temple-community-app/construction/pdf-library-unit/functional-design/rules.md`
- `aidlc/spaces/default/intents/260913-temple-community-app/inception/requirements-analysis/requirements.md` (NFR1-NFR8)
- `aidlc/spaces/default/intents/260913-temple-community-app/inception/contract-design/contract-summary.md` (Contracts 2, 6)

This Unit's Functional Design review has twice disclosed (not fixed) a gap: pre-signed S3 upload URLs have no stated replay protection. This is the natural stage to close that, since pre-signed URL lifetime/scope is fundamentally a security-NFR concern, not a functional-workflow concern.

## Q1. Pre-signed URL expiration: how long should the upload URL (`createDocumentUploadUrl`) and the download URL (`getDocumentDownloadUrl`) each stay valid before expiring?

- A. Upload URL: 15 minutes (long enough for an admin to select and start uploading a large PDF over a slow connection, short enough to sharply limit any leaked-URL exposure window). Download URL: 1 hour (a public, low-sensitivity read — the document itself is meant to be public anyway, so the download URL's expiration is about preventing indefinite link-sharing outside the app, not protecting secret content). (Recommended)
- B. Different expiration windows — specify
- X. Other (please specify)

[Answer]: A. Upload 15 minutes / Download 1 hour.

## Q2. Closing the disclosed replay-protection gap: since a pre-signed upload URL is scoped to one specific, already-unique `s3Key` generated per upload attempt (Contract 6), what should this Unit's actual replay-protection posture be?

- A. Short expiration (Q1's 15 minutes) is the whole mitigation — a leaked/replayed upload URL can only overwrite the one already-unique `s3Key` it was issued for (not any other document), and only within its 15-minute window; there is no broader replay risk to protect against beyond limiting that window, since `confirmDocumentUpload` still requires a separate Admin-authenticated call to actually create the Document record even after a successful S3 upload. This closes the gap at the "accepted, bounded risk" level rather than adding extra mechanism (e.g. single-use tokens) that this app's scale doesn't warrant. (Recommended)
- B. Add a stronger mechanism (e.g. S3 conditional-put / single-use enforcement) — specify
- X. Other (please specify)

[Answer]: A. Short expiration is the whole mitigation.

## Q3. Realistic max PDF size for this Unit's performance budget (BR6.2 sets no hard limit, but a performance target needs a working assumption)?

- A. Up to 50MB per file — generous for text-heavy religious documents (poojan vidhis, bhaktamar stotras), which are typically a few hundred KB to low single-digit MB even with embedded images; 50MB gives headroom without implying this app expects video-scale files. (Recommended)
- B. A different ceiling — specify
- X. Other (please specify)

[Answer]: A. Up to 50MB.

## Q4. Alerting/observability posture for upload/delete failures: same standard-logging-only posture as feed-unit (no special alert), or something closer to donation-unit's alerting given a failed hard-delete (BR6.4) can leave a record temporarily pointing at a missing file?

- A. Standard logging only, no special alerting — a stuck BR6.4 retry state is self-healing (the next delete retry completes it) and not financially consequential; the builder will notice via normal admin use if a document delete visibly fails repeatedly. (Recommended)
- B. Add alerting for repeated delete failures.
- X. Other (please specify)

[Answer]: A. Standard logging only.

## Consolidated Summary Confirmation

- Pre-signed upload URLs expire after 15 minutes; download URLs after 1 hour.
- The disclosed replay-protection gap is closed at the "short expiration + per-attempt unique s3Key + separate Admin-authenticated confirmDocumentUpload call" level — an accepted, bounded risk, not requiring additional single-use-token mechanism at this app's scale.
- Performance targets assume PDFs up to 50MB.
- Standard logging only for upload/delete, no special alerting — consistent with feed-unit's posture, not donation-unit's.

Does this all look correct before I generate the artifacts?

- Looks correct
- Request changes

[Answer]: Looks correct
