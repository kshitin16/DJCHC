/**
 * suggestion-unit (U3) — data access for the `Suggestion` table and the
 * internal `SuggestionDailyCount` counter table.
 *
 * A thin class over `DynamoDBDocumentClient` (injected, so tests pass a fake
 * that records each command), in the shape of `document-shared/
 * document-repository.ts`.
 *
 * - `create`                 one `PutItem`, conditioned on the id being new.
 * - `listAll`                a Scan for `allSuggestions`, following
 *                            `LastEvaluatedKey` until the table is fully read
 *                            (performance-design.md: the 1MB page cap at the
 *                            ~1500-row ceiling). Ordering is the caller's job.
 * - `tryIncrementDailyCount` BR3.5 / NFR-RATE.1: ONE atomic conditional
 *                            `UpdateItem` that both checks and increments the
 *                            caller's counter for the IST day — never a
 *                            read-then-write (project.md Correction). The
 *                            condition `attribute_not_exists(#count) OR
 *                            #count < :five` failing is the "over the limit"
 *                            signal and returns `{ allowed: false }`; the row's
 *                            `ttl` is set in the same request with
 *                            `if_not_exists` so the first increment of the day
 *                            stamps it and later ones leave it alone.
 *
 * Error handling (integration boundary): `ConditionalCheckFailedException`
 * is the one EXPECTED failure and is mapped to a result; anything else
 * (throttling, IAM, network) is rethrown unchanged so the Lambda fails loudly.
 */
import {
  PutCommand,
  ScanCommand,
  UpdateCommand,
  type DynamoDBDocumentClient,
} from '@aws-sdk/lib-dynamodb';
import { DAILY_LIMIT } from './rules';
import type { DailyCountResult, NewSuggestion, SuggestionRecord } from './types';

/** The one method the repository needs — satisfied by a real `DynamoDBDocumentClient` or a test fake. */
export type SuggestionClientLike = Pick<DynamoDBDocumentClient, 'send'>;

/** What the handlers depend on; `SuggestionRepository` implements it, tests fake it. */
export interface SuggestionRepositoryLike {
  create(suggestion: NewSuggestion): Promise<SuggestionRecord>;
  listAll(): Promise<SuggestionRecord[]>;
  tryIncrementDailyCount(
    sub: string,
    istDate: string,
    ttlEpochSeconds: number,
  ): Promise<DailyCountResult>;
}

export interface SuggestionRepositoryOptions {
  /** env `SUGGESTION_TABLE_NAME` */
  tableName: string;
  /** env `SUGGESTION_DAILY_COUNT_TABLE_NAME`; optional for the read-only `allSuggestions` Lambda. */
  dailyCountTableName?: string;
}

/** The counter row's key: `<sub>#<YYYY-MM-DD in Asia/Kolkata>` (entities.md). */
export function dailyCountKey(sub: string, istDate: string): string {
  return `${sub}#${istDate}`;
}

function isConditionalCheckFailure(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { name?: unknown }).name === 'ConditionalCheckFailedException'
  );
}

export class SuggestionRepository implements SuggestionRepositoryLike {
  private readonly tableName: string;
  private readonly dailyCountTableName: string | undefined;

  constructor(
    private readonly client: SuggestionClientLike,
    options: SuggestionRepositoryOptions,
  ) {
    if (!options.tableName) {
      throw new Error('SuggestionRepository: tableName is required (env SUGGESTION_TABLE_NAME)');
    }
    this.tableName = options.tableName;
    this.dailyCountTableName = options.dailyCountTableName || undefined;
  }

  /**
   * Submit Suggestion step 4: written only AFTER the atomic counter admitted
   * the submission. `submittedByGoogleId` is stored exactly as the caller's
   * `sub` (no `::username` suffix) so the model's owner rule matches (BR3.3).
   */
  async create(suggestion: NewSuggestion): Promise<SuggestionRecord> {
    const record: SuggestionRecord = {
      ...suggestion,
      createdAt: suggestion.submittedAt,
      updatedAt: suggestion.submittedAt,
    };
    await this.client.send(
      new PutCommand({
        TableName: this.tableName,
        Item: { ...record, __typename: 'Suggestion' },
        ConditionExpression: 'attribute_not_exists(id)',
      }),
    );
    return record;
  }

  /** `allSuggestions`: the whole table, every page. Ordering is the caller's job. */
  async listAll(): Promise<SuggestionRecord[]> {
    const rows: SuggestionRecord[] = [];
    let exclusiveStartKey: Record<string, unknown> | undefined;
    do {
      const page = await this.client.send(
        new ScanCommand({ TableName: this.tableName, ExclusiveStartKey: exclusiveStartKey }),
      );
      rows.push(...((page.Items ?? []) as SuggestionRecord[]));
      exclusiveStartKey = page.LastEvaluatedKey;
    } while (exclusiveStartKey);
    return rows;
  }

  /** BR3.5: the atomic check-and-increment described in the file header. */
  async tryIncrementDailyCount(
    sub: string,
    istDate: string,
    ttlEpochSeconds: number,
  ): Promise<DailyCountResult> {
    if (!this.dailyCountTableName) {
      throw new Error(
        'SuggestionRepository: dailyCountTableName is required (env SUGGESTION_DAILY_COUNT_TABLE_NAME)',
      );
    }
    try {
      await this.client.send(
        new UpdateCommand({
          TableName: this.dailyCountTableName,
          Key: { id: dailyCountKey(sub, istDate) },
          UpdateExpression: 'ADD #count :one SET #ttl = if_not_exists(#ttl, :ttl)',
          ConditionExpression: 'attribute_not_exists(#count) OR #count < :five',
          ExpressionAttributeNames: { '#count': 'count', '#ttl': 'ttl' },
          ExpressionAttributeValues: { ':one': 1, ':five': DAILY_LIMIT, ':ttl': ttlEpochSeconds },
        }),
      );
      return { allowed: true };
    } catch (error) {
      if (isConditionalCheckFailure(error)) {
        return { allowed: false };
      }
      throw error;
    }
  }
}
