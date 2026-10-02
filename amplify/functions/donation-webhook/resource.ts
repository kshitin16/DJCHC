/**
 * donation-unit (U4) — `donation-webhook` Lambda declaration: the Contract 7
 * payment-status receiver, exposed through a Lambda Function URL that
 * `amplify/backend.ts` attaches (auth mode NONE — the aggregator's HMAC
 * signature is the real authentication; security-design.md, "Webhook
 * endpoint security"). See `./handler.ts`.
 *
 * Sizing per infrastructure-specification.md: 256MB / 10s (must answer the
 * aggregator's retry-sensitive caller fast; NFR-PERF.2 < 1s p95).
 *
 * Environment:
 * - `DONATIONS_ENABLED` — release gate (`amplify/donations-flag.ts`); off → 404.
 * - `DONATION_AGGREGATOR_WEBHOOK_SECRET` — `secret()` reference to the
 *   signing secret, resolved at deploy time from the Amplify secret store
 *   (SSM Parameter Store SecureString). TEST-mode value for sandbox/staging,
 *   LIVE only for production (infrastructure-specification.md).
 * - `DONATION_WEBHOOK_SIGNATURE_HEADER` — the header carrying the signature
 *   (Razorpay-style default; Contract 7's payload shape is provisional).
 * - `DONATION_TABLE_NAME` — injected by `amplify/backend.ts`.
 */
import { defineFunction, secret } from '@aws-amplify/backend';
import { DONATIONS_ENABLED } from '../../donations-flag';

export const donationWebhook = defineFunction({
  name: 'donation-webhook',
  entry: './handler.ts',
  memoryMB: 256,
  timeoutSeconds: 10,
  environment: {
    DONATIONS_ENABLED: String(DONATIONS_ENABLED),
    DONATION_AGGREGATOR_WEBHOOK_SECRET: secret('DONATION_AGGREGATOR_WEBHOOK_SECRET'),
    DONATION_WEBHOOK_SIGNATURE_HEADER: 'x-razorpay-signature',
  },
  logging: {
    // 90 days — financial activity (NFR-OBS.2), as resolved at Observability Setup Q2: CloudWatch
    // sets retention per log GROUP, not per level, so the per-level
    // split NFR-OBS.2 asked for cannot be configured. Unset means
    // logs are kept forever, which is both a cost and a privacy leak.
    retention: '3 months',
  },
});
