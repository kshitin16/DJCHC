/**
 * feed-unit — `Mutation.updatePost(id, input)` resolver tests
 * (BR2.1, BR2.2 partial, BR2.3, BR2.5, BR2.6).
 */
import { request, response } from './updatePost.js';
import {
  AppSyncResolverError,
  AppSyncUnauthorizedError,
  setNow,
} from '../test-support/appsync-utils-double';
import { adminCtx, resultCtx, userCtx } from '../test-support/resolver-context';

const NOW = '2026-09-17T10:00:00.000Z';

beforeEach(() => {
  setNow(NOW);
});

describe('feed-unit: updatePost resolver', () => {
  it('places only the supplied fields in the update expression (BR2.5: a new dateTime is simply stored, canonicalized)', () => {
    const req = request(
      adminCtx({
        id: 'post-1',
        input: { title: 'New title', dateTime: '2026-10-01T12:00:00+05:30' },
      }),
    );
    expect(req.operation).toBe('UpdateItem');
    expect(req.key).toEqual({ id: { S: 'post-1' } });
    expect(req.update.expression).toBe(
      'SET #title = :title, #dateTime = :dateTime, #updatedAt = :updatedAt',
    );
    expect(req.update.expressionNames).toEqual({
      '#title': 'title',
      '#dateTime': 'dateTime',
      '#updatedAt': 'updatedAt',
    });
    expect(req.update.expressionValues).toEqual({
      ':title': { S: 'New title' },
      ':dateTime': { S: '2026-10-01T06:30:00.000Z' },
      ':updatedAt': { S: NOW },
    });
    expect(req.update.expression).not.toContain('description');
    expect(req.update.expression).not.toContain('#type');
  });

  it('always sets updatedAt, and refuses an update that changes nothing', () => {
    const req = request(adminCtx({ id: 'post-1', input: { type: 'DONATION_CALL_OUT' } }));
    expect(req.update.expression).toBe('SET #type = :type, #updatedAt = :updatedAt');
    expect(req.update.expressionValues).toEqual({
      ':type': { S: 'DONATION_CALL_OUT' },
      ':updatedAt': { S: NOW },
    });
    expect(() => request(adminCtx({ id: 'post-1', input: {} }))).toThrow(
      'updatePost: no fields to update',
    );
    expect(() => request(adminCtx({ id: 'post-1', input: { title: null } as never }))).toThrow(
      'updatePost: no fields to update',
    );
  });

  it('validates only the supplied fields, rejecting before any request is built (BR2.1, BR2.2)', () => {
    expect(() => request(adminCtx({ id: 'post-1', input: { title: 'x'.repeat(101) } }))).toThrow(
      'updatePost: title must not exceed 100 characters (BR2.2)',
    );
    expect(() => request(adminCtx({ id: 'post-1', input: { type: 'NOPE' } }))).toThrow(
      'updatePost: type must be one of EVENT, VISITING_DIGNITARY, DONATION_CALL_OUT (BR2.1)',
    );
    // A description-only update does not require the other fields.
    expect(() =>
      request(adminCtx({ id: 'post-1', input: { description: 'd'.repeat(1000) } })),
    ).not.toThrow();
    expect(() => request(userCtx({ id: 'post-1', input: { title: 'x' } }))).toThrow(
      AppSyncUnauthorizedError,
    );
  });

  it('conditions the write on the post existing and not being soft-deleted, and maps that failure to a specific error (BR2.6)', () => {
    const req = request(adminCtx({ id: 'post-1', input: { title: 'x' } }));
    expect(req.condition).toEqual({
      expression: 'attribute_exists(#id) AND attribute_not_exists(#deletedAt)',
      expressionNames: { '#id': 'id', '#deletedAt': 'deletedAt' },
    });
    let thrown: unknown;
    try {
      response(
        resultCtx(null, {
          message: 'The conditional request failed',
          type: 'DynamoDB:ConditionalCheckFailedException',
        }),
      );
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(AppSyncResolverError);
    expect((thrown as AppSyncResolverError).message).toBe(
      'updatePost: post not found or already deleted',
    );
    expect((thrown as AppSyncResolverError).errorType).toBe(
      'DynamoDB:ConditionalCheckFailedException',
    );
    // Other errors pass through unchanged; success returns the stored post.
    expect(() =>
      response(resultCtx(null, { message: 'throttled', type: 'DynamoDB:Throttled' })),
    ).toThrow('throttled');
    const stored = { id: 'post-1', title: 'x', updatedAt: NOW };
    expect(response(resultCtx(stored))).toEqual(stored);
  });

  it('can never change createdByGoogleId, createdAt or id, even if smuggled into the input', () => {
    const req = request(
      adminCtx({
        id: 'post-1',
        input: {
          title: 'x',
          createdByGoogleId: 'attacker-sub',
          createdAt: '1999-01-01T00:00:00.000Z',
          id: 'other-post',
        } as { title: string },
      }),
    );
    expect(req.update.expression).toBe('SET #title = :title, #updatedAt = :updatedAt');
    expect(Object.keys(req.update.expressionNames ?? {})).toEqual(['#title', '#updatedAt']);
    expect(req.key).toEqual({ id: { S: 'post-1' } });
  });
});
