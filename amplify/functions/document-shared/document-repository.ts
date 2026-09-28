/**
 * pdf-library-unit (U5) — data access for the `Document` table.
 *
 * A thin class over `DynamoDBDocumentClient` (injected, so tests pass a fake
 * that records each command), in the shape of `donation-shared/
 * donation-repository.ts`. There is no state machine here: a `Document`
 * exists from `create` until `deleteById` hard-deletes it (BR6.4).
 *
 * - `create`         one `PutItem`, conditioned on the id being new.
 * - `getById`        `getDocumentDownloadUrl` / `deleteDocument` resolve
 *                    `id` → `s3Key` here before touching S3.
 * - `listByCategory` a Query on `categoryIndex` (BR6.5 browse by category),
 *                    newest first; every page is followed.
 * - `listAll`        a Scan for `listDocuments` with no category — the
 *                    table is sized at a few dozen rows (performance-design.md);
 *                    every page is followed.
 * - `deleteById`     one `DeleteItem`, conditioned on the row existing, so
 *                    a concurrent delete surfaces as "not found" rather than
 *                    a silent no-op.
 *
 * Error handling (integration boundary): a `ConditionalCheckFailedException`
 * is the one expected failure and is mapped to a typed error; anything else
 * (throttling, IAM, network) is rethrown unchanged so the Lambda fails
 * loudly rather than guessing.
 */
import {
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  ScanCommand,
  type DynamoDBDocumentClient,
} from '@aws-sdk/lib-dynamodb';
import { DOCUMENT_CATEGORY_INDEX } from './constants';
import { DocumentNotFoundError } from './errors';
import type { DocumentCategory, DocumentRecord, NewDocument } from './types';

/** The one method the repository needs — satisfied by a real `DynamoDBDocumentClient` or a test fake. */
export type DocumentClientLike = Pick<DynamoDBDocumentClient, 'send'>;

/** What the handler depends on; `DocumentRepository` implements it, tests fake it. */
export interface DocumentRepositoryLike {
  create(document: NewDocument): Promise<DocumentRecord>;
  getById(id: string): Promise<DocumentRecord | undefined>;
  listByCategory(category: DocumentCategory): Promise<DocumentRecord[]>;
  listAll(): Promise<DocumentRecord[]>;
  deleteById(id: string): Promise<void>;
}

export interface DocumentRepositoryOptions {
  tableName: string;
}

function isConditionalCheckFailure(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { name?: unknown }).name === 'ConditionalCheckFailedException'
  );
}

export class DocumentRepository implements DocumentRepositoryLike {
  private readonly tableName: string;

  constructor(
    private readonly client: DocumentClientLike,
    options: DocumentRepositoryOptions,
  ) {
    if (!options.tableName) {
      throw new Error('DocumentRepository: tableName is required (env DOCUMENT_TABLE_NAME)');
    }
    this.tableName = options.tableName;
  }

  /**
   * Upload Document step 5: the record is written only after the object has
   * been verified as a PDF (BR6.2). `createdAt`/`updatedAt` are Amplify's
   * implicit model timestamps (see `types.ts`), stamped from `uploadedAt`.
   */
  async create(document: NewDocument): Promise<DocumentRecord> {
    const record: DocumentRecord = {
      ...document,
      createdAt: document.uploadedAt,
      updatedAt: document.uploadedAt,
    };
    await this.client.send(
      new PutCommand({
        TableName: this.tableName,
        Item: { ...record, __typename: 'Document' },
        ConditionExpression: 'attribute_not_exists(id)',
      }),
    );
    return record;
  }

  async getById(id: string): Promise<DocumentRecord | undefined> {
    const result = await this.client.send(
      new GetCommand({ TableName: this.tableName, Key: { id } }),
    );
    return result.Item as DocumentRecord | undefined;
  }

  /** BR6.5 browse by category: `categoryIndex`, newest `uploadedAt` first, all pages. */
  async listByCategory(category: DocumentCategory): Promise<DocumentRecord[]> {
    const rows: DocumentRecord[] = [];
    let exclusiveStartKey: Record<string, unknown> | undefined;
    do {
      const page = await this.client.send(
        new QueryCommand({
          TableName: this.tableName,
          IndexName: DOCUMENT_CATEGORY_INDEX,
          KeyConditionExpression: 'category = :category',
          ExpressionAttributeValues: { ':category': category },
          ScanIndexForward: false,
          ExclusiveStartKey: exclusiveStartKey,
        }),
      );
      rows.push(...((page.Items ?? []) as DocumentRecord[]));
      exclusiveStartKey = page.LastEvaluatedKey;
    } while (exclusiveStartKey);
    return rows;
  }

  /** `listDocuments` with no category: the whole (small) table, all pages. Ordering is the caller's job. */
  async listAll(): Promise<DocumentRecord[]> {
    const rows: DocumentRecord[] = [];
    let exclusiveStartKey: Record<string, unknown> | undefined;
    do {
      const page = await this.client.send(
        new ScanCommand({ TableName: this.tableName, ExclusiveStartKey: exclusiveStartKey }),
      );
      rows.push(...((page.Items ?? []) as DocumentRecord[]));
      exclusiveStartKey = page.LastEvaluatedKey;
    } while (exclusiveStartKey);
    return rows;
  }

  /**
   * Delete Document step 3 (BR6.4): called only AFTER the S3 object is gone.
   * Conditioned on the row existing so a lost race with another delete is
   * reported as not-found instead of silently succeeding.
   */
  async deleteById(id: string): Promise<void> {
    try {
      await this.client.send(
        new DeleteCommand({
          TableName: this.tableName,
          Key: { id },
          ConditionExpression: 'attribute_exists(id)',
        }),
      );
    } catch (error) {
      if (isConditionalCheckFailure(error)) {
        throw new DocumentNotFoundError(`Document ${id} was not found`);
      }
      throw error;
    }
  }
}
