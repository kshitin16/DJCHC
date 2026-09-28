/**
 * feed-unit — `Query.listAllPostsForAdmin` resolver tests (BR2.6, BR2.7).
 *
 * The declarative `allow.group('Admin')` rule in `../resource.ts` is the
 * enforcing layer (asserted in `../post-schema.test.ts`); the in-resolver
 * group check exercised here is the backstop.
 */
import { request, response } from './listAllPostsForAdmin.js';
import { AppSyncUnauthorizedError, setNow } from '../test-support/appsync-utils-double';
import { adminCtx, guestCtx, resultCtx, userCtx } from '../test-support/resolver-context';

const NOW = '2026-09-17T10:00:00.000Z';
const HOUR_MS = 60 * 60 * 1000;

function iso(offsetMs: number): string {
  return new Date(Date.parse(NOW) + offsetMs).toISOString();
}

function aPost(overrides: { id: string; dateTime: string; deletedAt?: string }) {
  return {
    __typename: 'Post',
    type: 'VISITING_DIGNITARY',
    title: 'Muni Shri visit',
    description: 'Pravachan at 9am',
    createdByGoogleId: 'admin-sub',
    createdAt: iso(-72 * HOUR_MS),
    updatedAt: iso(-72 * HOUR_MS),
    ...overrides,
  };
}

beforeEach(() => {
  setNow(NOW);
});

describe('feed-unit: listAllPostsForAdmin resolver', () => {
  it('requests a Scan whose only filter is the soft-delete marker — no age-out clause (BR2.7, BR2.6)', () => {
    const req = request(adminCtx({}));
    expect(req.operation).toBe('Scan');
    expect(req.filter).toEqual({
      expression: 'attribute_not_exists(#deletedAt)',
      expressionNames: { '#deletedAt': 'deletedAt' },
    });
    expect(req.filter?.expression).not.toContain('dateTime');
    expect(req.filter?.expressionValues).toBeUndefined();
  });

  it('returns every post sorted most-recent first, including ones long past the public feed window', () => {
    const items = [
      aPost({ id: 'aged-out', dateTime: iso(-30 * 24 * HOUR_MS) }),
      aPost({ id: 'upcoming', dateTime: iso(5 * 24 * HOUR_MS) }),
      aPost({ id: 'yesterday', dateTime: iso(-20 * HOUR_MS) }),
    ];
    expect(response(resultCtx({ items })).map((p) => p.id)).toEqual([
      'upcoming',
      'yesterday',
      'aged-out',
    ]);
    expect(response(resultCtx({ items: [] }))).toEqual([]);
  });

  it('refuses a caller outside the Admin group and an anonymous caller (backstop for BR2.7)', () => {
    expect(() => request(userCtx({}))).toThrow(AppSyncUnauthorizedError);
    expect(() => request(guestCtx())).toThrow(AppSyncUnauthorizedError);
  });

  it('lets an Admin-group caller through', () => {
    expect(() => request(adminCtx({}))).not.toThrow();
  });
});
