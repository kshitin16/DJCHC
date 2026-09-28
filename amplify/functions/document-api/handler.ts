/**
 * pdf-library-unit (U5) — AppSync Lambda resolver for the five Contract 6
 * operations (`listDocuments`, `getDocumentDownloadUrl`,
 * `createDocumentUploadUrl`, `confirmDocumentUpload`, `deleteDocument`).
 *
 * Rules realized: BR6.1 (fixed categories), BR6.2 (PDF check at confirm
 * time, non-PDF object removed), BR6.3 (admin-only upload/delete —
 * backstop), BR6.4 (hard delete, S3 file FIRST), BR6.5 (public browse and
 * download), NFR-SEC.1.1 (URL lifetimes, via `S3Adapter`).
 *
 * ## Who enforces what (project.md Correction: never leave implicit)
 *
 * - AppSync (declarative, server-side — THE enforcing layer): in
 *   `amplify/data/resource.ts`, `listDocuments` and `getDocumentDownloadUrl`
 *   carry `allow.guest()` + `allow.authenticated()` (BR6.5); the three admin
 *   operations carry `allow.group('Admin')` ONLY, so a caller without the
 *   Contract 2 group never reaches this code.
 * - This handler (defense-in-depth BACKSTOP): `requireAdmin` re-checks
 *   `event.identity.groups` on the three admin operations and throws
 *   otherwise. Identity is read ONLY from `event.identity`, which AppSync
 *   fills from the verified JWT — never from arguments or headers.
 * - Flutter screens (flutter-app-unit): UX convenience only.
 *
 * ## The upload flow (functional-spec.md, Upload Document)
 *
 * 1. `createDocumentUploadUrl(title, category)` validates, mints a UUID and
 *    the key `documents/<category>/<uuid>.pdf`, and returns a 15-minute
 *    pre-signed PUT. NO record is written yet.
 * 2. The admin's client PUTs the bytes straight to S3 (never through here).
 * 3. `confirmDocumentUpload(s3Key, title, category)` accepts only a key this
 *    Unit could have issued (`parseS3Key`), checks the object exists and is
 *    a PDF (`HeadObject`), deletes it if it is not (BR6.2), and only then
 *    creates the `Document` record with `uploadedByGoogleId` = the caller's
 *    `sub`. The record's `id` is the UUID embedded in the key, so a retried
 *    confirm of the same key hits the repository's `attribute_not_exists(id)`
 *    condition instead of creating a duplicate.
 *
 * ## Delete ordering (BR6.4)
 *
 * S3 `DeleteObject` first, `DeleteItem` second. If the record delete fails
 * the error is surfaced so the admin retries: the retry's S3 delete is a
 * no-op and the record then goes. The reverse orphan (a file with no
 * record) can never be produced.
 */
import type { AppSyncResolverEvent } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { S3Client } from '@aws-sdk/client-s3';
import {
  DocumentRepository,
  type DocumentRepositoryLike,
} from '../document-shared/document-repository';
import {
  DocumentAuthorizationError,
  DocumentNotFoundError,
  DocumentValidationError,
} from '../document-shared/errors';
import { S3Adapter, type S3AdapterLike } from '../document-shared/s3-adapter';
import type { DocumentRecord, DocumentUploadTarget } from '../document-shared/types';
import {
  buildS3Key,
  isPdfContentType,
  parseS3Key,
  validateCategory,
  validateTitle,
} from '../document-shared/validation';

export interface DocumentApiDeps {
  repository: DocumentRepositoryLike;
  s3: S3AdapterLike;
  /** Injected clock so tests use fixed timestamps. */
  now?: () => string;
  /** Injected id generator so tests use fixed ids. */
  newId?: () => string;
}

/** The union of Contract 6 argument shapes; `fieldName` says which applies. */
export interface DocumentApiArguments {
  id?: string;
  title?: string;
  category?: string;
  s3Key?: string;
}

export type DocumentApiEvent = AppSyncResolverEvent<DocumentApiArguments>;

export type DocumentApiResult = DocumentRecord[] | DocumentRecord | DocumentUploadTarget | string;

interface CallerIdentity {
  sub: string;
  groups: string[];
}

/** Reads the caller from AppSync's verified identity; absent for guests and IAM callers. */
function callerIdentity(event: DocumentApiEvent): CallerIdentity | undefined {
  const identity = event.identity as { sub?: unknown; groups?: unknown } | null | undefined;
  if (!identity || typeof identity.sub !== 'string') return undefined;
  const groups = Array.isArray(identity.groups)
    ? identity.groups.filter((g): g is string => typeof g === 'string')
    : [];
  return { sub: identity.sub, groups };
}

/** BR6.3 backstop behind the declarative `allow.group('Admin')` rule. */
function requireAdmin(event: DocumentApiEvent): CallerIdentity {
  const caller = callerIdentity(event);
  if (!caller || !caller.groups.includes('Admin')) {
    throw new DocumentAuthorizationError();
  }
  return caller;
}

/** Newest upload first, deterministic on ties. */
export function sortNewestFirst(documents: DocumentRecord[]): DocumentRecord[] {
  return [...documents].sort(
    (a, b) => b.uploadedAt.localeCompare(a.uploadedAt) || a.id.localeCompare(b.id),
  );
}

/**
 * Builds the resolver from injected dependencies (real clients in
 * `handler`, fakes in tests).
 */
export function createHandler(deps: DocumentApiDeps) {
  const now = deps.now ?? (() => new Date().toISOString());
  const newId = deps.newId ?? (() => crypto.randomUUID());

  // --- BR6.5: public reads ---------------------------------------------------
  async function listDocuments(args: DocumentApiArguments): Promise<DocumentRecord[]> {
    const documents =
      args.category === undefined || args.category === null
        ? await deps.repository.listAll()
        : await deps.repository.listByCategory(validateCategory(args.category));
    return sortNewestFirst(documents);
  }

  async function getDocumentDownloadUrl(args: DocumentApiArguments): Promise<string> {
    if (!args.id) throw new DocumentValidationError('id is required');
    const document = await deps.repository.getById(args.id);
    if (!document) throw new DocumentNotFoundError();
    return deps.s3.presignDownload(document.s3Key);
  }

  // --- BR6.3: admin-only -----------------------------------------------------
  async function createDocumentUploadUrl(
    args: DocumentApiArguments,
  ): Promise<DocumentUploadTarget> {
    validateTitle(args.title);
    const category = validateCategory(args.category); // BR6.1, before any URL is issued
    const s3Key = buildS3Key(category, newId());
    const uploadUrl = await deps.s3.presignUpload(s3Key);
    return { uploadUrl, s3Key };
  }

  async function confirmDocumentUpload(
    args: DocumentApiArguments,
    caller: CallerIdentity,
  ): Promise<DocumentRecord> {
    const title = validateTitle(args.title);
    const category = validateCategory(args.category);
    const { id, category: keyCategory } = parseS3Key(args.s3Key);
    if (keyCategory !== category) {
      throw new DocumentValidationError('category does not match the s3Key it was issued for');
    }

    const head = await deps.s3.headObject(args.s3Key as string);
    if (!head.exists) {
      throw new DocumentNotFoundError('No uploaded file was found for this s3Key; upload it first');
    }
    if (!isPdfContentType(head.contentType)) {
      // BR6.2: the object is removed and no record is created.
      await deps.s3.deleteObject(args.s3Key as string);
      throw new DocumentValidationError('The uploaded file is not a PDF; it has been removed');
    }

    return deps.repository.create({
      id,
      title,
      category,
      s3Key: args.s3Key as string,
      uploadedByGoogleId: caller.sub,
      uploadedAt: now(),
    });
  }

  async function deleteDocument(args: DocumentApiArguments): Promise<string> {
    if (!args.id) throw new DocumentValidationError('id is required');
    const document = await deps.repository.getById(args.id);
    if (!document) throw new DocumentNotFoundError();
    // BR6.4: S3 first; a failure here leaves the record untouched.
    await deps.s3.deleteObject(document.s3Key);
    // Then the record; a failure here is surfaced so the caller retries.
    await deps.repository.deleteById(document.id);
    return document.id;
  }

  return async (event: DocumentApiEvent): Promise<DocumentApiResult> => {
    const args = event.arguments ?? {};
    switch (event.info.fieldName) {
      case 'listDocuments':
        return listDocuments(args);
      case 'getDocumentDownloadUrl':
        return getDocumentDownloadUrl(args);
      case 'createDocumentUploadUrl':
        requireAdmin(event);
        return createDocumentUploadUrl(args);
      case 'confirmDocumentUpload':
        return confirmDocumentUpload(args, requireAdmin(event));
      case 'deleteDocument':
        requireAdmin(event);
        return deleteDocument(args);
      default:
        throw new Error(`document-api: unsupported operation ${event.info.fieldName}`);
    }
  };
}

// --- Lambda entry point: real clients, built lazily on first use ----------
let realDeps: DocumentApiDeps | undefined;

function realDependencies(): DocumentApiDeps {
  realDeps ??= {
    repository: new DocumentRepository(DynamoDBDocumentClient.from(new DynamoDBClient({})), {
      tableName: process.env.DOCUMENT_TABLE_NAME ?? '',
    }),
    s3: new S3Adapter(new S3Client({}), {
      bucketName: process.env.DOCUMENT_BUCKET_NAME ?? '',
    }),
  };
  return realDeps;
}

export const handler = async (event: DocumentApiEvent): Promise<DocumentApiResult> =>
  createHandler(realDependencies())(event);
