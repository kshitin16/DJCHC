// @ts-check
/**
 * feed-unit — `Mutation.updatePost(id, input)` (Contract 3).
 *
 * AppSync JavaScript resolver (APPSYNC_JS runtime) on the `Post` table.
 * Rules realized: BR2.1 / BR2.2 on the SUPPLIED fields only (partial
 * validation, before any write); BR2.3 (admin-only); BR2.5 — a changed
 * `dateTime` is simply stored, and the `feed-api` Lambda (`listPosts`)
 * re-applies the age-out
 * filter at read time, so an aged-out post edited into the future returns to
 * the public feed with no separate "restore" step; BR2.6 — the condition
 * refuses an already-deleted post (and a missing one). `updatedAt` is always
 * set. `createdByGoogleId`, `createdAt` and `id` can never be changed: only
 * the four Contract 3 input fields are ever placed in the update expression.
 *
 * Contract 8: a changed `dateTime` lands as a DynamoDB Streams MODIFY record
 * (OLD and NEW images) that reminder-unit consumes — no extra code here.
 *
 * ## Who enforces the admin gate
 *
 * The ENFORCING layer is the declarative `allow.group('Admin')` rule on this
 * operation in `../resource.ts` (BR2.3). `requireAdmin` below is a
 * defense-in-depth BACKSTOP only.
 *
 * Validation and normalization mirror post-shared/post-rules.ts (see
 * createPost.js for why they are inlined).
 */
import { util } from '@aws-appsync/utils';

/**
 * @typedef {object} UpdatePostInput
 * @property {string} [type]
 * @property {string} [title]
 * @property {string} [description]
 * @property {string} [dateTime]
 */
/** @typedef {import('@aws-appsync/utils').Context<{ id: string, input: UpdatePostInput }>} Context */
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

// mirrors post-shared/post-rules.ts (BR2.1, BR2.2)
const POST_TYPES = ['EVENT', 'VISITING_DIGNITARY', 'DONATION_CALL_OUT'];
const TITLE_MAX = 100;
const DESCRIPTION_MAX = 1000;

/** The only attributes an update may touch (Contract 3 `UpdatePostInput`). */
const UPDATABLE_FIELDS = /** @type {const} */ (['type', 'title', 'description', 'dateTime']);

/**
 * @param {Context} ctx
 * @returns {import('@aws-appsync/utils').DynamoDBUpdateItemRequest}
 */
export function request(ctx) {
  requireAdmin(ctx);
  const input = ctx.args.input || {};
  const verdict = validatePostInput(input, { partial: true });
  if (!verdict.ok) {
    util.error(`updatePost: ${verdict.message}`, 'ValidationError');
  }

  /** @type {string[]} */
  const assignments = [];
  /** @type {Record<string, string>} */
  const names = {};
  /** @type {Record<string, string>} */
  const values = {};
  for (const field of UPDATABLE_FIELDS) {
    const value = input[field];
    if (!isAbsent(value)) {
      names[`#${field}`] = field;
      values[`:${field}`] = field === 'dateTime' ? canonicalDateTimeIso(value) : value;
      assignments.push(`#${field} = :${field}`);
    }
  }
  if (assignments.length === 0) {
    util.error('updatePost: no fields to update', 'ValidationError');
  }

  const now = util.time.nowISO8601();
  names['#updatedAt'] = 'updatedAt';
  values[':updatedAt'] = now;
  assignments.push('#updatedAt = :updatedAt');

  return {
    operation: 'UpdateItem',
    key: util.dynamodb.toMapValues({ id: ctx.args.id }),
    update: {
      expression: `SET ${assignments.join(', ')}`,
      expressionNames: names,
      expressionValues: util.dynamodb.toMapValues(values),
    },
    // BR2.6: an already-deleted post is refused, exactly like a missing one.
    condition: {
      expression: 'attribute_exists(#id) AND attribute_not_exists(#deletedAt)',
      expressionNames: { '#id': 'id', '#deletedAt': 'deletedAt' },
    },
  };
}

/**
 * Maps a failed condition to a specific error; surfaces any other DynamoDB
 * error unchanged; otherwise returns the post as stored after the update.
 * @param {Context} ctx
 * @returns {Post}
 */
export function response(ctx) {
  if (ctx.error) {
    if (ctx.error.type === 'DynamoDB:ConditionalCheckFailedException') {
      util.error('updatePost: post not found or already deleted', ctx.error.type);
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

/** @param {unknown} value */
function isAbsent(value) {
  return value === undefined || value === null;
}

/**
 * BR2.1 + BR2.2 — mirrors post-shared/post-rules.ts `validatePostInput`.
 * @param {{ type?: unknown, title?: unknown, description?: unknown, dateTime?: unknown }} input
 * @param {{ partial: boolean }} options
 * @returns {{ ok: true } | { ok: false, message: string }}
 */
function validatePostInput(input, options) {
  /** @type {string[]} */
  const messages = [];
  const partial = options.partial;

  if (!partial || !isAbsent(input.type)) {
    if (typeof input.type !== 'string' || POST_TYPES.indexOf(input.type) < 0) {
      messages.push(`type must be one of ${POST_TYPES.join(', ')} (BR2.1)`);
    }
  }

  if (!partial || !isAbsent(input.title)) {
    if (typeof input.title !== 'string') {
      messages.push('title is required (BR2.2)');
    } else if (input.title.length > TITLE_MAX) {
      messages.push(`title must not exceed ${TITLE_MAX} characters (BR2.2)`);
    }
  }

  if (!partial || !isAbsent(input.description)) {
    if (typeof input.description !== 'string') {
      messages.push('description is required (BR2.2)');
    } else if (input.description.length > DESCRIPTION_MAX) {
      messages.push(`description must not exceed ${DESCRIPTION_MAX} characters (BR2.2)`);
    }
  }

  if (!partial || !isAbsent(input.dateTime)) {
    if (typeof input.dateTime !== 'string' || input.dateTime.length === 0) {
      messages.push('dateTime is required');
    }
  }

  if (messages.length > 0) {
    return { ok: false, message: messages.join('; ') };
  }
  return { ok: true };
}

/**
 * mirrors post-shared/post-rules.ts `canonicalDateTimeIso`, with `util.time`.
 * @param {string} iso
 * @returns {string}
 */
function canonicalDateTimeIso(iso) {
  return util.time.epochMilliSecondsToISO8601(util.time.parseISO8601ToEpochMilliSeconds(iso));
}
