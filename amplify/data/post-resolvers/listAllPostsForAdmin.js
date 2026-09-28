// @ts-check
/**
 * feed-unit — `Query.listAllPostsForAdmin` (Contract 3): the admin
 * post-management view.
 *
 * AppSync JavaScript resolver (APPSYNC_JS runtime) on the `Post` table.
 * Rules realized: BR2.7 (every non-deleted post, NO age-out filter, so an
 * admin can find and re-date a post that has left the public feed — the
 * step that makes BR2.5 reachable), BR2.6 (deleted posts hidden here too),
 * NFR-AUTHZ.1.
 *
 * ## Who enforces the admin gate
 *
 * The ENFORCING layer is the declarative `allow.group('Admin')` rule on this
 * operation in `../resource.ts`: AppSync rejects a caller whose
 * `cognito:groups` claim (Contract 2) lacks "Admin" before this code runs.
 * `requireAdmin` below is a defense-in-depth BACKSTOP only.
 *
 * Scan rather than Query for the same reason as the `feed-api` Lambda's
 * `listPosts` (see `functions/feed-api/handler.ts` for the `feedIndex` GSI
 * to add if the table ever grows). One page is read; at this table's size a
 * `nextToken` never appears.
 */
import { util } from '@aws-appsync/utils';

/** @typedef {import('@aws-appsync/utils').Context} Context */
/** @typedef {import('@aws-appsync/utils').AppSyncIdentityCognito} CognitoIdentity */
/**
 * @typedef {object} Post
 * @property {string} id
 * @property {string} type
 * @property {string} title
 * @property {string} description
 * @property {string} dateTime
 * @property {string} createdByGoogleId
 * @property {string} createdAt
 * @property {string} updatedAt
 * @property {string} [deletedAt]
 */

/**
 * BR2.7 — Scan for every post that is not soft-deleted (BR2.6).
 * @param {Context} ctx
 * @returns {import('@aws-appsync/utils').DynamoDBScanRequest}
 */
export function request(ctx) {
  requireAdmin(ctx);
  return {
    operation: 'Scan',
    filter: {
      expression: 'attribute_not_exists(#deletedAt)',
      expressionNames: { '#deletedAt': 'deletedAt' },
    },
  };
}

/**
 * Surfaces a DynamoDB error to the caller, otherwise returns the page
 * sorted most-recent first.
 * @param {Context} ctx
 * @returns {Post[]}
 */
export function response(ctx) {
  if (ctx.error) {
    util.error(ctx.error.message, ctx.error.type);
  }
  const items = ctx.result ? ctx.result.items : undefined;
  if (!items || typeof items.length !== 'number') {
    return [];
  }
  return sortMostRecentFirst(items);
}

/**
 * BACKSTOP for BR2.3/BR2.7 (the enforcing layer is the declarative
 * `allow.group('Admin')` rule — see the file header).
 * @param {Context} ctx
 * @returns {CognitoIdentity}
 */
function requireAdmin(ctx) {
  const identity = /** @type {CognitoIdentity | null | undefined} */ (ctx.identity);
  const groups = (identity && identity.groups) || [];
  if (groups.indexOf('Admin') < 0) {
    util.unauthorized();
  }
  return /** @type {CognitoIdentity} */ (identity);
}

/**
 * mirrors post-shared/post-rules.ts `sortMostRecentFirst`: a comparator-less
 * string sort over `<dateTime>#<id>` keys, exact because `dateTime` is stored
 * in canonical UTC form.
 * @param {Post[]} posts
 * @returns {Post[]}
 */
function sortMostRecentFirst(posts) {
  /** @type {Record<string, Post>} */
  const byKey = {};
  for (const post of posts) {
    byKey[`${post.dateTime}#${post.id}`] = post;
  }
  return Object.keys(byKey)
    .sort()
    .reverse()
    .map((key) => byKey[key]);
}
