/**
 * pdf-library-unit (U5) — input validation at the `document-api` boundary.
 *
 * Pure functions, no I/O. Every argument that reaches the Lambda from AppSync
 * passes through here before any S3 or DynamoDB call (Construction guardrail:
 * validate and sanitize all inputs at system boundaries). AppSync already
 * type-checks the GraphQL arguments; these checks are the semantic layer on
 * top, and they are what stops the Lambda from acting on a key it did not
 * itself issue.
 *
 * - `validateCategory`   BR6.1 — one of the three fixed values.
 * - `validateTitle`      a technical bound (non-empty, trimmed, <= 200
 *                        chars), not a business rule; see `MAX_TITLE_LENGTH`.
 * - `isPdfContentType`   BR6.2 — `application/pdf`, case-insensitive,
 *                        ignoring any `; charset=` parameter.
 * - `buildS3Key`         the ONLY key shape this Unit issues:
 *                        `documents/<CATEGORY>/<uuid>.pdf`.
 * - `parseS3Key`         the inverse, and the security check on
 *                        `confirmDocumentUpload`'s `s3Key` argument: an admin
 *                        can only confirm a key of exactly that shape —
 *                        anything outside `documents/`, any path traversal,
 *                        any unknown category, any non-UUID name is refused,
 *                        so the Lambda's `documents/*`-scoped IAM grant is
 *                        never asked to touch anything else.
 */
import {
  DOCUMENT_CATEGORIES,
  DOCUMENT_KEY_PREFIX,
  MAX_TITLE_LENGTH,
  PDF_CONTENT_TYPE,
} from './constants';
import { DocumentValidationError } from './errors';
import type { DocumentCategory } from './types';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isDocumentCategory(value: unknown): value is DocumentCategory {
  return typeof value === 'string' && (DOCUMENT_CATEGORIES as readonly string[]).includes(value);
}

/** BR6.1: rejects anything but the three fixed category values. */
export function validateCategory(value: unknown): DocumentCategory {
  if (!isDocumentCategory(value)) {
    throw new DocumentValidationError(`category must be one of ${DOCUMENT_CATEGORIES.join(', ')}`);
  }
  return value;
}

/** Technical bound only: a non-empty, trimmed title of at most `MAX_TITLE_LENGTH` characters. */
export function validateTitle(value: unknown): string {
  if (typeof value !== 'string') {
    throw new DocumentValidationError('title is required');
  }
  const title = value.trim();
  if (title.length === 0) {
    throw new DocumentValidationError('title must not be empty');
  }
  if (title.length > MAX_TITLE_LENGTH) {
    throw new DocumentValidationError(`title must be at most ${MAX_TITLE_LENGTH} characters`);
  }
  return title;
}

/** BR6.2: is this the content type of a PDF? (`application/pdf`, any case, parameters ignored.) */
export function isPdfContentType(contentType: string | undefined): boolean {
  if (!contentType) return false;
  const mediaType = contentType.split(';')[0].trim().toLowerCase();
  return mediaType === PDF_CONTENT_TYPE;
}

/** The one key shape this Unit ever issues: `documents/<CATEGORY>/<uuid>.pdf`. */
export function buildS3Key(category: DocumentCategory, id: string): string {
  return `${DOCUMENT_KEY_PREFIX}${category}/${id}.pdf`;
}

export interface ParsedS3Key {
  category: DocumentCategory;
  id: string;
}

/**
 * Accepts ONLY a key `buildS3Key` could have produced. Rejects foreign
 * prefixes, path traversal (`..`, backslashes, doubled or leading slashes),
 * unknown categories and non-UUID object names — all with the same
 * validation error, so a probing caller learns nothing about the bucket.
 */
export function parseS3Key(value: unknown): ParsedS3Key {
  const reject = () =>
    new DocumentValidationError('s3Key was not issued by createDocumentUploadUrl');
  if (typeof value !== 'string' || !value.startsWith(DOCUMENT_KEY_PREFIX)) throw reject();
  if (value.includes('..') || value.includes('\\')) throw reject();

  const parts = value.split('/');
  if (parts.length !== 3) throw reject();
  const [, category, fileName] = parts;
  if (!isDocumentCategory(category)) throw reject();
  if (!fileName.endsWith('.pdf')) throw reject();
  const id = fileName.slice(0, -'.pdf'.length);
  if (!UUID_PATTERN.test(id)) throw reject();

  return { category, id };
}
