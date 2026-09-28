/**
 * reminder-unit (U7) — Contract 8 classification: turns a raw DynamoDB
 * Streams record from feed-unit's `Post` table into one of the two domain
 * events, or `Ignored`. Pure — no I/O.
 *
 * Contract 8 (amended): feed-unit SOFT-deletes, so `PostDeleted` is a MODIFY
 * record whose `deletedAt` goes from absent/null to a value — never a REMOVE
 * record, which does not occur for a Post. `PostDateTimeChanged` is a MODIFY
 * whose `dateTime` differs between the OLD and NEW images. Anything else
 * (INSERT, REMOVE, an unrelated MODIFY) is `Ignored`. The stream carries
 * `NEW_AND_OLD_IMAGES` (feed-unit's `post-table-config.ts`), which is what
 * makes the OLD-vs-NEW diff possible.
 *
 * Images arrive in DynamoDB's attribute-value form (`{ S: '...' }`); only the
 * string attributes this Unit needs are read.
 */
import type { DynamoDBRecord } from 'aws-lambda';
import { dedupeKey } from './rules';

export type PostStreamEvent =
  | { kind: 'PostDeleted'; postId: string; dedupeKey: string }
  | { kind: 'PostDateTimeChanged'; postId: string; newDateTime: string; dedupeKey: string }
  | { kind: 'Ignored'; reason: string };

type Image = Record<string, { S?: string; NULL?: boolean } | undefined> | undefined;

function stringAttribute(image: Image, name: string): string | undefined {
  const value = image?.[name];
  if (!value || value.NULL || typeof value.S !== 'string' || value.S.length === 0) return undefined;
  return value.S;
}

/** Contract 8 classification of one stream record (see the file header). */
export function classifyPostRecord(record: DynamoDBRecord): PostStreamEvent {
  if (record.eventName !== 'MODIFY') {
    return { kind: 'Ignored', reason: `${record.eventName ?? 'unknown'} record` };
  }
  const oldImage = record.dynamodb?.OldImage as Image;
  const newImage = record.dynamodb?.NewImage as Image;
  const postId = stringAttribute(newImage, 'id') ?? stringAttribute(oldImage, 'id');
  if (!postId) return { kind: 'Ignored', reason: 'record without a post id' };
  const updatedAt = stringAttribute(newImage, 'updatedAt') ?? record.dynamodb?.SequenceNumber ?? '';
  const key = dedupeKey(postId, updatedAt);

  const wasDeleted = stringAttribute(oldImage, 'deletedAt') !== undefined;
  const isDeleted = stringAttribute(newImage, 'deletedAt') !== undefined;
  if (!wasDeleted && isDeleted) return { kind: 'PostDeleted', postId, dedupeKey: key };

  const oldDateTime = stringAttribute(oldImage, 'dateTime');
  const newDateTime = stringAttribute(newImage, 'dateTime');
  if (newDateTime !== undefined && oldDateTime !== newDateTime) {
    return { kind: 'PostDateTimeChanged', postId, newDateTime, dedupeKey: key };
  }
  return { kind: 'Ignored', reason: 'MODIFY without a delete or dateTime change' };
}
