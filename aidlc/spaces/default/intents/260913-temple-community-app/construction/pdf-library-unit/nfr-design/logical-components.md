# Logical Components — pdf-library-unit

## Component inventory

| Component | Nature | Failure domain |
|---|---|---|
| `Document` DynamoDB table | Data store, shared Amplify Data backend | Shared AWS region/account failure domain, same as every other Unit's tables |
| S3 bucket | Dedicated to this Unit, `BlockPublicAccess.BLOCK_ALL` (Q1), SSE-S3 encryption, 7-day incomplete-multipart-upload lifecycle rule (Q3) | Isolated to this Unit — no other Unit reads or writes this bucket |
| AppSync resolvers (list, getDownloadUrl, createUploadUrl, confirmUpload, delete) | Part of the shared AppSync API | Shared, same as `Document` table |

## Blast radius

This is the second Unit (after donation-unit) with a dedicated AWS resource fully isolated from every other Unit — the S3 bucket belongs exclusively to this Unit, with no cross-Unit read/write coupling of the kind feed-unit's Streams boundary has with reminder-unit. A bug or misconfiguration here (e.g. an incorrect bucket policy) affects only this Unit's file storage, never another Unit's data.

## Shared resources

None shared with another Unit's own components — the `Document` table and the S3 bucket are both exclusively this Unit's.
