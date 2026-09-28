/**
 * reminder-unit — tests for `FcmPushSender` with a fake `fetch` and a fake
 * token provider. No Google credential is ever used; the service-account
 * literal below is obviously fake.
 */
import { FcmPushSender, fcmEndpoint, parseServiceAccount } from './push-sender';

function fakeFetch(status: number, bodyText = '') {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fetch = async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return { ok: status >= 200 && status < 300, status, text: async () => bodyText } as Response;
  };
  return { calls, fetch };
}

const notification = {
  title: 'Tomorrow at the temple',
  body: 'Reminder for the event',
  data: { reminderId: 'rem-1', postId: 'post-1' },
};

describe('reminder-unit: FcmPushSender', () => {
  it('POSTs to the FCM v1 endpoint for the project with a Bearer token from the provider', async () => {
    const { calls, fetch } = fakeFetch(200);
    const sender = new FcmPushSender({
      projectId: 'temple-app',
      tokenProvider: () => Promise.resolve('test-token'),
      fetch,
    });
    await sender.send('device-token', 'ANDROID', notification);
    expect(calls[0].url).toBe('https://fcm.googleapis.com/v1/projects/temple-app/messages:send');
    expect(fcmEndpoint('a b')).toBe('https://fcm.googleapis.com/v1/projects/a%20b/messages:send');
    expect(calls[0].init.method).toBe('POST');
    expect(calls[0].init.headers).toEqual({
      Authorization: 'Bearer test-token',
      'Content-Type': 'application/json',
    });
  });

  it('sends the message shape FCM expects: token, notification title/body, data with reminderId/postId', async () => {
    const { calls, fetch } = fakeFetch(200);
    const sender = new FcmPushSender({
      projectId: 'temple-app',
      tokenProvider: () => Promise.resolve('test-token'),
      fetch,
    });
    await sender.send('device-token', 'IOS', notification);
    const body = JSON.parse(calls[0].init.body as string);
    expect(body.message).toMatchObject({
      token: 'device-token',
      notification: { title: 'Tomorrow at the temple', body: 'Reminder for the event' },
      data: { reminderId: 'rem-1', postId: 'post-1', platform: 'IOS' },
    });
  });

  it('surfaces a 404 / UNREGISTERED response as PushTokenInvalidError', async () => {
    const unregistered = fakeFetch(400, '{"error":{"details":[{"errorCode":"UNREGISTERED"}]}}');
    const sender = new FcmPushSender({
      projectId: 'temple-app',
      tokenProvider: () => Promise.resolve('t'),
      fetch: unregistered.fetch,
    });
    await expect(sender.send('dead', 'ANDROID', notification)).rejects.toMatchObject({
      name: 'PushTokenInvalidError',
    });
    const gone = fakeFetch(404);
    await expect(
      new FcmPushSender({
        projectId: 'p',
        tokenProvider: () => Promise.resolve('t'),
        fetch: gone.fetch,
      }).send('dead', 'ANDROID', notification),
    ).rejects.toMatchObject({ name: 'PushTokenInvalidError' });
  });

  it('throws a plain error carrying the HTTP status for any other non-2xx response; validates the service-account JSON', async () => {
    const { fetch } = fakeFetch(503, 'unavailable');
    const sender = new FcmPushSender({
      projectId: 'temple-app',
      tokenProvider: () => Promise.resolve('t'),
      fetch,
    });
    await expect(sender.send('device-token', 'ANDROID', notification)).rejects.toThrow(
      'FCM responded 503',
    );
    expect(
      () => new FcmPushSender({ projectId: '', tokenProvider: () => Promise.resolve('t'), fetch }),
    ).toThrow('projectId is required');
    expect(
      parseServiceAccount('{"project_id":"fake-project","private_key":"not-a-real-key"}'),
    ).toMatchObject({
      project_id: 'fake-project',
    });
    expect(() => parseServiceAccount(undefined)).toThrow('REMINDER_FCM_SERVICE_ACCOUNT is not set');
    expect(() => parseServiceAccount('{')).toThrow('not valid JSON');
    expect(() => parseServiceAccount('{"x":1}')).toThrow('lacks a project_id');
  });
});
