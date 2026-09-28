/**
 * reminder-unit (U7) — the Contract 3 consumer: `listPosts` called from the
 * `reminder-api` Lambda during a `myReminders` sync (BR7.1). Requests ONLY
 * `id type dateTime` — every field the sync needs and nothing more.
 *
 * `SigV4FeedClient` signs a GraphQL POST to `AMPLIFY_DATA_GRAPHQL_ENDPOINT`
 * with the Lambda's own IAM credentials (`backend.ts` grants `appsync:GraphQL`
 * on the single `Query.listPosts` field ARN — not a schema-wide grant).
 * A signed request rather than Amplify's generated data client: that client
 * depends on a code-generated `$amplify/env/<fn>` module that exists only
 * after a sandbox/pipeline deploy and would break `tsc` in CI (plan "Known
 * deviations"). The signer and `fetch` are injected so tests use fakes.
 *
 * Error handling (integration boundary): a non-2xx response or a GraphQL
 * `errors` array is thrown; the handler decides whether to degrade (the
 * functional spec's "return existing Reminders without backfill").
 */
import { Sha256 } from '@aws-crypto/sha256-js';
import { defaultProvider } from '@aws-sdk/credential-provider-node';
import { SignatureV4 } from '@smithy/signature-v4';
import { GRAPHQL_ENDPOINT_ENV } from './constants';
import type { FeedPost } from './types';

/** What `myReminders` depends on; `SigV4FeedClient` implements it, tests fake it. */
export interface FeedClient {
  listPosts(): Promise<FeedPost[]>;
}

/** The exact selection Contract 3 grants this Unit (`id type dateTime`). */
export const LIST_POSTS_QUERY = 'query ReminderSyncListPosts { listPosts { id type dateTime } }';

/** The request shape the signer takes and `fetch` sends. */
export interface SignableRequest {
  method: string;
  protocol: string;
  hostname: string;
  path: string;
  headers: Record<string, string>;
  body: string;
}

/** The one method the client needs from `SignatureV4` — or a test fake. */
export interface RequestSignerLike {
  sign(request: SignableRequest): Promise<SignableRequest>;
}

export type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

export interface SigV4FeedClientOptions {
  /** env `AMPLIFY_DATA_GRAPHQL_ENDPOINT` */
  endpoint: string;
  signer: RequestSignerLike;
  fetch: FetchLike;
}

/** The real signer: the Lambda's credentials, service `appsync`, region from env. */
export function appSyncSigner(region: string | undefined): RequestSignerLike {
  if (!region) throw new Error('SigV4FeedClient: AWS_REGION is not set');
  return new SignatureV4({
    credentials: defaultProvider(),
    region,
    service: 'appsync',
    sha256: Sha256,
  }) as unknown as RequestSignerLike;
}

export class SigV4FeedClient implements FeedClient {
  private readonly url: URL;

  constructor(private readonly options: SigV4FeedClientOptions) {
    if (!options.endpoint) {
      throw new Error(`SigV4FeedClient: endpoint is required (env ${GRAPHQL_ENDPOINT_ENV})`);
    }
    this.url = new URL(options.endpoint);
  }

  async listPosts(): Promise<FeedPost[]> {
    const body = JSON.stringify({ query: LIST_POSTS_QUERY });
    const signed = await this.options.signer.sign({
      method: 'POST',
      protocol: this.url.protocol,
      hostname: this.url.hostname,
      path: this.url.pathname,
      headers: { 'Content-Type': 'application/json', host: this.url.hostname },
      body,
    });
    const response = await this.options.fetch(this.url.toString(), {
      method: 'POST',
      headers: signed.headers,
      body: signed.body,
    });
    if (!response.ok) {
      throw new Error(`SigV4FeedClient: listPosts responded ${response.status}`);
    }
    const payload = (await response.json()) as {
      data?: { listPosts?: FeedPost[] | null } | null;
      errors?: Array<{ message?: string }>;
    };
    if (payload.errors && payload.errors.length > 0) {
      throw new Error(
        `SigV4FeedClient: listPosts failed: ${payload.errors.map((e) => e.message ?? 'unknown').join('; ')}`,
      );
    }
    return payload.data?.listPosts ?? [];
  }
}
