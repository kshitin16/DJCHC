/**
 * feed-unit — `Mutation.deletePost(id)` resolver tests (BR2.3, BR2.6, Contract 8).
 */
import { request, response } from './deletePost.js';
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

describe('feed-unit: deletePost resolver', () => {
  it('soft-deletes by setting deletedAt and updatedAt to now (BR2.6)', () => {
    const req = request(adminCtx({ id: 'post-1' }));
    expect(req.key).toEqual({ id: { S: 'post-1' } });
    expect(req.update).toEqual({
      expression: 'SET #deletedAt = :now, #updatedAt = :now',
      expressionNames: { '#deletedAt': 'deletedAt', '#updatedAt': 'updatedAt' },
      expressionValues: { ':now': { S: NOW } },
    });
  });

  it('never issues a DeleteItem — the row must survive as a Streams MODIFY record (Contract 8)', () => {
    const req = request(adminCtx({ id: 'post-1' }));
    expect(req.operation).toBe('UpdateItem');
    expect(JSON.stringify(req)).not.toContain('DeleteItem');
    expect(req.update.expression).not.toMatch(/REMOVE/);
  });

  it('refuses a second delete (and a missing post) through the condition, with a specific error', () => {
    const req = request(adminCtx({ id: 'post-1' }));
    expect(req.condition).toEqual({
      expression: 'attribute_exists(#id) AND attribute_not_exists(#deletedAt)',
      expressionNames: { '#id': 'id', '#deletedAt': 'deletedAt' },
    });
    expect(() =>
      response(
        resultCtx(null, {
          message: 'The conditional request failed',
          type: 'DynamoDB:ConditionalCheckFailedException',
        }),
      ),
    ).toThrow('deletePost: post not found or already deleted');
    expect(() =>
      response(resultCtx(null, { message: 'throttled', type: 'DynamoDB:Throttled' })),
    ).toThrow(AppSyncResolverError);
    const stored = { id: 'post-1', deletedAt: NOW, updatedAt: NOW };
    expect(response(resultCtx(stored))).toEqual(stored);
  });

  it('refuses a caller outside the Admin group (backstop for BR2.3)', () => {
    expect(() => request(userCtx({ id: 'post-1' }))).toThrow(AppSyncUnauthorizedError);
  });
});
