/**
 * feed-unit — `Query.getPost(id)` resolver tests (BR2.6, BR2.7).
 */
import { request, response } from './getPost.js';
import {
  AppSyncResolverError,
  AppSyncUnauthorizedError,
} from '../test-support/appsync-utils-double';
import { adminCtx, resultCtx, userCtx } from '../test-support/resolver-context';

const livePost = {
  id: 'post-1',
  __typename: 'Post',
  type: 'EVENT',
  title: 'Paryushan',
  description: 'Eight days',
  dateTime: '2026-08-01T10:00:00.000Z',
  createdByGoogleId: 'admin-sub',
  createdAt: '2026-07-01T10:00:00.000Z',
  updatedAt: '2026-07-01T10:00:00.000Z',
};

describe('feed-unit: getPost resolver', () => {
  it('requests a GetItem keyed by the id argument, for an Admin caller only (BR2.7)', () => {
    const req = request(adminCtx({ id: 'post-1' }));
    expect(req).toEqual({ operation: 'GetItem', key: { id: { S: 'post-1' } } });
    expect(() => request(userCtx({ id: 'post-1' }))).toThrow(AppSyncUnauthorizedError);
  });

  it('returns null when the post does not exist', () => {
    expect(response(resultCtx(null))).toBeNull();
    expect(response(resultCtx(undefined))).toBeNull();
  });

  it('returns null for a soft-deleted post, indistinguishable from a missing one (BR2.6)', () => {
    expect(response(resultCtx({ ...livePost, deletedAt: '2026-08-02T00:00:00.000Z' }))).toBeNull();
  });

  it('returns a live post as stored (even one aged out of the public feed), and surfaces a data-source error', () => {
    expect(response(resultCtx(livePost))).toEqual(livePost);
    expect(response(resultCtx({ ...livePost, deletedAt: null }))).toEqual({
      ...livePost,
      deletedAt: null,
    });
    expect(() =>
      response(resultCtx(null, { message: 'boom', type: 'DynamoDB:InternalServerError' })),
    ).toThrow(AppSyncResolverError);
  });
});
