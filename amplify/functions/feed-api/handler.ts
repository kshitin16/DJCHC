/**
 * feed-unit (U2) — AppSync Lambda resolver for the two Contract 3 LIST
 * operations: the public `Query.listPosts` feed and the admin-only
 * `Query.listAllPostsForAdmin` management view.
 *
 * Rules realized: BR2.4 (public feed shows non-deleted posts whose `dateTime`
 * is within 1 day of now or in the future, most recent first), BR2.6 (a
 * soft-deleted post is never returned by ANY read path), BR2.7 (the admin
 * view returns every non-deleted post with NO age-out filter, so an admin can
 * find and re-date a post that has left the public feed), NFR-AUTHZ.1 /
 * FR1.3 / FR2.6 (public read).
 *
 * ## Why BOTH list operations live here (Revision 1, review finding F-1)
 *
 * `listAllPostsForAdmin` was originally an AppSync JavaScript resolver
 * (`post-resolvers/listAllPostsForAdmin.js`, now deleted) issuing a single
 * unbounded `Scan`. That silently truncated: AppSync evaluates at most 100
 * items per Scan by default, that count includes the soft-deleted rows the
 * filter then discards, and the resolver read only the first page. Past
 * roughly 100 rows — well inside the few hundred `scalability-design.md`
 * projects — admins simply stopped seeing older posts, with no error and no
 * indication.
 *
 * It could not be fixed in place. An APPSYNC_JS unit resolver makes exactly
 * one data-source call per invocation, so it cannot follow `nextToken` itself;
 * the only alternative is to expose pagination through the GraphQL operation,
 * and Contract 3 declares `listAllPostsForAdmin: [Post!]!` with no arguments
 * and no pagination field. Inventing one would break the contract. Moving the
 * operation onto this Lambda keeps Contract 3's shape EXACTLY as written while
 * genuinely returning every row, because a Lambda can loop over pages.
 *
 * It also removes an asymmetry that was itself a maintenance trap: the public
 * and admin list paths now share one paginated `scanAllPages` implementation
 * and one page-size constant, so a pagination bug cannot reappear in one path
 * while the other stays correct.
 *
 * Why a Lambda existed here at all (plan Revision 2): the installed
 * `@aws-amplify/data-schema` refuses the identity-pool guest rule
 * (`allow.guest()`) on `a.handler.custom` operations, and the builder chose a
 * small function over an expiring API key so the public feed keeps the
 * guest-identity model the design intended. The four remaining admin
 * operations (`getPost`, `createPost`, `updatePost`, `deletePost`) are
 * single-item reads and writes with no pagination concern and stay
 * Lambda-free AppSync JavaScript resolvers.
 *
 * ## Who enforces what (project.md Correction: never leave implicit)
 *
 * - **`listPosts` — AppSync, declarative, server-side:** the operation carries
 *   `allow.guest()` + `allow.authenticated()` in `amplify/data/resource.ts`,
 *   so an anonymous caller reaches this code through the Cognito Identity
 *   Pool's unauthenticated role and a signed-in caller through their User Pool
 *   token. Nothing else is gated: the feed is public by design and this path
 *   reads no identity.
 * - **`listAllPostsForAdmin` — the ENFORCING layer is the declarative
 *   `allow.group('Admin')` rule** on the operation in
 *   `amplify/data/resource.ts`: AppSync rejects a caller whose
 *   `cognito:groups` claim (Contract 2) lacks "Admin" before this code runs.
 *   `requireAdmin` below is a defense-in-depth BACKSTOP only — but a
 *   load-bearing one, because Amplify's IAM authorization mode does not apply
 *   `@auth` rules to an IAM principal. An IAM caller arrives with an identity
 *   carrying no `groups`, so `requireAdmin` refuses it.
 *
 * **CORRECTED 2026-10-01, against the first real deployment.** The claim above
 * that AppSync filters the caller before this code runs is FALSE for this
 * Lambda-backed operation. `allow.group('Admin')` is declared in
 * `amplify/data/resource.ts`, but Amplify Data only translates it into an
 * `@aws_cognito_user_pools(cognito_groups:["Admin"])` directive for
 * `a.handler.custom(...)` JS resolvers. For `a.handler.function(...)` it
 * degrades silently to plain `@aws_cognito_user_pools` — any authenticated
 * Cognito user — with no warning at synth or deploy time. Verified by reading
 * the deployed SDL with `aws appsync get-introspection-schema
 * --include-directives`.
 *
 * So `requireAdmin` below is NOT a backstop here. It is THE enforcing layer:
 * the only thing between an ordinary signed-in worshipper and this operation.
 * Do not remove or weaken it. The test asserting a non-admin is refused exists
 * to make that impossible to do by accident.
 * - **Flutter screens (flutter-app-unit):** hiding the admin controls is UX
 *   convenience only, never relied on for authorization.
 *
 * ## Why a Scan
 *
 * `scalability-design.md` sizes the `Post` table at a few hundred rows for the
 * app's lifetime; a filtered Scan reads them in one or two pages and an index
 * would add cost without benefit today. `LastEvaluatedKey` IS followed until
 * exhausted, so a page boundary never drops a post. If the table ever grows
 * into the thousands, add a GSI `feedIndex` on a constant partition key (e.g.
 * `feed = "FEED"`) with `dateTime` as sort key and switch to a `Query` with
 * `ScanIndexForward: false`; the rest of this file stays the same.
 *
 * ## The invariant the reads rely on
 *
 * `dateTime >= :cutoff` is a DynamoDB STRING comparison. It is exact because
 * `createPost`/`updatePost` store `dateTime` in canonical UTC form
 * (`YYYY-MM-DDTHH:mm:ss.SSSZ`) and `ageOutCutoffIso` produces the same form.
 * The equivalent rule is applied again in code to every returned row as
 * defense in depth, so a row written by any other path is judged the same way.
 *
 * The shared rules are imported from `post-shared/post-rules.ts`: Lambdas are
 * bundled by esbuild, unlike the verbatim-uploaded AppSync JS resolvers.
 */
import type { AppSyncResolverEvent } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import {
  ageOutCutoffIso,
  isNotDeleted,
  isVisibleInFeed,
  sortMostRecentFirst,
} from '../../data/post-shared/post-rules';

/** The one method the handler needs — a real `DynamoDBDocumentClient` or a test fake. */
export type DocumentClientLike = Pick<DynamoDBDocumentClient, 'send'>;

/**
 * Items evaluated per `Scan` page, set explicitly rather than left to the
 * service default so the page size is a stated decision and the pagination
 * loop is exercised at a predictable boundary. It bounds ONE page, never the
 * result: `scanAllPages` follows `LastEvaluatedKey` until it is absent, so the
 * full table is always returned no matter how many pages that takes.
 */
export const SCAN_PAGE_LIMIT = 200;

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

/** The two Contract 3 list fields this Lambda serves. */
export const LIST_POSTS = 'listPosts';
export const LIST_ALL_POSTS_FOR_ADMIN = 'listAllPostsForAdmin';

/** Neither list operation takes arguments (Contract 3). */
export type FeedApiEvent = AppSyncResolverEvent<Record<string, never>>;

/** The identity shape the admin backstop reads; an IAM principal has no `groups`. */
type IdentityWithGroups = { sub?: string; groups?: string[] | null };

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
 * BACKSTOP for BR2.3/BR2.7 — the enforcing layer is the declarative
 * `allow.group('Admin')` rule (see the file header). Throws rather than
 * returning an empty list: a caller who should not be here gets an error, not
 * a silently empty admin screen.
 */
function requireAdmin(event: FeedApiEvent, fieldName: string): void {
  const identity = event.identity as IdentityWithGroups | null | undefined;
  const groups = identity?.groups ?? [];
  if (!groups.includes('Admin')) {
    throw new Error(`Unauthorized: ${fieldName} requires membership of the Admin group`);
  }
}

/** How one list operation filters the table, at the data source and again in code. */
interface ListSpec {
  filterExpression: string;
  expressionAttributeNames: Record<string, string>;
  expressionAttributeValues?: Record<string, string>;
  /** Defense in depth: the same rule the filter expresses, applied to every row. */
  keep: (post: StoredPost) => boolean;
}

/** BR2.4 + BR2.6 — the public feed: not deleted AND not aged out. */
function publicFeedSpec(nowIso: string): ListSpec {
  return {
    filterExpression: 'attribute_not_exists(#deletedAt) AND #dateTime >= :cutoff',
    expressionAttributeNames: { '#deletedAt': 'deletedAt', '#dateTime': 'dateTime' },
    expressionAttributeValues: { ':cutoff': ageOutCutoffIso(nowIso) },
    keep: (post) => isVisibleInFeed(post, nowIso),
  };
}

/** BR2.7 + BR2.6 — the admin view: not deleted, and NO age-out clause. */
function adminListSpec(): ListSpec {
  return {
    filterExpression: 'attribute_not_exists(#deletedAt)',
    expressionAttributeNames: { '#deletedAt': 'deletedAt' },
    keep: isNotDeleted,
  };
}

/**
 * Reads EVERY page the filter matches. `LastEvaluatedKey` is followed until it
 * is absent — a truncated result is never returned, and never silently.
 * DynamoDB errors propagate to the caller untouched.
 */
async function scanAllPages(deps: FeedApiDeps, spec: ListSpec): Promise<StoredPost[]> {
  const rows: StoredPost[] = [];
  let exclusiveStartKey: Record<string, unknown> | undefined;
  do {
    const page = await deps.client.send(
      new ScanCommand({
        TableName: deps.tableName,
        Limit: SCAN_PAGE_LIMIT,
        FilterExpression: spec.filterExpression,
        ExpressionAttributeNames: spec.expressionAttributeNames,
        ExpressionAttributeValues: spec.expressionAttributeValues,
        ExclusiveStartKey: exclusiveStartKey,
      }),
    );
    rows.push(...((page.Items ?? []) as StoredPost[]));
    exclusiveStartKey = page.LastEvaluatedKey;
  } while (exclusiveStartKey);
  return rows;
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
    const fieldName = event.info.fieldName;

    let spec: ListSpec;
    if (fieldName === LIST_POSTS) {
      spec = publicFeedSpec(now());
    } else if (fieldName === LIST_ALL_POSTS_FOR_ADMIN) {
      requireAdmin(event, fieldName);
      spec = adminListSpec();
    } else {
      throw new Error(`feed-api: unsupported operation ${fieldName}`);
    }

    const rows = await scanAllPages(deps, spec);
    return sortMostRecentFirst(rows.filter(spec.keep)).map(toPublicPost);
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
