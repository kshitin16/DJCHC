/**
 * donation-unit — repository tests against a fake document client that
 * records every command's input. No DynamoDB, no AWS credentials.
 */
import { GetCommand, PutCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { DonationRepository, type DocumentClientLike } from './donation-repository';
import { DonationStateError } from './errors';

const NOW = '2026-09-16T10:00:00.000Z';
const TABLE = 'Donation-test-table';

type SentCommand = { name: string; input: Record<string, unknown> };

/** Records each command; replies with the canned output (or throws the canned error). */
function fakeClient(reply: unknown = {}): { client: DocumentClientLike; sent: SentCommand[] } {
  const sent: SentCommand[] = [];
  const client = {
    send: async (command: { constructor: { name: string }; input: Record<string, unknown> }) => {
      sent.push({ name: command.constructor.name, input: command.input });
      if (reply instanceof Error) throw reply;
      return reply;
    },
  } as unknown as DocumentClientLike;
  return { client, sent };
}

function repositoryWith(reply?: unknown) {
  const { client, sent } = fakeClient(reply);
  const repository = new DonationRepository(client, {
    tableName: TABLE,
    now: () => NOW,
    newId: () => 'don-0001',
  });
  return { repository, sent };
}

function conditionalCheckFailed(): Error {
  const error = new Error('The conditional request failed');
  error.name = 'ConditionalCheckFailedException';
  return error;
}

describe('donation-unit: DonationRepository', () => {
  it('create writes an INITIATED item with createdAt and never overwrites an existing id', async () => {
    const { repository, sent } = repositoryWith({});

    const record = await repository.create({
      donorGoogleId: 'sub-donor',
      amount: 501,
      donationType: 'RECURRING',
      frequency: 'MONTHLY',
    });

    expect(record).toEqual({
      id: 'don-0001',
      donorGoogleId: 'sub-donor',
      amount: 501,
      donationType: 'RECURRING',
      frequency: 'MONTHLY',
      status: 'INITIATED',
      createdAt: NOW,
      updatedAt: NOW,
    });
    expect(sent).toHaveLength(1);
    expect(sent[0].name).toBe(PutCommand.name);
    expect(sent[0].input).toMatchObject({
      TableName: TABLE,
      ConditionExpression: 'attribute_not_exists(id)',
      Item: { id: 'don-0001', status: 'INITIATED', createdAt: NOW, __typename: 'Donation' },
    });
    expect((sent[0].input.Item as Record<string, unknown>).processedPaymentId).toBeUndefined();
  });

  it('queryByDonor targets donorIndex keyed on donorGoogleId (myDonations)', async () => {
    const { repository, sent } = repositoryWith({ Items: [{ id: 'a' }, { id: 'b' }] });

    const items = await repository.queryByDonor('sub-donor');

    expect(items.map((i) => i.id)).toEqual(['a', 'b']);
    expect(sent[0].name).toBe(QueryCommand.name);
    expect(sent[0].input).toMatchObject({
      TableName: TABLE,
      IndexName: 'donorIndex',
      KeyConditionExpression: 'donorGoogleId = :donor',
      ExpressionAttributeValues: { ':donor': 'sub-donor' },
    });
  });

  it('queryPendingOlderThan targets statusIndex with status = PENDING and a createdAt < cutoff range', async () => {
    const { repository, sent } = repositoryWith({});

    const items = await repository.queryPendingOlderThan('2026-09-16T09:55:00.000Z');

    expect(items).toEqual([]);
    expect(sent[0].name).toBe(QueryCommand.name);
    expect(sent[0].input).toMatchObject({
      IndexName: 'statusIndex',
      KeyConditionExpression: '#status = :pending AND createdAt < :cutoff',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: { ':pending': 'PENDING', ':cutoff': '2026-09-16T09:55:00.000Z' },
    });
  });

  it('markPending is conditioned on the row still being INITIATED and stores the aggregator reference', async () => {
    const { repository, sent } = repositoryWith({
      Attributes: { id: 'don-0001', status: 'PENDING' },
    });

    const updated = await repository.markPending('don-0001', 'order_abc');

    expect(updated.status).toBe('PENDING');
    expect(sent[0].name).toBe(UpdateCommand.name);
    expect(sent[0].input).toMatchObject({
      Key: { id: 'don-0001' },
      ConditionExpression: '#status = :initiated',
      ExpressionAttributeValues: expect.objectContaining({
        ':pending': 'PENDING',
        ':initiated': 'INITIATED',
        ':txn': 'order_abc',
      }),
    });
    expect(sent[0].input.UpdateExpression).toContain('aggregatorTransactionId = :txn');

    const failing = repositoryWith(conditionalCheckFailed());
    await expect(failing.repository.markPending('don-0001', 'order_abc')).rejects.toBeInstanceOf(
      DonationStateError,
    );
  });

  it('applySettlement sends exactly the security-design idempotent UpdateItem and never touches aggregatorTransactionId (BR5.5, NFR5.2)', async () => {
    const { repository, sent } = repositoryWith({
      Attributes: { id: 'don-0001', status: 'SUCCEEDED', processedPaymentId: 'pay_1' },
    });

    const result = await repository.applySettlement('don-0001', 'SUCCEEDED', 'pay_1');

    expect(result.applied).toBe(true);
    expect(result.donation?.status).toBe('SUCCEEDED');
    expect(sent).toHaveLength(1);
    expect(sent[0].name).toBe(UpdateCommand.name);
    expect(sent[0].input).toMatchObject({
      TableName: TABLE,
      Key: { id: 'don-0001' },
      UpdateExpression: 'SET #status = :s, processedPaymentId = :p, updatedAt = :now',
      ConditionExpression: 'attribute_not_exists(processedPaymentId) OR processedPaymentId <> :p',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: { ':s': 'SUCCEEDED', ':p': 'pay_1', ':now': NOW },
    });
    expect(String(sent[0].input.UpdateExpression)).not.toContain('aggregatorTransactionId');
  });

  it('applySettlement maps ConditionalCheckFailedException to { applied: false } and rethrows anything else', async () => {
    const duplicate = repositoryWith(conditionalCheckFailed());
    await expect(
      duplicate.repository.applySettlement('don-0001', 'FAILED', 'pay_1'),
    ).resolves.toEqual({ applied: false });

    const throttled = new Error('Rate exceeded');
    throttled.name = 'ProvisionedThroughputExceededException';
    const failing = repositoryWith(throttled);
    await expect(failing.repository.applySettlement('don-0001', 'FAILED', 'pay_1')).rejects.toBe(
      throttled,
    );
  });

  it('markCancelled is conditioned on SUCCEEDED + RECURRING and records cancelledAt (BR5.6 state guard)', async () => {
    const { repository, sent } = repositoryWith({
      Attributes: { id: 'don-0001', status: 'CANCELLED', cancelledAt: NOW },
    });

    const updated = await repository.markCancelled('don-0001', NOW);

    expect(updated.status).toBe('CANCELLED');
    expect(sent[0].name).toBe(UpdateCommand.name);
    expect(sent[0].input).toMatchObject({
      ConditionExpression: '#status = :succeeded AND donationType = :recurring',
      ExpressionAttributeValues: expect.objectContaining({
        ':cancelled': 'CANCELLED',
        ':succeeded': 'SUCCEEDED',
        ':recurring': 'RECURRING',
        ':at': NOW,
      }),
    });

    const notActive = repositoryWith(conditionalCheckFailed());
    await expect(notActive.repository.markCancelled('don-0001', NOW)).rejects.toThrow(
      /not an active recurring donation/,
    );
  });

  it('getById issues a direct GetItem on the id (webhook order_id lookup, never a Query by payment_id)', async () => {
    const { repository, sent } = repositoryWith({ Item: { id: 'don-0001', status: 'PENDING' } });

    const record = await repository.getById('don-0001');

    expect(record?.status).toBe('PENDING');
    expect(sent[0].name).toBe(GetCommand.name);
    expect(sent[0].input).toEqual({ TableName: TABLE, Key: { id: 'don-0001' } });

    const missing = repositoryWith({});
    await expect(missing.repository.getById('nope')).resolves.toBeUndefined();
  });

  it('refuses to construct without a table name (env DONATION_TABLE_NAME)', () => {
    expect(() => new DonationRepository(fakeClient().client, { tableName: '' })).toThrow(
      /DONATION_TABLE_NAME/,
    );
  });
});
