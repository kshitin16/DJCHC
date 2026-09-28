// @ts-check
/**
 * feed-unit — `Mutation.createPost(input)` (Contract 3).
 *
 * AppSync JavaScript resolver (APPSYNC_JS runtime) on the `Post` table.
 * Rules realized: BR2.1 (declared type only), BR2.2 (title <= 100,
 * description <= 1000 characters) — both checked BEFORE any write, with a
 * specific message; BR2.3 (admin-only); `createdByGoogleId` is taken from the
 * verified JWT (`ctx.identity.sub`, Contract 1), never from the input; the
 * `id` is server-generated (`util.autoId()`), never client-supplied.
 *
 * ## Who enforces the admin gate
 *
 * The ENFORCING layer is the declarative `allow.group('Admin')` rule on this
 * operation in `../resource.ts` (BR2.3): AppSync rejects a caller whose
 * `cognito:groups` claim (Contract 2) lacks "Admin" before this code runs.
 * `requireAdmin` below is a defense-in-depth BACKSTOP only.
 *
 * ## `dateTime` canonical form
 *
 * The AWSDateTime scalar accepts offsets and optional milliseconds. The
 * stored value is normalized to `YYYY-MM-DDTHH:mm:ss.SSSZ` so the string
 * comparison in the `feed-api` Lambda's `listPosts` filter and the
 * comparator-less sort are
 * chronological (see post-shared/post-rules.ts, file header).
 *
 * Validation and normalization mirror post-shared/post-rules.ts; the
 * APPSYNC_JS runtime cannot import it (files are uploaded verbatim), and
 * `post-rules-parity.test.ts` proves the copies agree.
 */
import { util } from '@aws-appsync/utils';

/**
 * @typedef {object} CreatePostInput
 * @property {string} type
 * @property {string} title
 * @property {string} description
 * @property {string} dateTime
 */
/** @typedef {import('@aws-appsync/utils').Context<{ input: CreatePostInput }>} Context */
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

/**
 * @param {Context} ctx
 * @returns {import('@aws-appsync/utils').DynamoDBPutItemRequest}
 */
export function request(ctx) {
  const identity = requireAdmin(ctx);
  const input = ctx.args.input;
  const verdict = validatePostInput(input, { partial: false });
  if (!verdict.ok) {
    util.error(`createPost: ${verdict.message}`, 'ValidationError');
  }
  const now = util.time.nowISO8601();
  const id = util.autoId();
  return {
    operation: 'PutItem',
    key: util.dynamodb.toMapValues({ id }),
    attributeValues: util.dynamodb.toMapValues({
      __typename: 'Post',
      type: input.type,
      title: input.title,
      description: input.description,
      dateTime: canonicalDateTimeIso(input.dateTime),
      createdByGoogleId: identity.sub,
      createdAt: now,
      updatedAt: now,
    }),
    // `util.autoId()` is a UUID; the condition makes an (astronomically
    // unlikely) collision a loud failure rather than a silent overwrite.
    condition: {
      expression: 'attribute_not_exists(#id)',
      expressionNames: { '#id': 'id' },
    },
  };
}

/**
 * Surfaces a DynamoDB error (never swallowed); otherwise the stored post.
 * @param {Context} ctx
 * @returns {Post}
 */
export function response(ctx) {
  if (ctx.error) {
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
