/**
 * pdf-library-unit — repository tests against a fake document client that
 * records every command's input and replies with canned pages. No DynamoDB,
 * no AWS credentials.
 */
import {
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  ScanCommand,
} from '@aws-sdk/lib-dynamodb';
import { DocumentRepository, type DocumentClientLike } from './document-repository';
import { DocumentNotFoundError } from './errors';

const TABLE = 'Document-test-table';
const UPLOADED_AT = '2026-09-19T10:00:00.000Z';

type SentCommand = { name: string; input: Record<string, unknown> };

/** Replies with each canned page in turn (or throws the canned error); records every command. */
function fakeClient(replies: unknown[]): { client: DocumentClientLike; sent: SentCommand[] } {
  const sent: SentCommand[] = [];
  const queue = [...replies];
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

function repositoryWith(replies: unknown[] = [{}]) {
  const { client, sent } = fakeClient(replies);
  return { repository: new DocumentRepository(client, { tableName: TABLE }), sent };
}

function conditionalCheckFailed(): Error {
  const error = new Error('The conditional request failed');
  error.name = 'ConditionalCheckFailedException';
  return error;
}

describe('pdf-library-unit: DocumentRepository', () => {
  it('create writes every entities.md field plus __typename and the implicit model timestamps, never overwriting an existing id', async () => {
    const { repository, sent } = repositoryWith([{}]);

    const record = await repository.create({
      id: 'doc-0001',
      title: 'Bhaktamar Stotra',
      category: 'BHAKTAMAR',
      s3Key: 'documents/BHAKTAMAR/doc-0001.pdf',
      uploadedByGoogleId: 'admin-sub',
      uploadedAt: UPLOADED_AT,
    });

    expect(record).toEqual({
      id: 'doc-0001',
      title: 'Bhaktamar Stotra',
      category: 'BHAKTAMAR',
      s3Key: 'documents/BHAKTAMAR/doc-0001.pdf',
      uploadedByGoogleId: 'admin-sub',
      uploadedAt: UPLOADED_AT,
      createdAt: UPLOADED_AT,
      updatedAt: UPLOADED_AT,
    });
    expect(sent).toHaveLength(1);
    expect(sent[0].name).toBe(PutCommand.name);
    expect(sent[0].input).toEqual({
      TableName: TABLE,
      ConditionExpression: 'attribute_not_exists(id)',
      Item: { ...record, __typename: 'Document' },
    });
  });

  it('getById reads the row by its id key and returns undefined for a missing row', async () => {
    const { repository, sent } = repositoryWith([{ Item: { id: 'doc-1', title: 'x' } }, {}]);

    expect(await repository.getById('doc-1')).toEqual({ id: 'doc-1', title: 'x' });
    expect(await repository.getById('doc-2')).toBeUndefined();
    expect(sent.map((c) => c.name)).toEqual([GetCommand.name, GetCommand.name]);
    expect(sent[0].input).toEqual({ TableName: TABLE, Key: { id: 'doc-1' } });
  });

  it('listByCategory queries categoryIndex newest-first and concatenates every page (BR6.5)', async () => {
    const { repository, sent } = repositoryWith([
      { Items: [{ id: 'a' }], LastEvaluatedKey: { id: 'a' } },
      { Items: [{ id: 'b' }, { id: 'c' }] },
    ]);

    const rows = await repository.listByCategory('DAILY_POOJAN');

    expect(rows.map((r) => r.id)).toEqual(['a', 'b', 'c']);
    expect(sent.map((c) => c.name)).toEqual([QueryCommand.name, QueryCommand.name]);
    expect(sent[0].input).toEqual({
      TableName: TABLE,
      IndexName: 'categoryIndex',
      KeyConditionExpression: 'category = :category',
      ExpressionAttributeValues: { ':category': 'DAILY_POOJAN' },
      ScanIndexForward: false,
      ExclusiveStartKey: undefined,
    });
    expect(sent[1].input.ExclusiveStartKey).toEqual({ id: 'a' });
  });

  it('listAll scans the table and concatenates every page (and tolerates a page with no Items)', async () => {
    const { repository, sent } = repositoryWith([
      { Items: [{ id: 'a' }], LastEvaluatedKey: { id: 'a' } },
      { LastEvaluatedKey: { id: 'a2' } },
      { Items: [{ id: 'b' }] },
    ]);

    const rows = await repository.listAll();

    expect(rows.map((r) => r.id)).toEqual(['a', 'b']);
    expect(sent.map((c) => c.name)).toEqual([ScanCommand.name, ScanCommand.name, ScanCommand.name]);
    expect(sent[0].input).toEqual({ TableName: TABLE, ExclusiveStartKey: undefined });
    expect(sent.map((c) => c.input.ExclusiveStartKey)).toEqual([
      undefined,
      { id: 'a' },
      { id: 'a2' },
    ]);
  });

  it('deleteById is conditioned on the row existing, and a failed condition surfaces as not-found (BR6.4)', async () => {
    const ok = repositoryWith([{}]);
    await ok.repository.deleteById('doc-1');
    expect(ok.sent[0].name).toBe(DeleteCommand.name);
    expect(ok.sent[0].input).toEqual({
      TableName: TABLE,
      Key: { id: 'doc-1' },
      ConditionExpression: 'attribute_exists(id)',
    });

    const gone = repositoryWith([conditionalCheckFailed()]);
    await expect(gone.repository.deleteById('doc-1')).rejects.toBeInstanceOf(DocumentNotFoundError);
  });

  it('rethrows any other data-source error unchanged and fails fast on a missing table name', async () => {
    const failure = new Error('ProvisionedThroughputExceededException');
    const { repository } = repositoryWith([failure, failure, failure]);
    await expect(repository.listAll()).rejects.toBe(failure);
    await expect(repository.deleteById('doc-1')).rejects.toBe(failure);
    await expect(
      repository.create({
        id: 'x',
        title: 't',
        category: 'BHAKTAMAR',
        s3Key: 'documents/BHAKTAMAR/x.pdf',
        uploadedByGoogleId: 's',
        uploadedAt: UPLOADED_AT,
      }),
    ).rejects.toBe(failure);
    expect(() => new DocumentRepository(fakeClient([]).client, { tableName: '' })).toThrow(
      'DOCUMENT_TABLE_NAME',
    );
  });
});
