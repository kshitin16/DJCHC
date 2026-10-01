/**
 * pdf-library-unit — `document-api` Lambda tests: all five Contract 6
 * operations against a fake repository and a fake S3 adapter that record
 * every call in order (so BR6.4's "S3 before record" is assertable). No
 * DynamoDB, no S3, no AWS credentials.
 */
import type { AppSyncResolverEvent } from 'aws-lambda';
import type { DocumentRepositoryLike } from '../document-shared/document-repository';
import {
  DocumentAuthorizationError,
  DocumentNotFoundError,
  DocumentValidationError,
} from '../document-shared/errors';
import type { HeadObjectResult, S3AdapterLike } from '../document-shared/s3-adapter';
import type { DocumentRecord, NewDocument } from '../document-shared/types';
import { createHandler, type DocumentApiArguments } from './handler';

const NOW = '2026-09-19T10:00:00.000Z';
const UUID = '6f1a2b3c-4d5e-4f60-8a71-92b3c4d5e6f7';
const KEY = `documents/BHAKTAMAR/${UUID}.pdf`;

function aDocument(overrides: Partial<DocumentRecord> & { id: string }): DocumentRecord {
  return {
    title: 'Bhaktamar Stotra',
    category: 'BHAKTAMAR',
    s3Key: `documents/BHAKTAMAR/${overrides.id}.pdf`,
    uploadedByGoogleId: 'admin-sub',
    uploadedAt: NOW,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

type Call = { target: 'repo' | 's3'; method: string; args: unknown[] };

class FakeDocumentRepository implements DocumentRepositoryLike {
  rows = new Map<string, DocumentRecord>();
  failDelete?: Error;
  constructor(private readonly calls: Call[]) {}
  async create(document: NewDocument): Promise<DocumentRecord> {
    this.calls.push({ target: 'repo', method: 'create', args: [document] });
    const record = { ...document, createdAt: document.uploadedAt, updatedAt: document.uploadedAt };
    this.rows.set(record.id, record);
    return record;
  }
  async getById(id: string): Promise<DocumentRecord | undefined> {
    this.calls.push({ target: 'repo', method: 'getById', args: [id] });
    return this.rows.get(id);
  }
  async listByCategory(category: string): Promise<DocumentRecord[]> {
    this.calls.push({ target: 'repo', method: 'listByCategory', args: [category] });
    return [...this.rows.values()].filter((d) => d.category === category);
  }
  async listAll(): Promise<DocumentRecord[]> {
    this.calls.push({ target: 'repo', method: 'listAll', args: [] });
    return [...this.rows.values()];
  }
  async deleteById(id: string): Promise<void> {
    this.calls.push({ target: 'repo', method: 'deleteById', args: [id] });
    if (this.failDelete) throw this.failDelete;
    this.rows.delete(id);
  }
}

class FakeS3Adapter implements S3AdapterLike {
  objects = new Map<string, HeadObjectResult>();
  constructor(private readonly calls: Call[]) {}
  async presignUpload(key: string): Promise<string> {
    this.calls.push({ target: 's3', method: 'presignUpload', args: [key] });
    return `https://signed.example/put/${key}`;
  }
  async presignDownload(key: string): Promise<string> {
    this.calls.push({ target: 's3', method: 'presignDownload', args: [key] });
    return `https://signed.example/get/${key}`;
  }
  async headObject(key: string): Promise<HeadObjectResult> {
    this.calls.push({ target: 's3', method: 'headObject', args: [key] });
    return this.objects.get(key) ?? { exists: false };
  }
  async deleteObject(key: string): Promise<void> {
    this.calls.push({ target: 's3', method: 'deleteObject', args: [key] });
    this.objects.delete(key);
  }
}

function harness() {
  const calls: Call[] = [];
  const repository = new FakeDocumentRepository(calls);
  const s3 = new FakeS3Adapter(calls);
  const run = createHandler({ repository, s3, now: () => NOW, newId: () => UUID });
  return { run, calls, repository, s3 };
}

type Identity = AppSyncResolverEvent<DocumentApiArguments>['identity'];

function cognito(sub: string, groups: string[] | null): Identity {
  return {
    sub,
    issuer: 'https://cognito-idp.ap-south-1.amazonaws.com/pool',
    username: sub,
    claims: {},
    sourceIp: [],
    defaultAuthStrategy: 'ALLOW',
    groups,
  };
}
const adminCtx = () => cognito('admin-sub', ['Admin']);
const userCtx = () => cognito('user-sub', null);
const guestCtx = (): Identity => null;

function event(
  fieldName: string,
  args: DocumentApiArguments,
  identity: Identity,
): AppSyncResolverEvent<DocumentApiArguments> {
  return {
    arguments: args,
    identity,
    source: null,
    request: { headers: {}, domainName: null },
    info: {
      fieldName,
      parentTypeName:
        fieldName.startsWith('list') || fieldName.startsWith('get') ? 'Query' : 'Mutation',
      variables: {},
      selectionSetList: [],
      selectionSetGraphQL: '',
    },
    prev: null,
    stash: {},
  };
}

describe('pdf-library-unit: document-api Lambda', () => {
  // --- listDocuments (BR6.5) --------------------------------------------------
  it('listDocuments with a category queries the index for that category only, as a guest', async () => {
    const { run, calls, repository } = harness();
    repository.rows.set('a', aDocument({ id: 'a', category: 'DAILY_POOJAN' }));
    repository.rows.set('b', aDocument({ id: 'b', category: 'BHAKTAMAR' }));
    const result = await run(event('listDocuments', { category: 'DAILY_POOJAN' }, guestCtx()));
    expect((result as DocumentRecord[]).map((d) => d.id)).toEqual(['a']);
    expect(calls).toEqual([{ target: 'repo', method: 'listByCategory', args: ['DAILY_POOJAN'] }]);
    await expect(run(event('listDocuments', { category: 'SERMONS' }, guestCtx()))).rejects.toThrow(
      DocumentValidationError,
    );
  });

  it('listDocuments without a category scans the whole table and sorts newest upload first', async () => {
    const { run, calls, repository } = harness();
    repository.rows.set('old', aDocument({ id: 'old', uploadedAt: '2026-01-01T00:00:00.000Z' }));
    repository.rows.set('new', aDocument({ id: 'new', uploadedAt: '2026-09-01T00:00:00.000Z' }));
    repository.rows.set('mid', aDocument({ id: 'mid', uploadedAt: '2026-05-01T00:00:00.000Z' }));
    const result = await run(event('listDocuments', {}, userCtx()));
    expect((result as DocumentRecord[]).map((d) => d.id)).toEqual(['new', 'mid', 'old']);
    expect(calls).toEqual([{ target: 'repo', method: 'listAll', args: [] }]);
  });

  // --- getDocumentDownloadUrl (BR6.5, NFR-SEC.1.1) -----------------------------
  it('getDocumentDownloadUrl signs the stored record s3Key for a guest', async () => {
    const { run, calls, repository } = harness();
    repository.rows.set('a', aDocument({ id: 'a' }));
    const url = await run(event('getDocumentDownloadUrl', { id: 'a' }, guestCtx()));
    expect(url).toBe('https://signed.example/get/documents/BHAKTAMAR/a.pdf');
    expect(calls.map((c) => c.method)).toEqual(['getById', 'presignDownload']);
  });

  it('getDocumentDownloadUrl errors on an unknown id without signing anything', async () => {
    const { run, calls } = harness();
    await expect(run(event('getDocumentDownloadUrl', { id: 'nope' }, guestCtx()))).rejects.toThrow(
      DocumentNotFoundError,
    );
    expect(calls.map((c) => c.method)).toEqual(['getById']);
  });

  // --- createDocumentUploadUrl (BR6.1, BR6.3) --------------------------------
  it('createDocumentUploadUrl returns the contract shape with a documents/<category>/<uuid>.pdf key and writes no record', async () => {
    const { run, calls, repository } = harness();
    const target = await run(
      event('createDocumentUploadUrl', { title: 'Stotra', category: 'BHAKTAMAR' }, adminCtx()),
    );
    expect(target).toEqual({ uploadUrl: `https://signed.example/put/${KEY}`, s3Key: KEY });
    expect(calls).toEqual([{ target: 's3', method: 'presignUpload', args: [KEY] }]);
    expect(repository.rows.size).toBe(0);
  });

  it('createDocumentUploadUrl rejects a bad category or empty title before presigning', async () => {
    const { run, calls } = harness();
    await expect(
      run(event('createDocumentUploadUrl', { title: 'Stotra', category: 'SERMONS' }, adminCtx())),
    ).rejects.toThrow(DocumentValidationError);
    await expect(
      run(event('createDocumentUploadUrl', { title: '  ', category: 'BHAKTAMAR' }, adminCtx())),
    ).rejects.toThrow(DocumentValidationError);
    expect(calls).toEqual([]);
  });

  it('createDocumentUploadUrl refuses a non-admin and a guest (BR6.3 backstop)', async () => {
    const { run, calls } = harness();
    const args = { title: 'Stotra', category: 'BHAKTAMAR' };
    await expect(run(event('createDocumentUploadUrl', args, userCtx()))).rejects.toThrow(
      DocumentAuthorizationError,
    );
    await expect(run(event('createDocumentUploadUrl', args, guestCtx()))).rejects.toThrow(
      DocumentAuthorizationError,
    );
    expect(calls).toEqual([]);
  });

  // --- confirmDocumentUpload (BR6.2) -----------------------------------------
  // This authorization test is NOT a backstop check, despite the "backstop"
  // framing on its siblings above. `confirmDocumentUpload` is Lambda-backed, so
  // its declared `allow.group('Admin')` is NOT translated into an
  // `@aws_cognito_user_pools(cognito_groups:["Admin"])` directive by Amplify
  // Data — verified against the deployed SDL on 2026-10-01. AppSync therefore
  // admits any authenticated Cognito user and `requireAdmin` is the ONLY thing
  // that refuses a non-admin. This test is what keeps that from being deleted
  // by someone who reads the (now corrected) comments and believes AppSync has
  // already filtered the caller.
  it('confirmDocumentUpload refuses a non-admin and a guest before touching S3 or the table (BR6.3 — sole enforcing layer)', async () => {
    const { run, calls, s3 } = harness();
    s3.objects.set(KEY, { exists: true, contentType: 'application/pdf' });
    const args = { title: 'Stotra', category: 'BHAKTAMAR', s3Key: KEY };
    await expect(run(event('confirmDocumentUpload', args, userCtx()))).rejects.toThrow(
      DocumentAuthorizationError,
    );
    await expect(run(event('confirmDocumentUpload', args, guestCtx()))).rejects.toThrow(
      DocumentAuthorizationError,
    );
    // Refused before any side effect: no record written for an object that
    // does exist in S3, so the refusal is authorization and not a lookup miss.
    expect(calls).toEqual([]);
  });

  it('confirmDocumentUpload creates the record from the key, with uploadedByGoogleId from identity.sub', async () => {
    const { run, calls, s3 } = harness();
    s3.objects.set(KEY, { exists: true, contentType: 'application/pdf' });
    const record = await run(
      event(
        'confirmDocumentUpload',
        { s3Key: KEY, title: ' Bhaktamar Stotra ', category: 'BHAKTAMAR' },
        adminCtx(),
      ),
    );
    expect(record).toEqual({
      id: UUID,
      title: 'Bhaktamar Stotra',
      category: 'BHAKTAMAR',
      s3Key: KEY,
      uploadedByGoogleId: 'admin-sub',
      uploadedAt: NOW,
      createdAt: NOW,
      updatedAt: NOW,
    });
    expect(calls.map((c) => c.method)).toEqual(['headObject', 'create']);
  });

  it('confirmDocumentUpload deletes a non-PDF object and rejects, creating no record (BR6.2)', async () => {
    const { run, calls, s3, repository } = harness();
    s3.objects.set(KEY, { exists: true, contentType: 'application/octet-stream' });
    await expect(
      run(
        event(
          'confirmDocumentUpload',
          { s3Key: KEY, title: 'x', category: 'BHAKTAMAR' },
          adminCtx(),
        ),
      ),
    ).rejects.toThrow('not a PDF');
    expect(calls.map((c) => c.method)).toEqual(['headObject', 'deleteObject']);
    expect(s3.objects.has(KEY)).toBe(false);
    expect(repository.rows.size).toBe(0);
  });

  it('confirmDocumentUpload errors on a missing object, and refuses a key it did not issue or a mismatched category', async () => {
    const { run, calls } = harness();
    await expect(
      run(
        event(
          'confirmDocumentUpload',
          { s3Key: KEY, title: 'x', category: 'BHAKTAMAR' },
          adminCtx(),
        ),
      ),
    ).rejects.toThrow(DocumentNotFoundError);
    expect(calls.map((c) => c.method)).toEqual(['headObject']);

    for (const s3Key of [`../${KEY}`, 'public/evil.pdf', `documents/BHAKTAMAR/${UUID}.exe`]) {
      await expect(
        run(
          event('confirmDocumentUpload', { s3Key, title: 'x', category: 'BHAKTAMAR' }, adminCtx()),
        ),
      ).rejects.toThrow(DocumentValidationError);
    }
    await expect(
      run(
        event(
          'confirmDocumentUpload',
          { s3Key: KEY, title: 'x', category: 'DAILY_POOJAN' },
          adminCtx(),
        ),
      ),
    ).rejects.toThrow('does not match');
    expect(calls).toHaveLength(1); // nothing else reached S3 or the table
    await expect(
      run(
        event(
          'confirmDocumentUpload',
          { s3Key: KEY, title: 'x', category: 'BHAKTAMAR' },
          userCtx(),
        ),
      ),
    ).rejects.toThrow(DocumentAuthorizationError);
  });

  // --- deleteDocument (BR6.3, BR6.4) -----------------------------------------
  it('deleteDocument removes the S3 object BEFORE the record and returns the id (BR6.4)', async () => {
    const { run, calls, repository, s3 } = harness();
    repository.rows.set('a', aDocument({ id: 'a' }));
    s3.objects.set('documents/BHAKTAMAR/a.pdf', { exists: true, contentType: 'application/pdf' });
    expect(await run(event('deleteDocument', { id: 'a' }, adminCtx()))).toBe('a');
    expect(calls).toEqual([
      { target: 'repo', method: 'getById', args: ['a'] },
      { target: 's3', method: 'deleteObject', args: ['documents/BHAKTAMAR/a.pdf'] },
      { target: 'repo', method: 'deleteById', args: ['a'] },
    ]);
    expect(repository.rows.has('a')).toBe(false);
    expect(s3.objects.has('documents/BHAKTAMAR/a.pdf')).toBe(false);
    await expect(run(event('deleteDocument', { id: 'a' }, adminCtx()))).rejects.toThrow(
      DocumentNotFoundError,
    );
  });

  it('deleteDocument surfaces a record-delete failure after S3 succeeded (retryable), refuses a non-admin, and rejects unknown operations', async () => {
    const { run, calls, repository, s3 } = harness();
    repository.rows.set('a', aDocument({ id: 'a' }));
    s3.objects.set('documents/BHAKTAMAR/a.pdf', { exists: true, contentType: 'application/pdf' });
    repository.failDelete = new Error('ProvisionedThroughputExceededException');
    await expect(run(event('deleteDocument', { id: 'a' }, adminCtx()))).rejects.toThrow(
      'ProvisionedThroughputExceededException',
    );
    expect(calls.map((c) => c.method)).toEqual(['getById', 'deleteObject', 'deleteById']);
    expect(s3.objects.has('documents/BHAKTAMAR/a.pdf')).toBe(false); // file gone
    expect(repository.rows.has('a')).toBe(true); // record remains — retry resolves it

    await expect(run(event('deleteDocument', { id: 'a' }, userCtx()))).rejects.toThrow(
      DocumentAuthorizationError,
    );
    await expect(run(event('getDocument', { id: 'a' }, adminCtx()))).rejects.toThrow(
      'unsupported operation getDocument',
    );
    expect(calls).toHaveLength(3);
  });
});
