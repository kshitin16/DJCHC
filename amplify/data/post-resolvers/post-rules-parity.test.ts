/**
 * feed-unit — parity between `post-shared/post-rules.ts` (the reference) and
 * the copies inlined in the resolvers (plan Step 7.2, path b).
 *
 * The APPSYNC_JS runtime cannot import shared modules, so `createPost.js`,
 * `updatePost.js`, `listAllPostsForAdmin.js` and `getPost.js` carry their own
 * copies of the rule functions (the Lambda-backed `listPosts` imports
 * `post-rules.ts` directly and needs no mirror). The inlined functions are not
 * exported, so parity is asserted through each resolver's public
 * `request`/`response`: for a fixed table of inputs, the resolver's verdict
 * must equal the reference's verdict.
 */
import { request as createRequest } from './createPost.js';
import { request as updateRequest } from './updatePost.js';
import { response as listAllResponse } from './listAllPostsForAdmin.js';
import { response as getPostResponse } from './getPost.js';
import {
  canonicalDateTimeIso,
  isNotDeleted,
  sortMostRecentFirst,
  validatePostInput,
  type PostInput,
} from '../post-shared/post-rules';
import { AppSyncResolverError, setNow } from '../test-support/appsync-utils-double';
import { adminCtx, resultCtx } from '../test-support/resolver-context';

const valid = {
  type: 'EVENT',
  title: 'Aarti',
  description: 'Evening aarti',
  dateTime: '2026-09-20T18:30:00Z',
};

/** The fixed table: one row per branch of the validator. */
const INPUTS: { name: string; input: PostInput }[] = [
  { name: 'valid', input: valid },
  { name: 'unknown type', input: { ...valid, type: 'FESTIVAL' } },
  { name: 'type not a string', input: { ...valid, type: 7 } },
  { name: 'title at max', input: { ...valid, title: 'x'.repeat(100) } },
  { name: 'title over max', input: { ...valid, title: 'x'.repeat(101) } },
  { name: 'title not a string', input: { ...valid, title: 12 } },
  { name: 'description at max', input: { ...valid, description: 'd'.repeat(1000) } },
  { name: 'description over max', input: { ...valid, description: 'd'.repeat(1001) } },
  { name: 'empty dateTime', input: { ...valid, dateTime: '' } },
  { name: 'everything wrong', input: { type: 'X', title: 'x'.repeat(101), description: 5 } },
  { name: 'nothing supplied', input: {} },
  { name: 'nulls supplied', input: { type: null, title: null, description: null, dateTime: null } },
  { name: 'only title', input: { title: 'Just a title' } },
  { name: 'only bad type', input: { type: 'NOPE' } },
];

/** Runs a resolver request and returns the validator verdict it acted on. */
function verdictOf(
  run: () => unknown,
  prefix: string,
): { ok: true } | { ok: false; message: string } {
  try {
    run();
    return { ok: true };
  } catch (error) {
    if (error instanceof AppSyncResolverError && error.errorType === 'ValidationError') {
      const message = error.message.startsWith(prefix)
        ? error.message.slice(prefix.length)
        : error.message;
      return { ok: false, message };
    }
    throw error;
  }
}

beforeEach(() => {
  setNow('2026-09-17T10:00:00.000Z');
});

describe('feed-unit: inlined rule mirrors agree with post-shared/post-rules.ts', () => {
  it('createPost.js validates exactly as validatePostInput(input, { partial: false })', () => {
    for (const { name, input } of INPUTS) {
      const reference = validatePostInput(input, { partial: false });
      const resolver = verdictOf(
        () => createRequest(adminCtx({ input: input as typeof valid })),
        'createPost: ',
      );
      expect({ name, ...resolver }).toEqual({ name, ...reference });
    }
  });

  it('updatePost.js validates exactly as validatePostInput(input, { partial: true })', () => {
    for (const { name, input } of INPUTS) {
      const reference = validatePostInput(input, { partial: true });
      const resolver = verdictOf(
        () => updateRequest(adminCtx({ id: 'post-1', input: input as Partial<typeof valid> })),
        'updatePost: ',
      );
      // The resolver adds one rule the reference deliberately does not own:
      // an update that supplies no field at all is refused.
      const expected =
        reference.ok && Object.values(input).every((v) => v === undefined || v === null)
          ? { ok: false, message: 'no fields to update' }
          : reference;
      expect({ name, ...resolver }).toEqual({ name, ...expected });
    }
  });

  it('createPost.js and updatePost.js canonicalize dateTime exactly as canonicalDateTimeIso', () => {
    for (const dateTime of [
      '2026-09-20T18:30:00Z',
      '2026-09-21T00:00:00+05:30',
      '2026-12-31T23:59:59.999Z',
      '2027-01-01T00:00:00.5Z',
    ]) {
      const created = createRequest(adminCtx({ input: { ...valid, dateTime } }));
      const updated = updateRequest(adminCtx({ id: 'p', input: { dateTime } }));
      const expected = { S: canonicalDateTimeIso(dateTime) };
      expect((created.attributeValues as { dateTime: unknown }).dateTime).toEqual(expected);
      expect((updated.update.expressionValues as { ':dateTime': unknown })[':dateTime']).toEqual(
        expected,
      );
    }
  });

  it('listAllPostsForAdmin.js sorts exactly as sortMostRecentFirst', () => {
    const items = [
      { id: 'c', dateTime: '2026-09-18T10:00:00.000Z' },
      { id: 'a', dateTime: '2026-09-25T10:00:00.000Z' },
      { id: 'b', dateTime: '2026-09-18T10:00:00.000Z' },
      { id: 'd', dateTime: '2026-09-01T10:00:00.000Z' },
      { id: 'e', dateTime: '2026-09-25T09:59:59.999Z' },
    ];
    const reference = sortMostRecentFirst(items).map((p) => p.id);
    expect(listAllResponse(resultCtx({ items })).map((p) => p.id)).toEqual(reference);
    expect(reference).toEqual(['a', 'e', 'c', 'b', 'd']);
  });

  it('getPost.js hides a post exactly when isNotDeleted says it is deleted', () => {
    const base = { id: 'p', dateTime: '2026-09-18T10:00:00.000Z' };
    for (const deletedAt of [undefined, null, '2026-09-10T00:00:00.000Z']) {
      const post = deletedAt === undefined ? base : { ...base, deletedAt };
      const returned = getPostResponse(resultCtx(post));
      expect(returned !== null).toBe(isNotDeleted(post));
    }
  });
});
