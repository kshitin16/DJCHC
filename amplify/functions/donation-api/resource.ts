/**
 * donation-unit (U4) — `donation-api` Lambda declaration.
 *
 * Handles the three Contract 5 custom operations (`initiateDonation`,
 * `cancelDonation`, `myDonations`) as an AppSync Lambda resolver; see
 * `./handler.ts` for the logic and the rules it realizes (BR5.1–BR5.3, BR5.6).
 *
 * Sizing per infrastructure-specification.md: 256MB / 10s (NFR-PERF.1 —
 * single-item DynamoDB writes plus one outbound aggregator call).
 *
 * Environment:
 * - `DONATIONS_ENABLED` — the release gate from `amplify/donations-flag.ts`
 *   (FR5.4: later release). `false` makes every operation refuse cleanly.
 * - `DONATION_AGGREGATOR_API_KEY` — `secret()` reference resolved at deploy
 *   time from the Amplify secret store (SSM Parameter Store SecureString);
 *   never a literal in source (security-design.md, Secrets management).
 * - `DONATION_TABLE_NAME` — injected by `amplify/backend.ts` from the
 *   Amplify-Data-generated `Donation` table.
 *
 * `resourceGroupName: 'data'` places this function in the data stack: the
 * schema references it as a handler AND it reads the `Donation` table name,
 * which would otherwise be a circular dependency between the two stacks.
 */
import { defineFunction, secret } from '@aws-amplify/backend';
import { DONATIONS_ENABLED } from '../../donations-flag';

export const donationApi = defineFunction({
  name: 'donation-api',
  entry: './handler.ts',
  memoryMB: 256,
  timeoutSeconds: 10,
  resourceGroupName: 'data',
  environment: {
    DONATIONS_ENABLED: String(DONATIONS_ENABLED),
    DONATION_AGGREGATOR_API_KEY: secret('DONATION_AGGREGATOR_API_KEY'),
  },
  logging: {
    // 30 days — the project default (NFR-OBS.2), as resolved at Observability Setup Q2: CloudWatch
    // sets retention per log GROUP, not per level, so the per-level
    // split NFR-OBS.2 asked for cannot be configured. Unset means
    // logs are kept forever, which is both a cost and a privacy leak.
    retention: '1 month',
  },
});
