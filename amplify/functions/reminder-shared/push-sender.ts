/**
 * reminder-unit (U7) — server-side push delivery through FCM's HTTP v1 API
 * (BR7.11). FCM was chosen (Infrastructure Design Q1) so one integration
 * covers both `DevicePlatform.IOS` (relayed to APNs by Firebase) and
 * `ANDROID`.
 *
 * `FcmPushSender` needs two things, both injected so tests never touch a
 * real credential or the network:
 * - a token provider — in the Lambda, `serviceAccountTokenProvider()` builds
 *   one from the Firebase service-account JSON in
 *   `REMINDER_FCM_SERVICE_ACCOUNT` (an Amplify `secret()`, never a literal in
 *   source — security-design.md) using `google-auth-library`;
 * - `fetch` — Node 22's global in the Lambda.
 *
 * Error handling (integration boundary): a 404 or an `UNREGISTERED` /
 * `INVALID_ARGUMENT`-on-token error code means the device token is dead and
 * surfaces as `PushTokenInvalidError` (the caller logs a warning and leaves
 * the Reminder pending); every other non-2xx response is thrown as a plain
 * error with the HTTP status so `deliver-push` fails loudly and the
 * Scheduler's own retry applies. Push tokens are never logged.
 */
import { GoogleAuth } from 'google-auth-library';
import { FCM_SERVICE_ACCOUNT_ENV } from './constants';
import { PushTokenInvalidError } from './errors';
import type { DevicePlatform } from './types';

export interface PushNotification {
  title: string;
  body: string;
  /** Delivered as FCM `data` (strings only): the client uses these to deep-link. */
  data: { reminderId: string; postId: string };
}

/** What `deliver-push` depends on; `FcmPushSender` implements it, tests fake it. */
export interface PushSender {
  send(pushToken: string, platform: DevicePlatform, notification: PushNotification): Promise<void>;
}

export type FetchLike = (input: string, init: RequestInit) => Promise<Response>;
export type TokenProvider = () => Promise<string>;

export interface FcmPushSenderOptions {
  /** The Firebase project id (from the service account's `project_id`). */
  projectId: string;
  tokenProvider: TokenProvider;
  fetch: FetchLike;
}

const FCM_SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';

/** The FCM v1 endpoint for a project. */
export function fcmEndpoint(projectId: string): string {
  return `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/messages:send`;
}

/** Parses the service-account JSON from env; throws a clear error if absent or malformed. */
export function parseServiceAccount(
  json: string | undefined,
): { project_id: string } & Record<string, unknown> {
  if (!json) {
    throw new Error(`FcmPushSender: ${FCM_SERVICE_ACCOUNT_ENV} is not set (Amplify secret)`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error(`FcmPushSender: ${FCM_SERVICE_ACCOUNT_ENV} is not valid JSON`);
  }
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    typeof (parsed as { project_id?: unknown }).project_id !== 'string'
  ) {
    throw new Error(`FcmPushSender: ${FCM_SERVICE_ACCOUNT_ENV} lacks a project_id`);
  }
  return parsed as { project_id: string } & Record<string, unknown>;
}

/** The real OAuth2 token provider, built from the service-account JSON. */
export function serviceAccountTokenProvider(
  serviceAccount: Record<string, unknown>,
): TokenProvider {
  const auth = new GoogleAuth({ credentials: serviceAccount, scopes: [FCM_SCOPE] });
  return async () => {
    const token = await auth.getAccessToken();
    if (!token) throw new Error('FcmPushSender: Google OAuth2 returned no access token');
    return token;
  };
}

function isInvalidTokenResponse(status: number, bodyText: string): boolean {
  if (status === 404) return true;
  return /UNREGISTERED|SENDER_ID_MISMATCH/.test(bodyText);
}

export class FcmPushSender implements PushSender {
  constructor(private readonly options: FcmPushSenderOptions) {
    if (!options.projectId) throw new Error('FcmPushSender: projectId is required');
  }

  async send(
    pushToken: string,
    platform: DevicePlatform,
    notification: PushNotification,
  ): Promise<void> {
    const accessToken = await this.options.tokenProvider();
    const message = {
      message: {
        token: pushToken,
        notification: { title: notification.title, body: notification.body },
        data: { ...notification.data, platform },
        // iOS: let the OS present the alert even when the app is backgrounded.
        apns: { payload: { aps: { sound: 'default' } } },
        android: { priority: 'HIGH' },
      },
    };
    const response = await this.options.fetch(fcmEndpoint(this.options.projectId), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });
    if (response.ok) return;
    const bodyText = await response.text().catch(() => '');
    if (isInvalidTokenResponse(response.status, bodyText)) {
      throw new PushTokenInvalidError();
    }
    throw new Error(`FcmPushSender: FCM responded ${response.status}`);
  }
}
