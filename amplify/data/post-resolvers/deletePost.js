// @ts-check
/**
 * feed-unit — `Mutation.deletePost(id)` (Contract 3): SOFT delete.
 *
 * AppSync JavaScript resolver (APPSYNC_JS runtime) on the `Post` table.
 * Rules realized: BR2.6 — sets `deletedAt` (and `updatedAt`) rather than
 * removing the record; NEVER a DynamoDB `DeleteItem`. The condition refuses
 * a second delete and a missing post. BR2.3 (admin-only).
 *
 * Contract 8: because this is an `UpdateItem`, the soft delete reaches the
 * table's stream as a MODIFY record whose OLD image has no `deletedAt` and
 * whose NEW image has one — that transition is reminder-unit's `PostDeleted`
 * signal (`NEW_AND_OLD_IMAGES` is enabled in `../../backend.ts`). A
 * `DeleteItem` would produce a REMOVE record instead and break Contract 8.
 *
 * The mutation returns the post as stored after the delete (`Post!` per
 * Contract 3) — this is the only response in which `deletedAt` is non-null;
 * no query ever returns a deleted post.
 *
 * ## Who enforces the admin gate
 *
 * The ENFORCING layer is the declarative `allow.group('Admin')` rule on this
 * operation in `../resource.ts` (BR2.3). `requireAdmin` below is a
 * defense-in-depth BACKSTOP only.
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
 * @returns {import('@aws-appsync/utils').DynamoDBUpdateItemRequest}
 */
export function request(ctx) {
  requireAdmin(ctx);
  const now = util.time.nowISO8601();
  return {
    operation: 'UpdateItem',
    key: util.dynamodb.toMapValues({ id: ctx.args.id }),
    update: {
      expression: 'SET #deletedAt = :now, #updatedAt = :now',
      expressionNames: { '#deletedAt': 'deletedAt', '#updatedAt': 'updatedAt' },
      expressionValues: util.dynamodb.toMapValues({ ':now': now }),
    },
    // BR2.6: `DELETED` is terminal — a second delete is refused, as is a
    // delete of a post that does not exist.
    condition: {
      expression: 'attribute_exists(#id) AND attribute_not_exists(#deletedAt)',
      expressionNames: { '#id': 'id', '#deletedAt': 'deletedAt' },
    },
  };
}

/**
 * Maps a failed condition to a specific error; surfaces any other DynamoDB
 * error unchanged; otherwise returns the post as stored after the delete.
 * @param {Context} ctx
 * @returns {Post}
 */
export function response(ctx) {
  if (ctx.error) {
    if (ctx.error.type === 'DynamoDB:ConditionalCheckFailedException') {
      util.error('deletePost: post not found or already deleted', ctx.error.type);
    }
    util.error(ctx.error.message, ctx.error.type);
  }
  return ctx.result;
}

/**
 * BACKSTOP for BR2.3 (the enforcing layer is the declarative
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
