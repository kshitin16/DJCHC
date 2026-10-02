/**
 * pdf-library-unit (U5) — `document-api` Lambda declaration.
 *
 * The one shared function the infrastructure specification fixes for this
 * Unit. It backs ALL FIVE Contract 6 operations as an AppSync Lambda
 * resolver — the four S3-touching ones the spec names
 * (`getDocumentDownloadUrl`, `createDocumentUploadUrl`,
 * `confirmDocumentUpload`, `deleteDocument`) plus the public `listDocuments`,
 * which joins it because the installed `@aws-amplify/data-schema` refuses the
 * identity-pool guest rule (`allow.guest()`, BR6.5) on a no-Lambda custom
 * resolver — the same constraint feed-unit's `listPosts` hit (plan "Known
 * deviations"). See `./handler.ts` for the logic and the rules it realizes.
 *
 * Sizing: 128MB / 10s (infrastructure-specification.md) — pre-signed URL
 * signing is a local SDK operation; `HeadObject`/`DeleteObject` and the
 * DynamoDB calls are single-item round trips. No PDF bytes ever pass through
 * this function (BR6.2: the file goes client → S3 directly).
 *
 * Environment (both injected by `amplify/backend.ts`):
 * - `DOCUMENT_TABLE_NAME`  — the Amplify-Data-generated `Document` table.
 * - `DOCUMENT_BUCKET_NAME` — the `defineStorage` bucket holding the PDFs.
 *
 * `resourceGroupName: 'data'` places this function in the data stack: the
 * schema references it as a handler AND it reads the `Document` table name,
 * which would otherwise be a circular dependency between the two stacks
 * (as with `feed-api`). The bucket name is a one-way data → storage
 * reference, which is why the storage resource grants this function nothing
 * itself (see `amplify/storage/resource.ts`).
 */
import { defineFunction } from '@aws-amplify/backend';

export const documentApi = defineFunction({
  name: 'document-api',
  entry: './handler.ts',
  memoryMB: 128,
  timeoutSeconds: 10,
  resourceGroupName: 'data',
  logging: {
    // 30 days — the project default (NFR-OBS.2), as resolved at Observability Setup Q2: CloudWatch
    // sets retention per log GROUP, not per level, so the per-level
    // split NFR-OBS.2 asked for cannot be configured. Unset means
    // logs are kept forever, which is both a cost and a privacy leak.
    retention: '1 month',
  },
});
