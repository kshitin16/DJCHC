/**
 * feed-unit — `Mutation.createPost(input)` resolver tests (BR2.1, BR2.2, BR2.3).
 */
import { request, response } from './createPost.js';
import {
  AppSyncResolverError,
  AppSyncUnauthorizedError,
  resetAutoId,
  setNow,
} from '../test-support/appsync-utils-double';
import { ADMIN_SUB, adminCtx, resultCtx, userCtx } from '../test-support/resolver-context';

const NOW = '2026-09-17T10:00:00.000Z';

const validInput = {
  type: 'EVENT',
  title: 'Paryushan Parva begins',
  description: 'Eight days of reflection, fasting and pratikraman at the temple.',
  dateTime: '2026-09-20T18:30:00Z',
};

beforeEach(() => {
  setNow(NOW);
  resetAutoId();
});

describe('feed-unit: createPost resolver', () => {
  it('rejects an over-length title with a specific message before any request is built (BR2.2)', () => {
    let thrown: unknown;
    try {
      request(adminCtx({ input: { ...validInput, title: 'x'.repeat(101) } }));
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(AppSyncResolverError);
    expect((thrown as AppSyncResolverError).errorType).toBe('ValidationError');
    expect((thrown as AppSyncResolverError).message).toBe(
      'createPost: title must not exceed 100 characters (BR2.2)',
    );
    // The boundary itself is accepted.
    expect(() =>
      request(adminCtx({ input: { ...validInput, title: 'x'.repeat(100) } })),
    ).not.toThrow();
    expect(() =>
      request(adminCtx({ input: { ...validInput, description: 'd'.repeat(1001) } })),
    ).toThrow('description must not exceed 1000 characters (BR2.2)');
  });

  it('rejects an undeclared post type (BR2.1)', () => {
    expect(() => request(adminCtx({ input: { ...validInput, type: 'FESTIVAL' } }))).toThrow(
      'createPost: type must be one of EVENT, VISITING_DIGNITARY, DONATION_CALL_OUT (BR2.1)',
    );
  });

  it('attributes the post to the verified JWT sub (never the input) and stamps createdAt/updatedAt/__typename', () => {
    const req = request(
      adminCtx({
        input: { ...validInput, createdByGoogleId: 'attacker-sub' } as typeof validInput,
      }),
    );
    expect(req.operation).toBe('PutItem');
    expect(req.attributeValues).toEqual({
      __typename: { S: 'Post' },
      type: { S: 'EVENT' },
      title: { S: validInput.title },
      description: { S: validInput.description },
      // Canonical UTC form, milliseconds included (the read-side invariant).
      dateTime: { S: '2026-09-20T18:30:00.000Z' },
      createdByGoogleId: { S: ADMIN_SUB },
      createdAt: { S: NOW },
      updatedAt: { S: NOW },
    });
    // An offset in the input is normalized to UTC.
    const offset = request(
      adminCtx({ input: { ...validInput, dateTime: '2026-09-21T00:00:00+05:30' } }),
    );
    expect((offset.attributeValues as { dateTime: { S: string } }).dateTime.S).toBe(
      '2026-09-20T18:30:00.000Z',
    );
  });

  it('writes with an attribute_not_exists(id) condition so a key collision fails loudly', () => {
    const req = request(adminCtx({ input: validInput }));
    expect(req.condition).toEqual({
      expression: 'attribute_not_exists(#id)',
      expressionNames: { '#id': 'id' },
    });
  });

  it('refuses a caller outside the Admin group (backstop for BR2.3)', () => {
    expect(() => request(userCtx({ input: validInput }))).toThrow(AppSyncUnauthorizedError);
  });

  it('generates the id server-side, ignores a client-supplied one, and returns the stored post (surfacing errors)', () => {
    const req = request(
      adminCtx({ input: { ...validInput, id: 'client-chosen' } as typeof validInput }),
    );
    expect(req.key).toEqual({ id: { S: 'auto-id-1' } });
    expect(req.attributeValues).not.toHaveProperty('id');

    const stored = { id: 'auto-id-1', ...validInput, createdByGoogleId: ADMIN_SUB };
    expect(response(resultCtx(stored))).toEqual(stored);
    expect(() =>
      response(
        resultCtx(null, {
          message: 'The conditional request failed',
          type: 'DynamoDB:ConditionalCheckFailedException',
        }),
      ),
    ).toThrow(AppSyncResolverError);
  });
});
