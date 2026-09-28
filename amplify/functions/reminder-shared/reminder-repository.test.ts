/**
 * reminder-unit — tests for `ReminderRepository` against a recording fake
 * `send` (paginated Query pages; a `ConditionalCheckFailedException` for the
 * no-op transition). Verifies the R-04 index-scoped Queries.
 */
import { GetCommand, PutCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { ReminderRepository } from './reminder-repository';
import type { DeviceTokenRecord, ReminderRecord } from './types';

type Sent = { name: string; input: Record<string, unknown> };

function conditionFailure(): Error {
  const error = new Error('The conditional request failed');
  error.name = 'ConditionalCheckFailedException';
  return error;
}

/** Records every command; replies from a queue of responses (or throws queued errors). */
function fakeClient(responses: Array<unknown | Error> = []) {
  const sent: Sent[] = [];
  const queue = [...responses];
  return {
    sent,
    send: async (command: { constructor: { name: string }; input: Record<string, unknown> }) => {
      sent.push({ name: command.constructor.name, input: command.input });
      const next = queue.shift();
      if (next instanceof Error) throw next;
      return next ?? {};
    },
  };
}

function aReminder(overrides: Partial<ReminderRecord> = {}): ReminderRecord {
  return {
    id: 'rem-1',
    postId: 'post-1',
    ownerIdentityId: 'identity-A',
    status: 'SCHEDULED',
    initialFireAt: '2026-10-01T03:30:00.000Z',
    createdAt: '2026-09-20T00:00:00.000Z',
    updatedAt: '2026-09-20T00:00:00.000Z',
    ...overrides,
  };
}

function aDeviceToken(overrides: Partial<DeviceTokenRecord> = {}): DeviceTokenRecord {
  return {
    id: 'dev-1',
    ownerIdentityId: 'identity-A',
    pushToken: 'token-1',
    platform: 'ANDROID',
    remindersEnabled: true,
    registeredAt: '2026-09-20T00:00:00.000Z',
    createdAt: '2026-09-20T00:00:00.000Z',
    updatedAt: '2026-09-20T00:00:00.000Z',
    ...overrides,
  };
}

const options = { reminderTableName: 'Reminder-table', deviceTokenTableName: 'DeviceToken-table' };
const NOW = '2026-09-21T10:00:00.000Z';

describe('reminder-unit: ReminderRepository', () => {
  it('listRemindersByOwner Queries ownerIndex keyed on the identity (R-04) and follows LastEvaluatedKey until exhausted', async () => {
    const client = fakeClient([
      { Items: [aReminder({ id: 'rem-1' })], LastEvaluatedKey: { id: 'rem-1' } },
      { Items: [aReminder({ id: 'rem-2' })] },
    ]);
    const rows = await new ReminderRepository(client, options).listRemindersByOwner('identity-A');
    expect(rows.map((r) => r.id)).toEqual(['rem-1', 'rem-2']);
    expect(client.sent.map((s) => s.name)).toEqual([QueryCommand.name, QueryCommand.name]);
    expect(client.sent[0].input).toMatchObject({
      TableName: 'Reminder-table',
      IndexName: 'ownerIndex',
      KeyConditionExpression: '#owner = :owner',
      ExpressionAttributeNames: { '#owner': 'ownerIdentityId' },
      ExpressionAttributeValues: { ':owner': 'identity-A' },
    });
    expect(client.sent[1].input.ExclusiveStartKey).toEqual({ id: 'rem-1' });
    expect(client.sent[0].input).not.toHaveProperty('FilterExpression');
  });

  it('listRemindersByPost Queries postIdIndex keyed on the postId (Contract 8 cascade lookup)', async () => {
    const client = fakeClient([{ Items: [aReminder()] }]);
    const rows = await new ReminderRepository(client, options).listRemindersByPost('post-1');
    expect(rows).toHaveLength(1);
    expect(client.sent[0].input).toMatchObject({
      TableName: 'Reminder-table',
      IndexName: 'postIdIndex',
      KeyConditionExpression: '#postId = :postId',
      ExpressionAttributeValues: { ':postId': 'post-1' },
    });
  });

  it('transitionReminder sends ONE conditional UpdateItem with `#status IN (...)`, writes snoozeFireAt on SNOOZED and removes it otherwise', async () => {
    const client = fakeClient([
      { Attributes: aReminder({ status: 'SNOOZED', snoozeFireAt: '2026-10-01T15:30:00.000Z' }) },
      { Attributes: aReminder({ status: 'CANCELLED' }) },
    ]);
    const repo = new ReminderRepository(client, options);
    const snoozed = await repo.transitionReminder('rem-1', ['SCHEDULED'], 'SNOOZED', NOW, {
      snoozeFireAt: '2026-10-01T15:30:00.000Z',
    });
    expect(snoozed).toEqual({
      applied: true,
      reminder: expect.objectContaining({ status: 'SNOOZED' }),
    });
    expect(client.sent[0]).toMatchObject({
      name: UpdateCommand.name,
      input: {
        TableName: 'Reminder-table',
        Key: { id: 'rem-1' },
        ConditionExpression: 'attribute_exists(id) AND #status IN (:from0)',
        UpdateExpression: 'SET #status = :to, #updatedAt = :now, #snoozeFireAt = :snoozeFireAt',
        ExpressionAttributeValues: {
          ':to': 'SNOOZED',
          ':from0': 'SCHEDULED',
          ':now': NOW,
          ':snoozeFireAt': '2026-10-01T15:30:00.000Z',
        },
        ReturnValues: 'ALL_NEW',
      },
    });

    await repo.transitionReminder('rem-1', ['SCHEDULED', 'SNOOZED'], 'CANCELLED', NOW);
    expect(client.sent[1].input).toMatchObject({
      ConditionExpression: 'attribute_exists(id) AND #status IN (:from0, :from1)',
      UpdateExpression: 'SET #status = :to, #updatedAt = :now REMOVE #snoozeFireAt',
      ExpressionAttributeValues: { ':from0': 'SCHEDULED', ':from1': 'SNOOZED', ':to': 'CANCELLED' },
    });
  });

  it('transitionReminder maps a ConditionalCheckFailedException to { applied: false } (BR7.10 no-op) and rethrows anything else', async () => {
    const throttled = new Error('throttled');
    throttled.name = 'ProvisionedThroughputExceededException';
    const client = fakeClient([conditionFailure(), throttled]);
    const repo = new ReminderRepository(client, options);
    await expect(
      repo.transitionReminder('rem-1', ['SCHEDULED'], 'CANCELLED', NOW),
    ).resolves.toEqual({
      applied: false,
    });
    await expect(repo.transitionReminder('rem-1', ['SCHEDULED'], 'CANCELLED', NOW)).rejects.toBe(
      throttled,
    );
    await expect(repo.transitionReminder('rem-1', [], 'CANCELLED', NOW)).rejects.toThrow(
      'must not be empty',
    );
  });

  it('getDeviceTokenByOwner Queries DeviceToken.ownerIndex (R-04) and returns the most recently registered row', async () => {
    const client = fakeClient([
      {
        Items: [
          aDeviceToken({ id: 'old', registeredAt: '2026-01-01T00:00:00.000Z' }),
          aDeviceToken({ id: 'new', registeredAt: '2026-06-01T00:00:00.000Z' }),
        ],
      },
      { Items: [] },
    ]);
    const repo = new ReminderRepository(client, options);
    expect((await repo.getDeviceTokenByOwner('identity-A'))?.id).toBe('new');
    expect(client.sent[0].input).toMatchObject({
      TableName: 'DeviceToken-table',
      IndexName: 'ownerIndex',
      ExpressionAttributeValues: { ':owner': 'identity-A' },
    });
    expect(await repo.getDeviceTokenByOwner('identity-B')).toBeUndefined();
  });

  it('upsertDeviceToken updates registeredAt (and rotates the token in place) for an existing row, preserving remindersEnabled', async () => {
    const existing = aDeviceToken({
      remindersEnabled: false,
      registeredAt: '2026-01-01T00:00:00.000Z',
    });
    const client = fakeClient([
      { Items: [existing] },
      { Attributes: { ...existing, registeredAt: NOW, updatedAt: NOW } },
    ]);
    const repo = new ReminderRepository(client, options);
    const result = await repo.upsertDeviceToken(
      'identity-A',
      'token-1',
      'ANDROID',
      NOW,
      () => 'unused',
    );
    expect(result.remindersEnabled).toBe(false);
    expect(result.registeredAt).toBe(NOW);
    expect(client.sent.map((s) => s.name)).toEqual([QueryCommand.name, UpdateCommand.name]);
    const update = client.sent[1].input;
    expect(update).toMatchObject({ TableName: 'DeviceToken-table', Key: { id: 'dev-1' } });
    expect(update.UpdateExpression).not.toMatch(/remindersEnabled/);
    expect(update.ExpressionAttributeValues).toEqual({
      ':pushToken': 'token-1',
      ':platform': 'ANDROID',
      ':now': NOW,
    });
  });

  it('upsertDeviceToken creates a row with remindersEnabled = true (BR7.1 on by default) when the identity has none', async () => {
    const client = fakeClient([{ Items: [] }, {}]);
    const repo = new ReminderRepository(client, options);
    const created = await repo.upsertDeviceToken(
      'identity-A',
      'token-9',
      'IOS',
      NOW,
      () => 'dev-new',
    );
    expect(created).toEqual({
      id: 'dev-new',
      ownerIdentityId: 'identity-A',
      pushToken: 'token-9',
      platform: 'IOS',
      remindersEnabled: true,
      registeredAt: NOW,
      createdAt: NOW,
      updatedAt: NOW,
    });
    expect(client.sent[1]).toMatchObject({
      name: PutCommand.name,
      input: {
        TableName: 'DeviceToken-table',
        ConditionExpression: 'attribute_not_exists(id)',
        Item: { ...created, __typename: 'DeviceToken' },
      },
    });
  });

  it('setRemindersEnabled writes ONLY the flag (BR7.7); createReminder/getReminderById use the Reminder table; missing table names fail fast', async () => {
    const client = fakeClient([
      { Attributes: aDeviceToken({ remindersEnabled: false }) },
      {},
      { Item: aReminder() },
    ]);
    const repo = new ReminderRepository(client, options);
    const toggled = await repo.setRemindersEnabled('dev-1', false, NOW);
    expect(toggled.remindersEnabled).toBe(false);
    expect(client.sent[0].input).toMatchObject({
      TableName: 'DeviceToken-table',
      Key: { id: 'dev-1' },
      UpdateExpression: 'SET #remindersEnabled = :enabled, #updatedAt = :now',
      ExpressionAttributeValues: { ':enabled': false, ':now': NOW },
    });

    const { updatedAt: _ignored, ...newReminder } = aReminder();
    void _ignored;
    const created = await repo.createReminder(newReminder);
    expect(created.updatedAt).toBe(created.createdAt);
    expect(client.sent[1]).toMatchObject({
      name: PutCommand.name,
      input: { TableName: 'Reminder-table', ConditionExpression: 'attribute_not_exists(id)' },
    });

    expect((await repo.getReminderById('rem-1'))?.id).toBe('rem-1');
    expect(client.sent[2]).toMatchObject({
      name: GetCommand.name,
      input: { Key: { id: 'rem-1' } },
    });

    expect(() => new ReminderRepository(client, { reminderTableName: '' })).toThrow(
      'REMINDER_TABLE_NAME',
    );
    await expect(
      new ReminderRepository(client, { reminderTableName: 'x' }).getDeviceTokenByOwner('id'),
    ).rejects.toThrow('DEVICE_TOKEN_TABLE_NAME');
  });
});
