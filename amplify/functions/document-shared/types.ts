/**
 * pdf-library-unit (U5) — shared domain types for the `document-api` Lambda.
 *
 * Free of `@aws-amplify/backend` and CDK imports for the same reason as
 * `constants.ts`: `amplify/data/resource.ts` may import from this directory.
 */
import { DOCUMENT_CATEGORIES } from './constants';

export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number];

/**
 * The `Document` item as stored in DynamoDB and returned by Contract 6:
 * exactly `entities.md`'s attributes, plus Amplify Data's implicit
 * `createdAt`/`updatedAt` model timestamps. The `@model` transformer adds
 * those two non-null fields to the GraphQL `Document` type whether or not the
 * schema declares them, so the repository writes both (equal to `uploadedAt`)
 * to keep a client that selects them from hitting a null-for-non-null error.
 */
export interface DocumentRecord {
  id: string;
  title: string;
  category: DocumentCategory;
  s3Key: string;
  uploadedByGoogleId: string;
  uploadedAt: string;
  createdAt: string;
  updatedAt: string;
}

/** What `create` needs — the repository stamps `createdAt`/`updatedAt` from `uploadedAt`. */
export type NewDocument = Omit<DocumentRecord, 'createdAt' | 'updatedAt'>;

/** Contract 6's `DocumentUploadTarget`: the pre-signed PUT URL and the key to confirm later. */
export interface DocumentUploadTarget {
  uploadUrl: string;
  s3Key: string;
}
