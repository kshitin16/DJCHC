/**
 * pdf-library-unit (U5) — the `document-api` Lambda's S3 boundary.
 *
 * Wraps the four S3 interactions this Unit needs behind a small interface
 * the handler depends on (`S3AdapterLike`), so the handler is tested with a
 * fake and this adapter is tested against a fake client + fake presigner:
 *
 * - `presignUpload`   a pre-signed PUT for `createDocumentUploadUrl`, valid
 *                     15 minutes (NFR-SEC.1.1), locked to
 *                     `Content-Type: application/pdf` so the signature
 *                     itself rejects a PUT that declares another type.
 * - `presignDownload` a pre-signed GET for `getDocumentDownloadUrl`, valid
 *                     1 hour (NFR-SEC.1.1). The bucket blocks all public
 *                     access (NFR-SEC.1.2), so this URL is the ONLY way a
 *                     reader ever fetches a PDF.
 * - `headObject`      `confirmDocumentUpload`'s existence + content-type
 *                     check (BR6.2) — metadata only, the bytes stay in S3.
 * - `deleteObject`    BR6.2's non-PDF cleanup and BR6.4's "S3 file first".
 *
 * Signing is a local SDK operation (no S3 round trip — performance-design.md
 * NFR-PERF.2/3); `headObject` and `deleteObject` are the calls that reach S3.
 *
 * Error handling (integration boundary): a missing object on `HeadObject`
 * (`NotFound` / HTTP 404) is the ONE expected failure and is reported as
 * `{ exists: false }`; every other error (access denied, throttling,
 * network) is rethrown unchanged so the Lambda fails loudly. `DeleteObject`
 * on a key that no longer exists is an S3 no-op, which is exactly what a
 * retried `deleteDocument` relies on (functional-spec.md, Delete Document).
 */
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  type S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  DOWNLOAD_URL_EXPIRES_SECONDS,
  PDF_CONTENT_TYPE,
  UPLOAD_URL_EXPIRES_SECONDS,
} from './constants';

/** The one method the adapter needs — satisfied by a real `S3Client` or a test fake. */
export type S3ClientLike = Pick<S3Client, 'send'>;

/** `getSignedUrl`'s shape, injectable so tests never sign anything real. */
export type Presigner = (
  client: S3ClientLike,
  command: PutObjectCommand | GetObjectCommand,
  options: { expiresIn: number },
) => Promise<string>;

export interface HeadObjectResult {
  exists: boolean;
  /** As S3 reports it (the `Content-Type` the uploader's PUT declared); undefined when absent. */
  contentType?: string;
}

/** What the handler depends on; `S3Adapter` implements it, tests fake it. */
export interface S3AdapterLike {
  presignUpload(key: string): Promise<string>;
  presignDownload(key: string): Promise<string>;
  headObject(key: string): Promise<HeadObjectResult>;
  deleteObject(key: string): Promise<void>;
}

export interface S3AdapterOptions {
  bucketName: string;
  /** Defaults to the real `@aws-sdk/s3-request-presigner`; tests inject a fake. */
  presign?: Presigner;
}

function isNotFound(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const { name, $metadata } = error as { name?: unknown; $metadata?: { httpStatusCode?: unknown } };
  return name === 'NotFound' || name === 'NoSuchKey' || $metadata?.httpStatusCode === 404;
}

export class S3Adapter implements S3AdapterLike {
  private readonly bucketName: string;
  private readonly presign: Presigner;

  constructor(
    private readonly client: S3ClientLike,
    options: S3AdapterOptions,
  ) {
    if (!options.bucketName) {
      throw new Error('S3Adapter: bucketName is required (env DOCUMENT_BUCKET_NAME)');
    }
    this.bucketName = options.bucketName;
    this.presign = options.presign ?? (getSignedUrl as unknown as Presigner);
  }

  /** Upload Document step 3: a 15-minute PUT URL bound to `application/pdf` (NFR-SEC.1.1, BR6.2). */
  presignUpload(key: string): Promise<string> {
    return this.presign(
      this.client,
      new PutObjectCommand({ Bucket: this.bucketName, Key: key, ContentType: PDF_CONTENT_TYPE }),
      { expiresIn: UPLOAD_URL_EXPIRES_SECONDS },
    );
  }

  /** Browse/Download step 2: a 1-hour GET URL (NFR-SEC.1.1, BR6.5). */
  presignDownload(key: string): Promise<string> {
    return this.presign(this.client, new GetObjectCommand({ Bucket: this.bucketName, Key: key }), {
      expiresIn: DOWNLOAD_URL_EXPIRES_SECONDS,
    });
  }

  /** Upload Document step 5 (BR6.2): does the object exist, and what content type did the PUT declare? */
  async headObject(key: string): Promise<HeadObjectResult> {
    try {
      const result = await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucketName, Key: key }),
      );
      return { exists: true, contentType: result.ContentType };
    } catch (error) {
      if (isNotFound(error)) {
        return { exists: false };
      }
      throw error;
    }
  }

  /** BR6.2 cleanup of a non-PDF object; BR6.4 step 2 (the S3 file goes FIRST). */
  async deleteObject(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucketName, Key: key }));
  }
}
