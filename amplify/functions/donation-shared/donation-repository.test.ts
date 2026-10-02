/**
 * donation-unit — repository tests. Two kinds of fake:
 *
 * - `fakeClient` records every command's input without interpreting it, for the
 *   assertions about *which* command shape is sent.
 * - `fakeTable` is a one-item table simulator that actually EVALUATES the
 *   `ConditionExpression` and applies the `UpdateExpression`, so the
 *   terminal-state guard (review F-1) is proven by behaviour rather than by
 *   asserting on a string. It understands exactly the grammar this repository
 *   uses: `AND` of parenthesised `OR` groups over `attribute_not_exists(x)`,
 *   `x = :v` and `x <> :v`, with `#alias` names resolved through
 *   `ExpressionAttributeNames`.
 *
 * No DynamoDB, no AWS credentials.
 */
import { GetCommand, PutCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { DonationRepository, type DocumentClientLike } from './donation-repository';
import { DonationStateError } from './errors';
import type { DonationRecord } from './types';

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

// --- Condition-evaluating table simulator ----------------------------------

type Item = Record<string, unknown>;

/** Split on a separator that appears only at parenthesis depth 0. */
function splitTopLevel(expression: string, separator: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (let i = 0; i < expression.length; i += 1) {
    const char = expression[i];
    if (char === '(') depth += 1;
    if (char === ')') depth -= 1;
    if (depth === 0 && expression.startsWith(separator, i)) {
      parts.push(current);
      current = '';
      i += separator.length - 1;
      continue;
    }
    current += char;
  }
  parts.push(current);
  return parts.map((part) => part.trim());
}

function stripOuterParens(expression: string): string {
  const trimmed = expression.trim();
  return trimmed.startsWith('(') && trimmed.endsWith(')') ? trimmed.slice(1, -1).trim() : trimmed;
}

function evaluateCondition(
  expression: string,
  item: Item,
  names: Record<string, string>,
  values: Record<string, unknown>,
): boolean {
  const attribute = (token: string) => (token.startsWith('#') ? names[token] : token);

  const atom = (raw: string): boolean => {
    const text = stripOuterParens(raw);
    const missing = /^attribute_not_exists\(([^)]+)\)$/.exec(text);
    if (missing) return item[attribute(missing[1].trim())] === undefined;
    const comparison = /^(\S+)\s*(=|<>)\s*(:\S+)$/.exec(text);
    if (!comparison) throw new Error(`fakeTable cannot evaluate condition atom: ${text}`);
    const [, left, operator, placeholder] = comparison;
    const actual = item[attribute(left)];
    const expected = values[placeholder];
    return operator === '=' ? actual === expected : actual !== expected;
  };

  return splitTopLevel(expression, ' AND ').every((conjunct) =>
    splitTopLevel(stripOuterParens(conjunct), ' OR ').some(atom),
  );
}

function applyUpdate(
  expression: string,
  item: Item,
  names: Record<string, string>,
  values: Record<string, unknown>,
): Item {
  const set = expression.replace(/^SET\s+/i, '');
  const updated = { ...item };
  for (const assignment of splitTopLevel(set, ', ')) {
    const [left, placeholder] = assignment.split('=').map((side) => side.trim());
    const name = left.startsWith('#') ? names[left] : left;
    updated[name] = values[placeholder];
  }
  return updated;
}

/**
 * A single-row table that honours `ConditionExpression`, so a rejected write
 * behaves the way DynamoDB behaves: `ConditionalCheckFailedException`, with the
 * refused row attached when `ReturnValuesOnConditionCheckFailure: 'ALL_OLD'`.
 */
function fakeTable(initial: Item | undefined) {
  const state: { item: Item | undefined } = { item: initial ? { ...initial } : undefined };
  const client = {
    send: async (command: { constructor: { name: string }; input: Record<string, unknown> }) => {
      const input = command.input as {
        ConditionExpression?: string;
        UpdateExpression?: string;
        ExpressionAttributeNames?: Record<string, string>;
        ExpressionAttributeValues?: Record<string, unknown>;
        ReturnValuesOnConditionCheckFailure?: string;
        Item?: Item;
      };
      const names = input.ExpressionAttributeNames ?? {};
      const values = input.ExpressionAttributeValues ?? {};
      const current = state.item ?? {};
      if (
        input.ConditionExpression &&
        !evaluateCondition(input.ConditionExpression, current, names, values)
      ) {
        const error = conditionalCheckFailed();
        if (input.ReturnValuesOnConditionCheckFailure === 'ALL_OLD') {
          (error as Error & { Item?: Item }).Item = { ...current };
        }
        throw error;
      }
      if (command.constructor.name === PutCommand.name) {
        state.item = { ...(input.Item as Item) };
        return {};
      }
      state.item = applyUpdate(input.UpdateExpression ?? '', current, names, values);
      return { Attributes: { ...state.item } };
    },
  } as unknown as DocumentClientLike;
  const repository = new DonationRepository(client, {
    tableName: TABLE,
    now: () => NOW,
    newId: () => 'don-0001',
  });
  return { repository, state };
}

function aStoredDonation(overrides: Partial<DonationRecord> = {}): Item {
  return {
    id: 'don-0001',
    donorGoogleId: 'sub-donor',
    amount: 501,
    donationType: 'ONE_TIME',
    status: 'PENDING',
    aggregatorTransactionId: 'order_abc',
    createdAt: '2026-09-16T09:00:00.000Z',
    updatedAt: '2026-09-16T09:00:00.000Z',
    ...overrides,
  };
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

    // An id collision surfaces as a typed state error, never a raw DynamoDB one (F-5).
    const colliding = repositoryWith(conditionalCheckFailed());
    await expect(
      colliding.repository.create({ donorGoogleId: 'x', amount: 1, donationType: 'ONE_TIME' }),
    ).rejects.toBeInstanceOf(DonationStateError);
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
    expect(sent[0].input.ExclusiveStartKey).toBeUndefined();
  });

  it('queryPendingOlderThan targets statusIndex with status = PENDING and a createdAt < cutoff range', async () => {
    const { repository, sent } = repositoryWith({});

    const items = await repository.queryPendingOlderThan('2026-09-16T09:55:00.000Z');

    expect(items).toEqual([]);
    expect(sent[0].name).toBe(QueryCommand.name);
    expect(sent[0].input).toMatchObject({
      IndexName: 'statusIndex',
      KeyConditionExpression: '#status = :status AND createdAt < :cutoff',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: { ':status': 'PENDING', ':cutoff': '2026-09-16T09:55:00.000Z' },
    });
  });

  it('queryInitiatedOlderThan sweeps stuck INITIATED rows on the same index (F-3 orphan recovery)', async () => {
    const { repository, sent } = repositoryWith({});

    await repository.queryInitiatedOlderThan('2026-09-15T10:00:00.000Z');

    expect(sent[0].input).toMatchObject({
      IndexName: 'statusIndex',
      ExpressionAttributeValues: { ':status': 'INITIATED', ':cutoff': '2026-09-15T10:00:00.000Z' },
    });
  });

  it('follows LastEvaluatedKey to exhaustion on both queries, so no page is silently dropped (F-4)', async () => {
    const pages = [
      { Items: [{ id: 'p1' }], LastEvaluatedKey: { id: 'p1' } },
      { Items: [{ id: 'p2' }], LastEvaluatedKey: { id: 'p2' } },
      { Items: [{ id: 'p3' }] },
    ];
    const sent: SentCommand[] = [];
    let page = 0;
    const client = {
      send: async (command: { constructor: { name: string }; input: Record<string, unknown> }) => {
        sent.push({ name: command.constructor.name, input: command.input });
        return pages[page++];
      },
    } as unknown as DocumentClientLike;
    const repository = new DonationRepository(client, { tableName: TABLE, now: () => NOW });

    const donorRows = await repository.queryByDonor('sub-donor');
    expect(donorRows.map((r) => r.id)).toEqual(['p1', 'p2', 'p3']);
    expect(sent).toHaveLength(3);
    expect(sent[1].input.ExclusiveStartKey).toEqual({ id: 'p1' });
    expect(sent[2].input.ExclusiveStartKey).toEqual({ id: 'p2' });

    page = 0;
    sent.length = 0;
    const pendingRows = await repository.queryPendingOlderThan('2026-09-16T09:45:00.000Z');
    expect(pendingRows.map((r) => r.id)).toEqual(['p1', 'p2', 'p3']);
    expect(sent).toHaveLength(3);
    expect(sent[2].input.ExclusiveStartKey).toEqual({ id: 'p2' });
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

  it('applySettlement sends one atomic conditional UpdateItem guarding both idempotency and non-terminal status, and never touches aggregatorTransactionId (BR5.5, NFR5.2, F-1)', async () => {
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
      ConditionExpression:
        '(#status = :initiated OR #status = :pending) AND (attribute_not_exists(processedPaymentId) OR processedPaymentId <> :p)',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: {
        ':s': 'SUCCEEDED',
        ':p': 'pay_1',
        ':now': NOW,
        ':initiated': 'INITIATED',
        ':pending': 'PENDING',
      },
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

  // --- F-1: a terminal row cannot be rewritten -----------------------------

  it('a reconciler tick cannot overwrite a SUCCEEDED webhook result with FAILED, even though its synthetic key never collides (F-1)', async () => {
    const { repository, state } = fakeTable(
      aStoredDonation({ status: 'SUCCEEDED', processedPaymentId: 'pay_1' }),
    );

    // The tick listed this row while it was still PENDING; the webhook won the race.
    const result = await repository.applySettlement(
      'don-0001',
      'FAILED',
      'reconciled:order_abc', // deliberately different from 'pay_1' — no key collision
    );

    expect(result.applied).toBe(false);
    expect(result.currentStatus).toBe('SUCCEEDED');
    expect(state.item?.status).toBe('SUCCEEDED');
    expect(state.item?.processedPaymentId).toBe('pay_1');
  });

  it('a late payment.failed for an earlier attempt cannot flip SUCCEEDED to FAILED (F-1)', async () => {
    const { repository, state } = fakeTable(
      aStoredDonation({ status: 'SUCCEEDED', processedPaymentId: 'pay_2' }),
    );

    const result = await repository.applySettlement('don-0001', 'FAILED', 'pay_1');

    expect(result.applied).toBe(false);
    expect(state.item?.status).toBe('SUCCEEDED');
  });

  it('refuses to settle a row that already reached any terminal status, and accepts one that has not', async () => {
    for (const terminal of ['SUCCEEDED', 'FAILED', 'CANCELLED'] as const) {
      const { repository, state } = fakeTable(aStoredDonation({ status: terminal }));
      await expect(repository.applySettlement('don-0001', 'SUCCEEDED', 'pay_new')).resolves.toEqual(
        { applied: false, currentStatus: terminal },
      );
      expect(state.item?.status).toBe(terminal);
    }

    // PENDING settles, and the same delivery replayed is then a clean no-op.
    const pending = fakeTable(aStoredDonation({ status: 'PENDING' }));
    await expect(
      pending.repository.applySettlement('don-0001', 'SUCCEEDED', 'pay_1'),
    ).resolves.toMatchObject({ applied: true });
    expect(pending.state.item?.status).toBe('SUCCEEDED');
    await expect(
      pending.repository.applySettlement('don-0001', 'SUCCEEDED', 'pay_1'),
    ).resolves.toEqual({ applied: false, currentStatus: 'SUCCEEDED' });

    // INITIATED is still settleable: the aggregator's checkout can be paid, and
    // its webhook delivered, before markPending has committed (F-3).
    const initiated = fakeTable(
      aStoredDonation({ status: 'INITIATED', aggregatorTransactionId: undefined }),
    );
    await expect(
      initiated.repository.applySettlement('don-0001', 'SUCCEEDED', 'pay_1'),
    ).resolves.toMatchObject({ applied: true });
    expect(initiated.state.item?.status).toBe('SUCCEEDED');
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

    // Behavioural: a ONE_TIME row is refused even when it is SUCCEEDED.
    const oneTime = fakeTable(aStoredDonation({ status: 'SUCCEEDED', donationType: 'ONE_TIME' }));
    await expect(oneTime.repository.markCancelled('don-0001', NOW)).rejects.toBeInstanceOf(
      DonationStateError,
    );
    expect(oneTime.state.item?.status).toBe('SUCCEEDED');
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
