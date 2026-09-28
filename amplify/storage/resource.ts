/**
 * pdf-library-unit (U5) — the S3 bucket holding the library's PDF files.
 *
 * The project's first (and only) storage resource. Nothing but the
 * `document-api` Lambda ever touches an object in it, and every client read
 * or write goes through a pre-signed URL that Lambda issues
 * (`infrastructure-specification.md`: "no direct bucket access of any kind").
 *
 * ## Why there is deliberately NO `access` block
 *
 * - No user-facing grant (`allow.authenticated`/`allow.guest`/`allow.groups`)
 *   on purpose: the app never calls `Storage` APIs against this bucket; a
 *   guest role with `read` on `documents/*` would give an anonymous caller a
 *   never-expiring path to the files and silently defeat the 1-hour
 *   download-URL expiration (NFR-SEC.1.1 / NFR-SEC.1.2).
 * - No `allow.resource(documentApi)` either, although the plan proposed it:
 *   that grant creates the IAM policy inside the STORAGE stack and attaches
 *   it to the Lambda's role in the DATA stack (storage → data), while
 *   `amplify/backend.ts` hands the Lambda the bucket name (data → storage).
 *   The two references together form a CloudFormation cross-stack cycle.
 *   The Lambda's S3 permissions are therefore granted ONLY by the explicit
 *   least-privilege `PolicyStatement` in `amplify/backend.ts`, scoped to
 *   `<bucket>/documents/*` — which the plan requires anyway.
 *
 * ## Bucket hardening (security-design.md, applied in `amplify/backend.ts`)
 *
 * `defineStorage` itself gives `versioned: false` (BR6.4 hard delete depends
 * on it staying off) and `enforceSSL` (NFR4.1 in transit). `backend.ts`
 * additionally pins, on the L1 bucket: `BlockPublicAccess.BLOCK_ALL`
 * (NFR-SEC.1.2), SSE-S3 default encryption (NFR4.1 at rest) and the
 * `AbortIncompleteMultipartUpload` after 7 days lifecycle rule (Q3).
 */
import { defineStorage } from '@aws-amplify/backend';

export const storage = defineStorage({
  name: 'sarovar-jinalaya-documents',
  versioned: false,
});
