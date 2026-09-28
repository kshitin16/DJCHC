# Infrastructure Design — Questions (pdf-library-unit)

## Sources

- [scope] Workflow-selected scope: `temple-mobile-app`.

Consumed upstream artifacts:
- `aidlc/spaces/default/intents/260913-temple-community-app/construction/pdf-library-unit/nfr-design/*.md`
- `aidlc/spaces/default/intents/260913-temple-community-app/inception/domain-design/components.md`
- `aidlc/spaces/default/intents/260913-temple-community-app/construction/pdf-library-unit/functional-design/functional-spec.md`
- `aidlc/spaces/default/intents/260913-temple-community-app/inception/contract-design/contract-summary.md`

Region and environment strategy are already fixed project-wide (auth-unit's Infrastructure Design) and carry forward unchanged. This Unit's own NFR Design already fully specified every infrastructure-relevant decision the design stage prose would otherwise ask about (S3 `BlockPublicAccess.BLOCK_ALL`, SSE-S3 encryption, Versioning OFF, a 7-day incomplete-multipart-upload lifecycle rule, no CDN, pre-signed URL expirations). No genuinely new decision remains — this stage's job here is to restate those as concrete AWS resource configuration and IAM scoping.

## Consolidated Summary Confirmation

- Region and environments: inherited unchanged from auth-unit's Infrastructure Design (`ap-south-1`, Amplify Hosting git-branch model).
- S3 bucket: `BlockPublicAccess.BLOCK_ALL`, SSE-S3 encryption, Versioning OFF, 7-day incomplete-multipart-upload lifecycle rule — all already fixed at NFR Design, restated here as concrete bucket configuration.
- `Document` DynamoDB table: on-demand capacity, AWS-managed encryption — no new decision.
- Compute (revised at this stage's review, R-01/R-02): one shared Lambda backs all four S3-touching operations — `getDocumentDownloadUrl`, `createDocumentUploadUrl`, `confirmDocumentUpload`, and `deleteDocument` — since AppSync direct resolvers cannot call the AWS SDK for pre-signed-URL signing, `DeleteObject`, or the `Document` table reads/writes these operations need. Only `listDocuments` remains a plain direct resolver. IAM role (fully corrected): S3 `PutObject`/`GetObject`/`HeadObject`/`DeleteObject` scoped to the bucket, plus DynamoDB `GetItem` (to resolve a `Document.id` to its `s3Key` for both `getDocumentDownloadUrl` and `deleteDocument`), `PutItem` (`confirmDocumentUpload` creates the record), and `DeleteItem` (`deleteDocument` removes it) scoped to the `Document` table.
- Contract fix (found at this stage's review): Contract 6's `confirmDocumentUpload(s3Key: String!)` never received `title`/`category`, yet the record it creates needs both — and `DocumentUploadTarget` was referenced but never defined. Fixed by amending Contract 6: `confirmDocumentUpload` now also takes `title`/`category` (the client re-supplies the same values it already used in `createDocumentUploadUrl`, since this API holds no server-side "pending upload" state), and `DocumentUploadTarget` is now defined as `{ uploadUrl, s3Key }`. `functional-spec.md`'s Upload Document workflow and this Unit's Lambda IAM rationale are both updated to match. Accepted risk (Minor, noted but not designed around further): an S3 object uploaded but never confirmed persists indefinitely with no `Document` record — low blast radius at this admin-only, low-volume path.

Does this all look correct before I generate the artifacts?

- Looks correct
- Request changes

[Answer]: Looks correct
