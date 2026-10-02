/**
 * donation-unit (U4) — `donation-reconciler` Lambda declaration: the scheduled
 * poller for the Payment Status Reconciliation workflow's timeout path (BR5.4,
 * NFR5.1). EventBridge Scheduler invokes it every minute
 * (infrastructure-specification.md, `rate(1 minute)`); see `./handler.ts`.
 *
 * Sizing per infrastructure-specification.md: 256MB / 60s (bounded by the
 * aggregator's status-query API, one call per stale PENDING donation).
 *
 * Environment:
 * - `DONATIONS_ENABLED` — release gate; off → the tick is a logged no-op.
 * - `DONATION_AGGREGATOR_API_KEY` — `secret()` reference (Amplify secret
 *   store / SSM SecureString), never a literal.
 * - `DONATION_CONFIRMATION_WINDOW_MINUTES` — how long a PENDING donation may
 *   wait for the aggregator's webhook before the poller asks the aggregator
 *   directly. 15 minutes matches a typical hosted-checkout session lifetime.
 * - `DONATION_INITIATED_SWEEP_MINUTES` — how long a row may stay INITIATED
 *   before the tick reports it as an orphan (revision 1, review F-3). 24 hours
 *   is far past any aggregator webhook retry schedule, so a payment still in
 *   flight is never reported as stuck.
 * - `DONATION_TABLE_NAME` — injected by `amplify/backend.ts`.
 */
import { defineFunction, secret } from '@aws-amplify/backend';
import { DONATIONS_ENABLED } from '../../donations-flag';

export const donationReconciler = defineFunction({
  name: 'donation-reconciler',
  entry: './handler.ts',
  memoryMB: 256,
  timeoutSeconds: 60,
  schedule: 'every 1m',
  environment: {
    DONATIONS_ENABLED: String(DONATIONS_ENABLED),
    DONATION_AGGREGATOR_API_KEY: secret('DONATION_AGGREGATOR_API_KEY'),
    DONATION_CONFIRMATION_WINDOW_MINUTES: '15',
    DONATION_INITIATED_SWEEP_MINUTES: '1440',
  },
  logging: {
    // 90 days — financial activity (NFR-OBS.2), as resolved at Observability Setup Q2: CloudWatch
    // sets retention per log GROUP, not per level, so the per-level
    // split NFR-OBS.2 asked for cannot be configured. Unset means
    // logs are kept forever, which is both a cost and a privacy leak.
    retention: '3 months',
  },
});
