/**
 * pdf-library-unit (U5) — shared constants for the `document-api` Lambda and
 * the Amplify Data schema.
 *
 * This file is imported by Lambda code AND by `amplify/data/resource.ts`, so
 * it must stay free of `@aws-amplify/backend` and CDK imports: the schema
 * pulls Contract 6's enum values and the index name from here, and the Lambda
 * validates against the very same constants (one source of truth, the same
 * arrangement `donation-shared/types.ts` uses).
 */

/** Contract 6 `DocumentCategory` values, verbatim (BR6.1 — the fixed category list). */
export const DOCUMENT_CATEGORIES = ['DAILY_POOJAN', 'VARIOUS_VIDHAANS', 'BHAKTAMAR'] as const;

/** Secondary index on the `Document` model: `category`, sorted by `uploadedAt` (browse by category is a Query). */
export const DOCUMENT_CATEGORY_INDEX = 'categoryIndex';

/**
 * NFR-SEC.1.1 (security-requirements.md, unchanged at NFR Design): a
 * pre-signed UPLOAD URL is valid for 15 minutes ...
 */
export const UPLOAD_URL_EXPIRES_SECONDS = 15 * 60;

/** ... and a pre-signed DOWNLOAD URL for 1 hour (NFR-SEC.1.1). */
export const DOWNLOAD_URL_EXPIRES_SECONDS = 60 * 60;

/**
 * Every object this Unit issues lives under this prefix; the Lambda's IAM
 * policy (`amplify/backend.ts`) is scoped to `<bucket>/documents/*` and
 * `parseS3Key` refuses any key outside it.
 */
export const DOCUMENT_KEY_PREFIX = 'documents/';

/** The only content type `confirmDocumentUpload` accepts (BR6.2). */
export const PDF_CONTENT_TYPE = 'application/pdf';

/**
 * Technical bound on `title`, not a business rule: it keeps a single
 * DynamoDB attribute and the app's list rows sane. Contract 6 puts no
 * business limit on titles.
 */
export const MAX_TITLE_LENGTH = 200;
