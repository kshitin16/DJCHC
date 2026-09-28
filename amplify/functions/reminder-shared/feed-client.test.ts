/**
 * reminder-unit — tests for `SigV4FeedClient` with a fake signer and a fake
 * `fetch`. No credentials, no network.
 */
import { LIST_POSTS_QUERY, SigV4FeedClient, type SignableRequest } from './feed-client';

function fakeSigner() {
  const signed: SignableRequest[] = [];
  return {
    signed,
    sign: async (request: SignableRequest) => {
      signed.push(request);
      return {
        ...request,
        headers: { ...request.headers, Authorization: 'AWS4-HMAC-SHA256 fake' },
      };
    },
  };
}

function fakeFetch(status: number, payload: unknown) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fetch = async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return { ok: status >= 200 && status < 300, status, json: async () => payload } as Response;
  };
  return { calls, fetch };
}

const endpoint = 'https://abc.appsync-api.ap-south-1.amazonaws.com/graphql';

describe('reminder-unit: SigV4FeedClient', () => {
  it('requests exactly `id type dateTime` from listPosts and returns the rows', async () => {
    const signer = fakeSigner();
    const posts = [{ id: 'post-1', type: 'EVENT', dateTime: '2026-10-02T04:30:00.000Z' }];
    const { calls, fetch } = fakeFetch(200, { data: { listPosts: posts } });
    const client = new SigV4FeedClient({ endpoint, signer, fetch });
    await expect(client.listPosts()).resolves.toEqual(posts);
    expect(LIST_POSTS_QUERY).toBe('query ReminderSyncListPosts { listPosts { id type dateTime } }');
    expect(JSON.parse(signer.signed[0].body)).toEqual({ query: LIST_POSTS_QUERY });
    expect(calls[0].init.body).toBe(signer.signed[0].body);
  });

  it('sends the SIGNED request to the endpoint from env (host header, path, Authorization)', async () => {
    const signer = fakeSigner();
    const { calls, fetch } = fakeFetch(200, { data: { listPosts: [] } });
    await new SigV4FeedClient({ endpoint, signer, fetch }).listPosts();
    expect(signer.signed[0]).toMatchObject({
      method: 'POST',
      protocol: 'https:',
      hostname: 'abc.appsync-api.ap-south-1.amazonaws.com',
      path: '/graphql',
      headers: { host: 'abc.appsync-api.ap-south-1.amazonaws.com' },
    });
    expect(calls[0].url).toBe(endpoint);
    expect(calls[0].init.headers).toMatchObject({ Authorization: 'AWS4-HMAC-SHA256 fake' });
    expect(() => new SigV4FeedClient({ endpoint: '', signer, fetch })).toThrow(
      'AMPLIFY_DATA_GRAPHQL_ENDPOINT',
    );
  });

  it('throws on GraphQL errors and on a non-2xx response; a null listPosts is an empty list', async () => {
    const signer = fakeSigner();
    const withErrors = fakeFetch(200, { errors: [{ message: 'Not Authorized' }] });
    await expect(
      new SigV4FeedClient({ endpoint, signer, fetch: withErrors.fetch }).listPosts(),
    ).rejects.toThrow('listPosts failed: Not Authorized');
    const http500 = fakeFetch(500, {});
    await expect(
      new SigV4FeedClient({ endpoint, signer, fetch: http500.fetch }).listPosts(),
    ).rejects.toThrow('responded 500');
    const empty = fakeFetch(200, { data: { listPosts: null } });
    await expect(
      new SigV4FeedClient({ endpoint, signer, fetch: empty.fetch }).listPosts(),
    ).resolves.toEqual([]);
  });
});
