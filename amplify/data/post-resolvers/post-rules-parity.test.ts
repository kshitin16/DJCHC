/**
 * feed-unit — parity between `post-shared/post-rules.ts` (the reference) and
 * the copies inlined in the resolvers (plan Step 7.2, path b).
 *
 * The APPSYNC_JS runtime cannot import shared modules, so `createPost.js`,
 * `updatePost.js` and `getPost.js` carry their own copies of the rule
 * functions (the Lambda-backed `listPosts` and `listAllPostsForAdmin` import
 * `post-rules.ts` directly and need no mirror). The inlined functions are not
 * exported, so parity is asserted through each resolver's public
 * `request`/`response`: for a fixed table of inputs, the resolver's verdict
 * must equal the reference's verdict.
 *
 * Revision 1 (review finding F-4): the copied CONSTANTS — `POST_TYPES`,
 * `TITLE_MAX`, `DESCRIPTION_MAX` — are now covered too. The verdict table
 * below only exercises the values it happens to name, so a resolver copy that
 * gained a type the contract does not have, or drifted to a different length
 * limit, could pass it. The two constant tests at the end close that: one
 * reads the literals out of each resolver's source and compares them to the
 * reference module, the other drives the behavioural boundary from the
 * reference's own values.
 */
import { readFileSync } from 'node:fs';
import { request as createRequest } from './createPost.js';
import { request as updateRequest } from './updatePost.js';
import { response as getPostResponse } from './getPost.js';
import {
  DESCRIPTION_MAX,
  POST_TYPES,
  TITLE_MAX,
  canonicalDateTimeIso,
  isNotDeleted,
  validatePostInput,
  type PostInput,
} from '../post-shared/post-rules';
import { AppSyncResolverError, setNow } from '../test-support/appsync-utils-double';
import { adminCtx, resultCtx } from '../test-support/resolver-context';

/** The resolver files that inline the constants (plan Step 7.2, path b). */
const MIRRORING_RESOLVERS = ['createPost.js', 'updatePost.js'] as const;

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

  it('getPost.js hides a post exactly when isNotDeleted says it is deleted', () => {
    const base = { id: 'p', dateTime: '2026-09-18T10:00:00.000Z' };
    for (const deletedAt of [undefined, null, '2026-09-10T00:00:00.000Z']) {
      const post = deletedAt === undefined ? base : { ...base, deletedAt };
      const returned = getPostResponse(resultCtx(post));
      expect(returned !== null).toBe(isNotDeleted(post));
    }
  });

  // --- Revision 1, finding F-4: the copied constants -----------------------

  it('declares POST_TYPES, TITLE_MAX and DESCRIPTION_MAX with literally the same values as post-rules.ts', () => {
    for (const file of MIRRORING_RESOLVERS) {
      const source = readFileSync(new URL(file, import.meta.url), 'utf8');

      const typesLiteral = /const POST_TYPES = (\[[^\]]*\]);/.exec(source)?.[1];
      expect(typesLiteral).toBeDefined();
      // Values AND order: the enum order is Contract 3's and the validator's
      // error message prints it.
      expect(JSON.parse(typesLiteral!.replace(/'/g, '"'))).toEqual([...POST_TYPES]);

      expect(/const TITLE_MAX = (\d+);/.exec(source)?.[1]).toBe(String(TITLE_MAX));
      expect(/const DESCRIPTION_MAX = (\d+);/.exec(source)?.[1]).toBe(String(DESCRIPTION_MAX));
    }
  });

  it('accepts every POST_TYPES value and flips its verdict at exactly TITLE_MAX / DESCRIPTION_MAX', () => {
    const runners = [
      {
        name: 'createPost.js',
        run: (i: PostInput) => createRequest(adminCtx({ input: i as typeof valid })),
      },
      {
        name: 'updatePost.js',
        run: (i: PostInput) =>
          updateRequest(adminCtx({ id: 'post-1', input: i as Partial<typeof valid> })),
      },
    ];

    for (const { name, run } of runners) {
      // BR2.1 — every declared type is accepted by the copy, driven from the
      // reference list rather than a hand-written one.
      for (const type of POST_TYPES) {
        expect({ name, type, ...verdictOf(() => run({ ...valid, type }), '') }).toEqual({
          name,
          type,
          ok: true,
        });
      }

      // BR2.2 — the boundary sits at exactly the reference's limit, not one
      // either side of it.
      for (const [field, max] of [
        ['title', TITLE_MAX],
        ['description', DESCRIPTION_MAX],
      ] as const) {
        const at = verdictOf(() => run({ ...valid, [field]: 'x'.repeat(max) }), '');
        const over = verdictOf(() => run({ ...valid, [field]: 'x'.repeat(max + 1) }), '');
        expect({ name, field, ok: at.ok }).toEqual({ name, field, ok: true });
        expect({ name, field, ok: over.ok }).toEqual({ name, field, ok: false });
        expect(over.ok === false && over.message).toContain(String(max));
      }
    }
  });
});
