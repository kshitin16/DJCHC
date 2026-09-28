/**
 * feed-unit (U2) — AppSync Lambda resolver for `Query.listPosts` (Contract 3):
 * the PUBLIC feed (plan Revision 2).
 *
 * Rules realized: BR2.4 (non-deleted posts whose `dateTime` is within 1 day
 * of now or in the future, most recent first), BR2.6 (a soft-deleted post is
 * never returned), NFR-AUTHZ.1 / FR1.3 / FR2.6 (public read).
 *
 * ## Who enforces what (project.md Correction: never leave implicit)
 *
 * - AppSync (declarative, server-side): `listPosts` carries `allow.guest()`
 *   + `allow.authenticated()` in `amplify/data/resource.ts`, so an anonymous
 *   caller reaches this code through the Cognito Identity Pool's
 *   unauthenticated role and a signed-in caller through their User Pool
 *   token. Nothing else is gated: the feed is public by design, and this
 *   handler reads no identity.
 * - reminder-unit's `myReminders` Lambda will later reach this operation
 *   through `allow.resource(fn)` on the same query (its own Code Generation).
 *
 * ## Why a Scan
 *
 * `scalability-design.md` sizes the `Post` table at a few hundred rows for
 * the app's lifetime; a filtered Scan reads them in one or two pages and an
 * index would add cost without benefit today. `LastEvaluatedKey` IS followed
 * until exhausted, so a page boundary never drops a post. If the table ever
 * grows into the thousands, add a GSI `feedIndex` on a constant partition key
 * (e.g. `feed = "FEED"`) with `dateTime` as sort key and switch to a `Query`
 * with `ScanIndexForward: false`; the rest of this file stays the same.
 *
 * ## The invariant the filter relies on
 *
 * `dateTime >= :cutoff` is a DynamoDB STRING comparison. It is exact because
 * `createPost`/`updatePost` store `dateTime` in canonical UTC form
 * (`YYYY-MM-DDTHH:mm:ss.SSSZ`) and `ageOutCutoffIso` produces the same form.
 * `isVisibleInFeed` is still applied to every returned row as defense in
 * depth (a row written by any other path is judged by the same rule).
 *
 * The shared rules are imported from `post-shared/post-rules.ts`: Lambdas are
 * bundled by esbuild, unlike the verbatim-uploaded AppSync JS resolvers.
 */
import type { AppSyncResolverEvent } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import {
  ageOutCutoffIso,
  isVisibleInFeed,
  sortMostRecentFirst,
} from '../../data/post-shared/post-rules';

/** The one method the handler needs — a real `DynamoDBDocumentClient` or a test fake. */
export type DocumentClientLike = Pick<DynamoDBDocumentClient, 'send'>;

/** A stored row of the `Post` table (`entities.md`). */
export interface StoredPost {
  id: string;
  type: string;
  title: string;
  description: string;
  dateTime: string;
  createdByGoogleId: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  __typename?: string;
}

/** Contract 3's `Post` as returned to clients: the stored row without `deletedAt`. */
export type PublicPost = Omit<StoredPost, 'deletedAt' | '__typename'>;

export interface FeedApiDeps {
  client: DocumentClientLike;
  tableName: string;
  now?: () => string;
}

/** `listPosts` takes no arguments (Contract 3). */
export type FeedApiEvent = AppSyncResolverEvent<Record<string, never>>;

/** Strips the persistence-only attributes (`deletedAt`, `__typename`). */
export function toPublicPost(post: StoredPost): PublicPost {
  return {
    id: post.id,
    type: post.type,
    title: post.title,
    description: post.description,
    dateTime: post.dateTime,
    createdByGoogleId: post.createdByGoogleId,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
  };
}

/**
 * Builds the resolver from injected dependencies (real clients in
 * `handler`, fakes in tests).
 */
export function createHandler(deps: FeedApiDeps) {
  if (!deps.tableName) {
    throw new Error('feed-api: tableName is required (env POST_TABLE_NAME)');
  }
  const now = deps.now ?? (() => new Date().toISOString());

  return async (event: FeedApiEvent): Promise<PublicPost[]> => {
    if (event.info.fieldName !== 'listPosts') {
      throw new Error(`feed-api: unsupported operation ${event.info.fieldName}`);
    }
    const nowIso = now();
    const cutoff = ageOutCutoffIso(nowIso);

    // BR2.4 + BR2.6, pushed into the data source; every page is followed.
    const rows: StoredPost[] = [];
    let exclusiveStartKey: Record<string, unknown> | undefined;
    do {
      const page = await deps.client.send(
        new ScanCommand({
          TableName: deps.tableName,
          FilterExpression: 'attribute_not_exists(#deletedAt) AND #dateTime >= :cutoff',
          ExpressionAttributeNames: { '#deletedAt': 'deletedAt', '#dateTime': 'dateTime' },
          ExpressionAttributeValues: { ':cutoff': cutoff },
          ExclusiveStartKey: exclusiveStartKey,
        }),
      );
      rows.push(...((page.Items ?? []) as StoredPost[]));
      exclusiveStartKey = page.LastEvaluatedKey;
    } while (exclusiveStartKey);

    // Defense in depth: the same rule the filter expresses, applied in code.
    const visible = rows.filter((post) => isVisibleInFeed(post, nowIso));
    return sortMostRecentFirst(visible).map(toPublicPost);
  };
}

// --- Lambda entry point: real client, built lazily on first use -----------
let realDeps: FeedApiDeps | undefined;

function realDependencies(): FeedApiDeps {
  realDeps ??= {
    client: DynamoDBDocumentClient.from(new DynamoDBClient({})),
    tableName: process.env.POST_TABLE_NAME ?? '',
  };
  return realDeps;
}

export const handler = async (event: FeedApiEvent): Promise<PublicPost[]> =>
  createHandler(realDependencies())(event);
