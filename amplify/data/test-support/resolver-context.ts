/**
 * feed-unit — builders for the `ctx` objects the AppSync JS resolvers receive.
 *
 * `request(ctx)` reads `ctx.args` and `ctx.identity`; `response(ctx)` reads
 * `ctx.result` and `ctx.error`. Everything else on the real `Context` is
 * irrelevant to these resolvers, so the builders fill only what is read and
 * cast to `Context` for the JSDoc-typed resolver signatures.
 *
 * Excluded from coverage collection (`jest.config.ts`); never deployed.
 */
import type { AppSyncIdentityCognito, Context } from '@aws-appsync/utils';

export const ADMIN_SUB = 'admin-sub';
export const USER_SUB = 'user-sub';

function cognitoIdentity(sub: string, groups: string[] | null): AppSyncIdentityCognito {
  return {
    sub,
    issuer: 'https://cognito-idp.ap-south-1.amazonaws.com/ap-south-1_test',
    username: sub,
    claims: { sub, 'cognito:groups': groups ?? [] },
    sourceIp: ['203.0.113.10'],
    defaultAuthStrategy: 'ALLOW',
    groups,
  };
}

function baseCtx<TArgs>(args: TArgs, identity: unknown): Context<TArgs> {
  return {
    args: args,
    arguments: args,
    identity,
    source: undefined,
    stash: {},
    prev: undefined,
    result: undefined,
    error: undefined,
    request: { headers: {}, domainName: null },
    info: {
      fieldName: '',
      parentTypeName: '',
      variables: {},
      selectionSetList: [],
      selectionSetGraphQL: '',
    },
  } as unknown as Context<TArgs>;
}

/** A caller in the Admin group (Contract 2). */
export function adminCtx<TArgs>(args: TArgs): Context<TArgs> {
  return baseCtx(args, cognitoIdentity(ADMIN_SUB, ['Admin']));
}

/** A signed-in caller with no groups. */
export function userCtx<TArgs>(args: TArgs): Context<TArgs> {
  return baseCtx(args, cognitoIdentity(USER_SUB, null));
}

/** An API-key caller: AppSync supplies no identity. */
export function guestCtx<TArgs = Record<string, never>>(args: TArgs = {} as TArgs): Context<TArgs> {
  return baseCtx(args, null);
}

/** A `response()` context carrying a data-source result (and optional error). */
export function resultCtx<TResult>(
  result: TResult,
  error?: { message: string; type: string },
): Context {
  const ctx = baseCtx({}, null) as Context;
  ctx.result = result;
  if (error) {
    ctx.error = error;
  }
  return ctx;
}
