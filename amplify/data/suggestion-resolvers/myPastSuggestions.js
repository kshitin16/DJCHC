// @ts-check
/**
 * suggestion-unit — `Query.myPastSuggestions` (Contract 4): a signed-in
 * user's own suggestions, newest first.
 *
 * AppSync JavaScript resolver (APPSYNC_JS runtime) on the `Suggestion` table
 * — the "plain direct resolver" infrastructure-specification.md fixes for
 * this one operation. Rules realized: BR3.3 (owner-only visibility),
 * FR3.4 (newest first).
 *
 * ## Who enforces the owner gate
 *
 * The ENFORCING layer is declarative, in `../resource.ts`: the operation's
 * `allow.authenticated()` rule refuses any caller without a Cognito User
 * Pool JWT before this code runs, and the `Suggestion` model's owner-READ
 * rule (`submittedByGoogleId` matched against the JWT `sub`) governs which
 * rows are readable. This resolver additionally keys its Query on
 * `ctx.identity.sub` — never on an argument — so no other user's rows can
 * even be requested. That is a defense-in-depth BACKSTOP, not the enforcing
 * layer.
 *
 * Query on `submitterIndex` (`submittedByGoogleId`, sorted by
 * `submittedAt`) with `scanIndexForward: false`, so DynamoDB returns the
 * rows newest first; one page (a single user's suggestions never approach
 * the 1MB page cap at 5 per day).
 */
import { util } from '@aws-appsync/utils';

/** @typedef {import('@aws-appsync/utils').Context} Context */
/** @typedef {import('@aws-appsync/utils').AppSyncIdentityCognito} CognitoIdentity */
/**
 * @typedef {object} Suggestion
 * @property {string} id
 * @property {string} submittedByGoogleId
 * @property {string} text
 * @property {string} submittedAt
 */

/** Mirrors `functions/suggestion-shared/types.ts` SUGGESTION_SUBMITTER_INDEX (a resolver cannot import it). */
const SUBMITTER_INDEX = 'submitterIndex';

/**
 * BR3.3 — Query the caller's own rows on `submitterIndex`, newest first.
 * @param {Context} ctx
 * @returns {import('@aws-appsync/utils').DynamoDBQueryRequest}
 */
export function request(ctx) {
  const sub = requireSignedIn(ctx);
  return {
    operation: 'Query',
    index: SUBMITTER_INDEX,
    query: {
      expression: '#owner = :sub',
      expressionNames: { '#owner': 'submittedByGoogleId' },
      expressionValues: util.dynamodb.toMapValues({ ':sub': sub }),
    },
    scanIndexForward: false,
  };
}

/**
 * Surfaces a DynamoDB error to the caller, otherwise returns the page as
 * DynamoDB ordered it (descending `submittedAt`).
 * @param {Context} ctx
 * @returns {Suggestion[]}
 */
export function response(ctx) {
  if (ctx.error) {
    util.error(ctx.error.message, ctx.error.type);
  }
  const items = ctx.result ? ctx.result.items : undefined;
  if (!items || typeof items.length !== 'number') {
    return [];
  }
  return items;
}

/**
 * BACKSTOP for BR3.2/BR3.3 (the enforcing layer is the declarative
 * `allow.authenticated()` + owner rule — see the file header). The key is
 * the verified identity's `sub`, never `ctx.args`.
 * @param {Context} ctx
 * @returns {string}
 */
function requireSignedIn(ctx) {
  const identity = /** @type {CognitoIdentity | null | undefined} */ (ctx.identity);
  if (!identity || typeof identity.sub !== 'string' || identity.sub.length === 0) {
    util.unauthorized();
  }
  return /** @type {CognitoIdentity} */ (identity).sub;
}
