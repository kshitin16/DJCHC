/**
 * pdf-library-unit — S3 adapter tests with a fake client (records every
 * command) and a fake presigner (records what it was asked to sign). No S3,
 * no real signing, no AWS credentials.
 */
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import { S3Adapter, type Presigner, type S3ClientLike } from './s3-adapter';

const BUCKET = 'documents-test-bucket';
const KEY = 'documents/BHAKTAMAR/doc-0001.pdf';

type SentCommand = { name: string; input: Record<string, unknown> };
type Signed = { name: string; input: Record<string, unknown>; expiresIn: number };

function fakeClient(replies: unknown[]): { client: S3ClientLike; sent: SentCommand[] } {
  const sent: SentCommand[] = [];
  const queue = [...replies];
  const client = {
    send: async (command: { constructor: { name: string }; input: Record<string, unknown> }) => {
      sent.push({ name: command.constructor.name, input: command.input });
      const reply = queue.shift();
      if (reply instanceof Error) throw reply;
      return reply ?? {};
    },
  } as unknown as S3ClientLike;
  return { client, sent };
}

function adapterWith(replies: unknown[] = []) {
  const { client, sent } = fakeClient(replies);
  const signed: Signed[] = [];
  const presign: Presigner = async (_client, command, options) => {
    signed.push({
      name: command.constructor.name,
      input: { ...command.input },
      expiresIn: options.expiresIn,
    });
    return `https://signed.example/${command.input.Key}?expires=${options.expiresIn}`;
  };
  return { adapter: new S3Adapter(client, { bucketName: BUCKET, presign }), sent, signed };
}

describe('pdf-library-unit: S3Adapter', () => {
  it('presignUpload signs a PUT bound to application/pdf on this bucket, valid 900 seconds (NFR-SEC.1.1, BR6.2)', async () => {
    const { adapter, signed, sent } = adapterWith();
    const url = await adapter.presignUpload(KEY);
    expect(url).toBe(`https://signed.example/${KEY}?expires=900`);
    expect(signed).toEqual([
      {
        name: PutObjectCommand.name,
        input: { Bucket: BUCKET, Key: KEY, ContentType: 'application/pdf' },
        expiresIn: 900,
      },
    ]);
    expect(sent).toHaveLength(0); // signing never reaches S3
  });

  it('presignDownload signs a GET on this bucket, valid 3600 seconds (NFR-SEC.1.1)', async () => {
    const { adapter, signed, sent } = adapterWith();
    const url = await adapter.presignDownload(KEY);
    expect(url).toBe(`https://signed.example/${KEY}?expires=3600`);
    expect(signed).toEqual([
      { name: GetObjectCommand.name, input: { Bucket: BUCKET, Key: KEY }, expiresIn: 3600 },
    ]);
    expect(sent).toHaveLength(0);
  });

  it('headObject maps a NotFound / 404 error to { exists: false } and rethrows anything else', async () => {
    const notFound = new Error('NotFound');
    notFound.name = 'NotFound';
    const gone404 = Object.assign(new Error('404'), { $metadata: { httpStatusCode: 404 } });
    const denied = Object.assign(new Error('AccessDenied'), { name: 'AccessDenied' });
    const { adapter, sent } = adapterWith([notFound, gone404, denied]);

    expect(await adapter.headObject(KEY)).toEqual({ exists: false });
    expect(await adapter.headObject(KEY)).toEqual({ exists: false });
    await expect(adapter.headObject(KEY)).rejects.toBe(denied);
    expect(sent[0]).toEqual({ name: HeadObjectCommand.name, input: { Bucket: BUCKET, Key: KEY } });
  });

  it('headObject returns the content type S3 reports for an existing object', async () => {
    const { adapter } = adapterWith([{ ContentType: 'application/pdf' }, {}]);
    expect(await adapter.headObject(KEY)).toEqual({ exists: true, contentType: 'application/pdf' });
    expect(await adapter.headObject(KEY)).toEqual({ exists: true, contentType: undefined });
  });

  it('deleteObject targets exactly this bucket and key, and fails fast on a missing bucket name', async () => {
    const { adapter, sent } = adapterWith([{}]);
    await adapter.deleteObject(KEY);
    expect(sent).toEqual([{ name: DeleteObjectCommand.name, input: { Bucket: BUCKET, Key: KEY } }]);

    expect(() => new S3Adapter(fakeClient([]).client, { bucketName: '' })).toThrow(
      'DOCUMENT_BUCKET_NAME',
    );
  });
});
