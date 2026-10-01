/**
 * feed-unit — `feed-api` Lambda tests: the public `listPosts` query (BR2.4,
 * BR2.6) and, from Revision 1 (review finding F-1), the admin-only
 * `listAllPostsForAdmin` query (BR2.7, BR2.6) — both against a fake document
 * client that records every Scan. No DynamoDB, no AWS credentials.
 *
 * The fake PAGINATES: `fakeClient` is handed a list of pages and replies with
 * them in turn, so a test that expects every row must drive the handler's
 * `LastEvaluatedKey` loop across more than one call. The original
 * `listAllPostsForAdmin` JS resolver was single-page by construction and its
 * double never paginated, which is exactly why the silent truncation F-1
 * reports went unnoticed; every list path here is now exercised across a page
 * boundary.
 */
import type { AppSyncResolverEvent } from 'aws-lambda';
import {
  SCAN_PAGE_LIMIT,
  createHandler,
  type DocumentClientLike,
  type StoredPost,
} from './handler';

const NOW = '2026-09-17T10:00:00.000Z';
const HOUR_MS = 60 * 60 * 1000;
const TABLE = 'Post-test-table';

function iso(offsetMs: number): string {
  return new Date(Date.parse(NOW) + offsetMs).toISOString();
}

function aPost(overrides: Partial<StoredPost> & { id: string }): StoredPost {
  return {
    __typename: 'Post',
    type: 'EVENT',
    title: 'Aarti',
    description: 'Evening aarti',
    dateTime: iso(HOUR_MS),
    createdByGoogleId: 'admin-sub',
    createdAt: iso(-48 * HOUR_MS),
    updatedAt: iso(-48 * HOUR_MS),
    ...overrides,
  };
}

type SentCommand = { name: string; input: Record<string, unknown> };

/** Replies with each page in turn (or throws the canned error); records every command. */
function fakeClient(pages: unknown[]): { client: DocumentClientLike; sent: SentCommand[] } {
  const sent: SentCommand[] = [];
  const queue = [...pages];
  const client = {
    send: async (command: { constructor: { name: string }; input: Record<string, unknown> }) => {
      sent.push({ name: command.constructor.name, input: command.input });
      const reply = queue.shift();
      if (reply instanceof Error) throw reply;
      return reply ?? {};
    },
  } as unknown as DocumentClientLike;
  return { client, sent };
}

/** A Cognito identity, with or without the Admin group (Contract 2). */
function identity(groups: string[] | null) {
  return {
    sub: 'caller-sub',
    issuer: 'https://cognito-idp.ap-south-1.amazonaws.com/ap-south-1_test',
    username: 'caller-sub',
    claims: { sub: 'caller-sub', 'cognito:groups': groups ?? [] },
    sourceIp: ['203.0.113.10'],
    defaultAuthStrategy: 'ALLOW',
    groups,
  };
}

function feedEvent(
  fieldName: string,
  callerIdentity: unknown = null,
): AppSyncResolverEvent<Record<string, never>> {
  return {
    arguments: {},
    identity: callerIdentity,
    source: null,
    request: { headers: {}, domainName: null },
    info: {
      fieldName,
      parentTypeName: 'Query',
      variables: {},
      selectionSetList: [],
      selectionSetGraphQL: '',
    },
    prev: null,
    stash: {},
  } as unknown as AppSyncResolverEvent<Record<string, never>>;
}

const listPostsEvent = () => feedEvent('listPosts');
const adminListEvent = () => feedEvent('listAllPostsForAdmin', identity(['Admin']));

function handlerWith(pages: unknown[]) {
  const { client, sent } = fakeClient(pages);
  const run = createHandler({ client, tableName: TABLE, now: () => NOW });
  return { run, sent };
}

describe('feed-unit: feed-api Lambda — listPosts (public feed)', () => {
  it('scans the Post table with both filter clauses, an explicit page limit and a cutoff exactly 24h before now (BR2.4, BR2.6)', async () => {
    const { run, sent } = handlerWith([{ Items: [] }]);
    await run(listPostsEvent());
    expect(sent).toHaveLength(1);
    expect(sent[0].name).toBe('ScanCommand');
    expect(sent[0].input).toEqual({
      TableName: TABLE,
      Limit: SCAN_PAGE_LIMIT,
      FilterExpression: 'attribute_not_exists(#deletedAt) AND #dateTime >= :cutoff',
      ExpressionAttributeNames: { '#deletedAt': 'deletedAt', '#dateTime': 'dateTime' },
      ExpressionAttributeValues: { ':cutoff': '2026-09-16T10:00:00.000Z' },
      ExclusiveStartKey: undefined,
    });
  });

  it('returns posts sorted most-recent dateTime first, in the public Post shape (no deletedAt, no __typename)', async () => {
    const { run } = handlerWith([
      {
        Items: [
          aPost({ id: 'soon', dateTime: iso(2 * HOUR_MS) }),
          aPost({ id: 'next-week', dateTime: iso(7 * 24 * HOUR_MS) }),
          aPost({ id: 'earlier-today', dateTime: iso(-3 * HOUR_MS) }),
        ],
      },
    ]);
    const posts = await run(listPostsEvent());
    expect(posts.map((p) => p.id)).toEqual(['next-week', 'soon', 'earlier-today']);
    expect(Object.keys(posts[0]).sort()).toEqual(
      [
        'id',
        'type',
        'title',
        'description',
        'dateTime',
        'createdByGoogleId',
        'createdAt',
        'updatedAt',
      ].sort(),
    );
  });

  it('follows LastEvaluatedKey until exhausted and concatenates the pages', async () => {
    const { run, sent } = handlerWith([
      { Items: [aPost({ id: 'p1', dateTime: iso(HOUR_MS) })], LastEvaluatedKey: { id: 'p1' } },
      { Items: [aPost({ id: 'p2', dateTime: iso(3 * HOUR_MS) })], LastEvaluatedKey: { id: 'p2' } },
      { Items: [aPost({ id: 'p3', dateTime: iso(2 * HOUR_MS) })] },
    ]);
    const posts = await run(listPostsEvent());
    expect(sent.map((c) => c.input.ExclusiveStartKey)).toEqual([
      undefined,
      { id: 'p1' },
      { id: 'p2' },
    ]);
    expect(posts.map((p) => p.id)).toEqual(['p2', 'p3', 'p1']);
  });

  it('returns an empty list for an empty table (and for a page with no Items key)', async () => {
    expect(await handlerWith([{ Items: [] }]).run(listPostsEvent())).toEqual([]);
    expect(await handlerWith([{}]).run(listPostsEvent())).toEqual([]);
  });

  it('surfaces a data-source error instead of swallowing it', async () => {
    const failure = new Error('ProvisionedThroughputExceededException');
    const { run } = handlerWith([failure]);
    await expect(run(listPostsEvent())).rejects.toThrow('ProvisionedThroughputExceededException');
    // Configuration errors fail fast too.
    expect(() => createHandler({ client: fakeClient([]).client, tableName: '' })).toThrow(
      'POST_TABLE_NAME',
    );
    await expect(handlerWith([]).run(feedEvent('getPost'))).rejects.toThrow(
      'unsupported operation getPost',
    );
  });

  it('never returns a deleted or aged-out row even if the data source hands one back (defense in depth, BR2.6)', async () => {
    const { run } = handlerWith([
      {
        Items: [
          aPost({ id: 'live', dateTime: iso(HOUR_MS) }),
          aPost({ id: 'deleted', dateTime: iso(HOUR_MS), deletedAt: iso(-HOUR_MS) }),
          aPost({ id: 'aged-out', dateTime: iso(-25 * HOUR_MS) }),
          aPost({ id: 'on-the-cutoff', dateTime: iso(-24 * HOUR_MS) }),
        ],
      },
    ]);
    const posts = await run(listPostsEvent());
    expect(posts.map((p) => p.id)).toEqual(['live', 'on-the-cutoff']);
    expect(posts.some((p) => 'deletedAt' in p)).toBe(false);
  });
});

describe('feed-unit: feed-api Lambda — listAllPostsForAdmin (Revision 1, F-1)', () => {
  it('scans with ONLY the soft-delete clause and an explicit page limit — no age-out filter (BR2.7, BR2.6)', async () => {
    const { run, sent } = handlerWith([{ Items: [] }]);
    await run(adminListEvent());
    expect(sent).toHaveLength(1);
    expect(sent[0].name).toBe('ScanCommand');
    expect(sent[0].input).toEqual({
      TableName: TABLE,
      Limit: SCAN_PAGE_LIMIT,
      FilterExpression: 'attribute_not_exists(#deletedAt)',
      ExpressionAttributeNames: { '#deletedAt': 'deletedAt' },
      ExpressionAttributeValues: undefined,
      ExclusiveStartKey: undefined,
    });
    expect(sent[0].input.FilterExpression).not.toContain('dateTime');
  });

  it('returns every non-deleted post sorted most-recent first, including ones long past the public feed window (BR2.7)', async () => {
    const { run } = handlerWith([
      {
        Items: [
          aPost({ id: 'aged-out', dateTime: iso(-30 * 24 * HOUR_MS) }),
          aPost({ id: 'upcoming', dateTime: iso(5 * 24 * HOUR_MS) }),
          aPost({ id: 'yesterday', dateTime: iso(-20 * HOUR_MS) }),
        ],
      },
    ]);
    expect((await run(adminListEvent())).map((p) => p.id)).toEqual([
      'upcoming',
      'yesterday',
      'aged-out',
    ]);
    expect(await handlerWith([{ Items: [] }]).run(adminListEvent())).toEqual([]);
  });

  /**
   * The regression test for F-1 itself. The old JS resolver read one page and
   * returned it, so an admin stopped seeing older posts past roughly 100 rows
   * with no error. The fake hands back a `LastEvaluatedKey` on the first call
   * and the remainder on the second: a single-page implementation would return
   * only `page-1-*` here and fail.
   */
  it('pages through the whole table instead of truncating at the first page (F-1 regression)', async () => {
    const { run, sent } = handlerWith([
      {
        Items: [
          aPost({ id: 'page-1-newer', dateTime: iso(-2 * 24 * HOUR_MS) }),
          aPost({ id: 'page-1-older', dateTime: iso(-9 * 24 * HOUR_MS) }),
        ],
        LastEvaluatedKey: { id: 'page-1-older' },
      },
      {
        Items: [
          aPost({ id: 'page-2-newest', dateTime: iso(-1 * 24 * HOUR_MS) }),
          aPost({ id: 'page-2-oldest', dateTime: iso(-40 * 24 * HOUR_MS) }),
        ],
      },
    ]);
    const posts = await run(adminListEvent());
    expect(sent).toHaveLength(2);
    expect(sent.map((c) => c.input.ExclusiveStartKey)).toEqual([undefined, { id: 'page-1-older' }]);
    // Every row from both pages, in one globally sorted list — not per page.
    expect(posts.map((p) => p.id)).toEqual([
      'page-2-newest',
      'page-1-newer',
      'page-1-older',
      'page-2-oldest',
    ]);
  });

  it('refuses a caller outside the Admin group and an anonymous caller, rather than returning an empty list (backstop for BR2.3/BR2.7)', async () => {
    const message = 'requires membership of the Admin group';
    await expect(
      handlerWith([{ Items: [] }]).run(feedEvent('listAllPostsForAdmin', identity(null))),
    ).rejects.toThrow(message);
    await expect(
      handlerWith([{ Items: [] }]).run(feedEvent('listAllPostsForAdmin', identity(['Member']))),
    ).rejects.toThrow(message);
    await expect(
      handlerWith([{ Items: [] }]).run(feedEvent('listAllPostsForAdmin', null)),
    ).rejects.toThrow(message);
    // An IAM principal reaches AppSync without cognito:groups — Amplify's IAM
    // authorization mode does not apply @auth rules, so this backstop is what
    // stops it.
    await expect(
      handlerWith([{ Items: [] }]).run(
        feedEvent('listAllPostsForAdmin', { accountId: '111122223333', userArn: 'arn:aws:iam::x' }),
      ),
    ).rejects.toThrow(message);
    // No Scan was ever issued for any of them.
    const { run, sent } = handlerWith([{ Items: [] }]);
    await expect(run(feedEvent('listAllPostsForAdmin', identity(null)))).rejects.toThrow(message);
    expect(sent).toHaveLength(0);
  });

  it('lets an Admin-group caller through, and still never returns a soft-deleted row (BR2.6)', async () => {
    const { run } = handlerWith([
      {
        Items: [
          aPost({ id: 'live-aged-out', dateTime: iso(-30 * 24 * HOUR_MS) }),
          aPost({
            id: 'deleted',
            dateTime: iso(-2 * 24 * HOUR_MS),
            deletedAt: iso(-HOUR_MS),
          }),
        ],
      },
    ]);
    const posts = await run(adminListEvent());
    expect(posts.map((p) => p.id)).toEqual(['live-aged-out']);
    expect(posts.some((p) => 'deletedAt' in p)).toBe(false);
  });

  it('surfaces a data-source error on the admin path too', async () => {
    const failure = new Error('ResourceNotFoundException');
    await expect(handlerWith([failure]).run(adminListEvent())).rejects.toThrow(
      'ResourceNotFoundException',
    );
  });
});
