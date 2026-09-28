// @ts-check
/**
 * feed-unit — `Query.getPost(id)` (Contract 3): one post for the admin edit
 * screen, including a post that has aged out of the public feed.
 *
 * AppSync JavaScript resolver (APPSYNC_JS runtime) on the `Post` table.
 * Rules realized: BR2.7 (admin-only, no age-out filter), BR2.6 (a
 * soft-deleted post is returned as `null`, exactly like a missing one — the
 * caller cannot tell them apart, by design).
 *
 * The ENFORCING layer for the admin gate is the declarative
 * `allow.group('Admin')` rule on this operation in `../resource.ts`;
 * `requireAdmin` below is a defense-in-depth BACKSTOP only.
 */
import { util } from '@aws-appsync/utils';

/** @typedef {import('@aws-appsync/utils').Context<{ id: string }>} Context */
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
 * @param {Context} ctx
 * @returns {import('@aws-appsync/utils').DynamoDBGetItemRequest}
 */
export function request(ctx) {
  requireAdmin(ctx);
  return {
    operation: 'GetItem',
    key: util.dynamodb.toMapValues({ id: ctx.args.id }),
  };
}

/**
 * Surfaces a DynamoDB error; returns `null` for a missing OR soft-deleted
 * post (BR2.6), otherwise the post.
 * @param {Context} ctx
 * @returns {Post | null}
 */
export function response(ctx) {
  if (ctx.error) {
    util.error(ctx.error.message, ctx.error.type);
  }
  const post = /** @type {Post | null | undefined} */ (ctx.result);
  if (!post || !isNotDeleted(post)) {
    return null;
  }
  return post;
}

/**
 * BR2.6 — mirrors post-shared/post-rules.ts `isNotDeleted`.
 * @param {Post} post
 */
function isNotDeleted(post) {
  return post.deletedAt === undefined || post.deletedAt === null;
}

/**
 * BACKSTOP for BR2.7 (the enforcing layer is the declarative
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
