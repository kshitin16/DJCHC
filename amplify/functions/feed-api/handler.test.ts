/**
 * feed-unit — `feed-api` Lambda tests: the public `listPosts` query
 * (BR2.4, BR2.6), against a fake document client that records every Scan.
 * No DynamoDB, no AWS credentials.
 */
import type { AppSyncResolverEvent } from 'aws-lambda';
import { createHandler, type DocumentClientLike, type StoredPost } from './handler';

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

function listPostsEvent(): AppSyncResolverEvent<Record<string, never>> {
  return {
    arguments: {},
    identity: null,
    source: null,
    request: { headers: {}, domainName: null },
    info: {
      fieldName: 'listPosts',
      parentTypeName: 'Query',
      variables: {},
      selectionSetList: [],
      selectionSetGraphQL: '',
    },
    prev: null,
    stash: {},
  };
}

function handlerWith(pages: unknown[]) {
  const { client, sent } = fakeClient(pages);
  const run = createHandler({ client, tableName: TABLE, now: () => NOW });
  return { run, sent };
}

describe('feed-unit: feed-api Lambda (listPosts)', () => {
  it('scans the Post table with both filter clauses and a cutoff exactly 24h before now (BR2.4, BR2.6)', async () => {
    const { run, sent } = handlerWith([{ Items: [] }]);
    await run(listPostsEvent());
    expect(sent).toHaveLength(1);
    expect(sent[0].name).toBe('ScanCommand');
    expect(sent[0].input).toEqual({
      TableName: TABLE,
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
    await expect(
      handlerWith([]).run({
        ...listPostsEvent(),
        info: { ...listPostsEvent().info, fieldName: 'getPost' },
      }),
    ).rejects.toThrow('unsupported operation getPost');
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
