# Tech Stack Decisions — pdf-library-unit

| Choice | Selection | Rationale |
|---|---|---|
| File storage | S3, direct-to-S3 upload/download via pre-signed URLs | Fixed from Domain/Contract Design; avoids routing large PDF bytes through AppSync/Lambda payload limits |
| Pre-signed URL expiration | Upload: 15 min. Download: 1 hour (Q1) | Bounds the exposure window of a leaked URL; closes the disclosed replay-protection gap (NFR-SEC.1) |
| Encryption at rest | S3 default server-side encryption (SSE-S3) | Simplest option satisfying NFR4's blanket encryption requirement; no per-object KMS key management needed at this scale |
| Client SDK | `amplify_storage` (S3) + `amplify_api` (GraphQL) via `services/pdf_service.dart` | Matches team.md's firm layer-boundary rule |

No new technology beyond what Domain Design/Contract Design already fixed — this stage sets concrete NFR targets (especially pre-signed URL security) against that already-chosen stack.
