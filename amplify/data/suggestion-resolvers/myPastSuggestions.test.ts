/**
 * suggestion-unit — `Query.myPastSuggestions` resolver tests (BR3.3, FR3.4).
 *
 * The declarative `allow.authenticated()` operation rule and the model's
 * owner rule in `../resource.ts` are the enforcing layer (asserted in
 * `../suggestion-schema.test.ts`); what is exercised here is that the
 * resolver keys its Query on the verified identity, never on an argument.
 */
import { request, response } from './myPastSuggestions.js';
import {
  AppSyncResolverError,
  AppSyncUnauthorizedError,
} from '../test-support/appsync-utils-double';
import { USER_SUB, guestCtx, resultCtx, userCtx } from '../test-support/resolver-context';

describe('suggestion-unit: myPastSuggestions resolver', () => {
  it('requests a Query on submitterIndex (never a Scan)', () => {
    const req = request(userCtx({}));
    expect(req.operation).toBe('Query');
    expect(req.index).toBe('submitterIndex');
    expect(req.query.expression).toBe('#owner = :sub');
    expect(req.query.expressionNames).toEqual({ '#owner': 'submittedByGoogleId' });
  });

  it('keys the Query on identity.sub and ignores any argument a caller might pass (BR3.3)', () => {
    const req = request(userCtx({ submittedByGoogleId: 'someone-else', sub: 'someone-else' }));
    expect(req.query.expressionValues).toEqual({ ':sub': { S: USER_SUB } });
    expect(JSON.stringify(req)).not.toContain('someone-else');
    // No identity at all: refused (backstop behind `allow.authenticated()`).
    expect(() => request(guestCtx())).toThrow(AppSyncUnauthorizedError);
  });

  it('asks DynamoDB for descending sort-key order so the newest suggestion comes first (FR3.4)', () => {
    expect(request(userCtx({})).scanIndexForward).toBe(false);
  });

  it('returns the items as ordered, [] when there are none, and surfaces a data-source error', () => {
    const items = [
      {
        id: 'b',
        submittedByGoogleId: USER_SUB,
        text: 'B',
        submittedAt: '2026-09-19T10:00:00.000Z',
      },
      {
        id: 'a',
        submittedByGoogleId: USER_SUB,
        text: 'A',
        submittedAt: '2026-09-18T10:00:00.000Z',
      },
    ];
    expect(response(resultCtx({ items }))).toEqual(items);
    expect(response(resultCtx({ items: [] }))).toEqual([]);
    expect(response(resultCtx(undefined))).toEqual([]);
    expect(() =>
      response(resultCtx(undefined, { message: 'throttled', type: 'DynamoDB:Throttled' })),
    ).toThrow(AppSyncResolverError);
  });
});
