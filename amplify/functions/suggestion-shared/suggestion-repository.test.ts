/**
 * suggestion-unit — repository tests against a fake document client that
 * records every command's input and replies with canned outputs. No
 * DynamoDB, no AWS credentials.
 */
import { PutCommand, ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { DAILY_LIMIT } from './rules';
import {
  SuggestionRepository,
  dailyCountKey,
  type SuggestionClientLike,
} from './suggestion-repository';

const TABLE = 'Suggestion-test-table';
const COUNT_TABLE = 'SuggestionDailyCount-test-table';
const SUBMITTED_AT = '2026-09-19T10:00:00.000Z';

type SentCommand = { name: string; input: Record<string, unknown> };

function fakeClient(replies: unknown[]): { client: SuggestionClientLike; sent: SentCommand[] } {
  const sent: SentCommand[] = [];
  const queue = [...replies];
  const client = {
    send: async (command: { constructor: { name: string }; input: Record<string, unknown> }) => {
      sent.push({ name: command.constructor.name, input: command.input });
      const reply = queue.shift();
      if (reply instanceof Error) throw reply;
      return reply ?? {};
    },
  } as unknown as SuggestionClientLike;
  return { client, sent };
}

function repositoryWith(replies: unknown[] = [{}]) {
  const { client, sent } = fakeClient(replies);
  return {
    repository: new SuggestionRepository(client, {
      tableName: TABLE,
      dailyCountTableName: COUNT_TABLE,
    }),
    sent,
  };
}

function conditionalCheckFailed(): Error {
  const error = new Error('The conditional request failed');
  error.name = 'ConditionalCheckFailedException';
  return error;
}

describe('suggestion-unit: SuggestionRepository', () => {
  it('create writes every Contract 4 field plus __typename and the implicit model timestamps, never overwriting an existing id', async () => {
    const { repository, sent } = repositoryWith([{}]);

    const record = await repository.create({
      id: 'sug-0001',
      submittedByGoogleId: 'user-sub',
      text: 'Please add a shoe rack near the entrance.',
      submittedAt: SUBMITTED_AT,
    });

    expect(record).toEqual({
      id: 'sug-0001',
      submittedByGoogleId: 'user-sub',
      text: 'Please add a shoe rack near the entrance.',
      submittedAt: SUBMITTED_AT,
      createdAt: SUBMITTED_AT,
      updatedAt: SUBMITTED_AT,
    });
    expect(sent).toHaveLength(1);
    expect(sent[0].name).toBe(PutCommand.name);
    expect(sent[0].input).toEqual({
      TableName: TABLE,
      ConditionExpression: 'attribute_not_exists(id)',
      Item: { ...record, __typename: 'Suggestion' },
    });
  });

  it('listAll scans the table and concatenates every page, tolerating a page with no Items', async () => {
    const { repository, sent } = repositoryWith([
      { Items: [{ id: 'a' }], LastEvaluatedKey: { id: 'a' } },
      { LastEvaluatedKey: { id: 'a2' } },
      { Items: [{ id: 'b' }] },
    ]);

    const rows = await repository.listAll();

    expect(rows.map((r) => r.id)).toEqual(['a', 'b']);
    expect(sent.map((c) => c.name)).toEqual([ScanCommand.name, ScanCommand.name, ScanCommand.name]);
    expect(sent.map((c) => c.input.ExclusiveStartKey)).toEqual([
      undefined,
      { id: 'a' },
      { id: 'a2' },
    ]);
    expect(sent[0].input.TableName).toBe(TABLE);
  });

  it('tryIncrementDailyCount sends exactly the BR3.5 atomic conditional UpdateItem: ADD count, condition < 5, key <sub>#<date>', async () => {
    const { repository, sent } = repositoryWith([{}]);

    const result = await repository.tryIncrementDailyCount('user-sub', '2026-09-19', 1758738600);

    expect(result).toEqual({ allowed: true });
    expect(sent).toHaveLength(1);
    expect(sent[0].name).toBe(UpdateCommand.name);
    expect(sent[0].input).toEqual({
      TableName: COUNT_TABLE,
      Key: { id: 'user-sub#2026-09-19' },
      UpdateExpression: 'ADD #count :one SET #ttl = if_not_exists(#ttl, :ttl)',
      ConditionExpression: 'attribute_not_exists(#count) OR #count < :five',
      ExpressionAttributeNames: { '#count': 'count', '#ttl': 'ttl' },
      ExpressionAttributeValues: { ':one': 1, ':five': 5, ':ttl': 1758738600 },
    });
    expect(DAILY_LIMIT).toBe(5);
    expect(dailyCountKey('user-sub', '2026-09-19')).toBe('user-sub#2026-09-19');
  });

  it('tryIncrementDailyCount reports { allowed: false } when the condition fails (the 6th submission of the IST day)', async () => {
    const { repository, sent } = repositoryWith([conditionalCheckFailed()]);

    await expect(
      repository.tryIncrementDailyCount('user-sub', '2026-09-19', 1758738600),
    ).resolves.toEqual({ allowed: false });
    expect(sent).toHaveLength(1); // one request: no read-then-write
  });

  it('tryIncrementDailyCount sets ttl only on the first increment of the day via if_not_exists, from the value it was given', async () => {
    const { repository, sent } = repositoryWith([{}, {}]);

    await repository.tryIncrementDailyCount('user-sub', '2026-09-19', 1758738600);
    await repository.tryIncrementDailyCount('user-sub', '2026-09-19', 1758738600);

    for (const command of sent) {
      expect(command.input.UpdateExpression).toContain('if_not_exists(#ttl, :ttl)');
      expect((command.input.ExpressionAttributeValues as Record<string, unknown>)[':ttl']).toBe(
        1758738600,
      );
    }
  });

  it('rethrows any other data-source error unchanged and fails fast on missing table names', async () => {
    const failure = new Error('ProvisionedThroughputExceededException');
    const { repository } = repositoryWith([failure, failure, failure]);
    await expect(repository.listAll()).rejects.toBe(failure);
    await expect(repository.tryIncrementDailyCount('s', '2026-09-19', 1)).rejects.toBe(failure);
    await expect(
      repository.create({
        id: 'x',
        submittedByGoogleId: 's',
        text: 't',
        submittedAt: SUBMITTED_AT,
      }),
    ).rejects.toBe(failure);

    expect(() => new SuggestionRepository(fakeClient([]).client, { tableName: '' })).toThrow(
      'SUGGESTION_TABLE_NAME',
    );
    const readOnly = new SuggestionRepository(fakeClient([{}]).client, { tableName: TABLE });
    await expect(readOnly.tryIncrementDailyCount('s', '2026-09-19', 1)).rejects.toThrow(
      'SUGGESTION_DAILY_COUNT_TABLE_NAME',
    );
  });
});
