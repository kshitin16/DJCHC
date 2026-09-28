/**
 * donation-unit (U4) — runtime side of the release gate declared in
 * `amplify/donations-flag.ts` (FR5.4: donations are a later release).
 *
 * Every donation Lambda calls `assertDonationsEnabled(process.env)` before
 * doing anything else. The check is string-exact on `'true'` so an unset,
 * empty or mistyped variable fails CLOSED.
 */
import { DonationsDisabledError } from './errors';

export type DonationEnv = Record<string, string | undefined>;

export function isDonationsEnabled(env: DonationEnv): boolean {
  return env.DONATIONS_ENABLED === 'true';
}

export function assertDonationsEnabled(env: DonationEnv): void {
  if (!isDonationsEnabled(env)) {
    throw new DonationsDisabledError('Donations are not available yet');
  }
}
