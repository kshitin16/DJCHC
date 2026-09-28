/**
 * donation-unit (U4) — backend-wide release gate for the donations capability.
 *
 * Donations are a LATER-RELEASE capability (FR5.4): the payment-aggregator
 * account does not exist yet and the tax-exemption precondition is unconfirmed,
 * so this pass ships a thin, flagged-off build. Every donation entry point —
 * the three Contract 5 operations (`initiateDonation`, `cancelDonation`,
 * `myDonations`), the Contract 7 webhook receiver and the scheduled
 * reconciliation poller — receives this value as the `DONATIONS_ENABLED`
 * environment variable and refuses cleanly while it is `false`
 * (see `functions/donation-shared/flag.ts`).
 *
 * Enable procedure (README, "Donations (later release, disabled)"):
 *   1. implement the real aggregator in
 *      `functions/donation-shared/aggregator-adapter.ts`,
 *   2. set the two aggregator secrets for the target environment,
 *   3. flip this constant to `true`,
 *   4. self-review the change before merging (project.md Mandated —
 *      payment handling).
 *
 * The literal type keeps the flag honest: it can only ever be flipped here, in
 * source, never at runtime.
 */
export const DONATIONS_ENABLED = false as const;
