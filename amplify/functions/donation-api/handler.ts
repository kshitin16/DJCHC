/**
 * donation-unit (U4) — AppSync Lambda resolver for the three Contract 5
 * operations, dispatched on `event.info.fieldName`.
 *
 * Authorization — which layer enforces what (project.md Correction):
 * - AppSync (declarative): every one of these operations is `allow.authenticated()`
 *   in `amplify/data/resource.ts`, so an unauthenticated request never reaches
 *   this code. Cognito has already verified the JWT.
 * - THIS HANDLER (server-side, the enforcing layer for BR5.6 and owner
 *   scoping): the caller's identity is read ONLY from the verified JWT
 *   (`event.identity.sub`, Contract 1) — never from an argument — and every
 *   read/write is scoped to it. `cancelDonation` refuses any donation whose
 *   `donorGoogleId` differs from the caller's `sub` BEFORE touching the
 *   aggregator (BR5.6).
 * - Flutter screens: UX convenience only.
 *
 * Workflows (functional-spec.md):
 * - `initiateDonation`: flag → validate (BR5.2, BR5.3) → create INITIATED →
 *   aggregator checkout (BR5.1: tokenized flow, no card/UPI data here) →
 *   PENDING → `DonationInitiation`. On checkout failure the row stays
 *   INITIATED and a plain-language error is thrown (retryable). If the
 *   INITIATED → PENDING write fails AFTER the checkout was created the donor
 *   still gets the checkout (revision 1, review F-3): the row stays INITIATED,
 *   the aggregator reference is logged, the webhook can still settle it by
 *   `order_id`, and the reconciler's orphan sweep reports it.
 * - `cancelDonation`: flag → load → owner check (BR5.6) → state check
 *   (SUCCEEDED + RECURRING) → aggregator `stopMandate` → CANCELLED. The row is
 *   never CANCELLED before the aggregator acknowledges.
 * - `myDonations`: flag → the caller's own rows via `donorIndex`.
 *
 * NFR-PERF.1: a direct, synchronous resolver — no caching, one aggregator
 * call, two single-item writes.
 */
import type { AppSyncIdentityCognito, AppSyncResolverEvent } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import {
  PlaceholderAggregatorAdapter,
  type AggregatorAdapter,
} from '../donation-shared/aggregator-adapter';
import { DonationRepository } from '../donation-shared/donation-repository';
import {
  DonationAuthorizationError,
  DonationCheckoutError,
  DonationStateError,
  DonationValidationError,
} from '../donation-shared/errors';
import { assertDonationsEnabled, type DonationEnv } from '../donation-shared/flag';
import { createLogger, describeError, type Logger } from '../donation-shared/logging';
import { toPublicDonation, type Donation, type DonationInitiation } from '../donation-shared/types';
import { validateInitiation } from '../donation-shared/validation';

/** The repository surface this handler needs — a real `DonationRepository` or a test fake. */
export type DonationApiRepository = Pick<
  DonationRepository,
  'create' | 'getById' | 'queryByDonor' | 'markPending' | 'markCancelled'
>;

export interface DonationApiDeps {
  repository: DonationApiRepository;
  adapter: Pick<AggregatorAdapter, 'createCheckout' | 'stopMandate'>;
  env: DonationEnv;
  now?: () => string;
  logger?: Logger;
}

export interface InitiateDonationArguments {
  amount: number;
  donationType: string;
  frequency?: string | null;
}

export interface CancelDonationArguments {
  id: string;
}

export type DonationApiEvent = AppSyncResolverEvent<
  Partial<InitiateDonationArguments & CancelDonationArguments>
>;

export type DonationApiResult = DonationInitiation | Donation | Donation[];

/** Contract 1: the caller is whoever the verified Cognito JWT says — never an argument. */
function callerSub(event: DonationApiEvent): string {
  const identity = event.identity as AppSyncIdentityCognito | null | undefined;
  const sub = identity && typeof identity === 'object' ? identity.sub : undefined;
  if (typeof sub !== 'string' || sub.length === 0) {
    // Cannot happen behind `allow.authenticated()`, but never proceed without an identity.
    throw new DonationAuthorizationError('A signed-in identity is required');
  }
  return sub;
}

export function createHandler(deps: DonationApiDeps) {
  const logger = deps.logger ?? createLogger('donation-api');
  const now = deps.now ?? (() => new Date().toISOString());

  async function initiateDonation(
    sub: string,
    args: Partial<InitiateDonationArguments>,
  ): Promise<DonationInitiation> {
    const validation = validateInitiation({
      amount: args.amount,
      donationType: args.donationType,
      frequency: args.frequency ?? undefined,
    });
    if (!validation.ok) {
      throw new DonationValidationError(validation.message);
    }
    const { amount, donationType, frequency } = validation.value;

    const donation = await deps.repository.create({
      donorGoogleId: sub,
      amount,
      donationType,
      ...(frequency ? { frequency } : {}),
    });

    let session;
    try {
      session = await deps.adapter.createCheckout({
        donationId: donation.id,
        amount,
        currency: 'INR',
        donationType,
        ...(frequency ? { frequency } : {}),
      });
    } catch (error) {
      // Error path (functional-spec.md): the row stays INITIATED; the donor may retry.
      logger.error('Aggregator checkout failed; donation left INITIATED', {
        donationId: donation.id,
        ...describeError(error),
      });
      throw new DonationCheckoutError();
    }

    try {
      await deps.repository.markPending(donation.id, session.aggregatorTransactionId);
    } catch (error) {
      // Revision 1, review F-3: the checkout EXISTS at this point, so refusing
      // the donor here would strand a real payable session behind an error. The
      // row stays INITIATED; that is recoverable rather than orphaned because
      // (a) the aggregator's webhook looks the donation up by `order_id`
      // (= `Donation.id`) and `applySettlement` accepts an INITIATED row, and
      // (b) the reconciler's orphan sweep reports rows stuck INITIATED. The
      // aggregator reference is logged so it is never lost.
      logger.error('markPending failed after checkout was created; donation left INITIATED', {
        donationId: donation.id,
        aggregatorTransactionId: session.aggregatorTransactionId,
        ...describeError(error),
      });
    }
    logger.info('Donation initiated', { donationId: donation.id, donationType });
    return {
      donationId: donation.id,
      checkoutUrl: session.checkoutUrl,
      checkoutReference: session.checkoutReference,
    };
  }

  async function cancelDonation(
    sub: string,
    args: Partial<CancelDonationArguments>,
  ): Promise<Donation> {
    if (typeof args.id !== 'string' || args.id.length === 0) {
      throw new DonationValidationError('A donation id is required');
    }
    const donation = await deps.repository.getById(args.id);
    // BR5.6: same refusal whether the row is missing or belongs to someone
    // else, so a caller cannot probe for other donors' ids.
    if (!donation || donation.donorGoogleId !== sub) {
      throw new DonationAuthorizationError();
    }
    if (donation.status !== 'SUCCEEDED' || donation.donationType !== 'RECURRING') {
      throw new DonationStateError(
        'Only an active recurring donation can be cancelled; one-time donations and donations that are not yet successful cannot be',
      );
    }
    if (!donation.aggregatorTransactionId) {
      throw new DonationStateError('This donation has no aggregator reference to cancel');
    }

    // Step 2 before step 3: never CANCELLED until the aggregator acknowledges.
    await deps.adapter.stopMandate(donation.aggregatorTransactionId);
    const cancelled = await deps.repository.markCancelled(donation.id, now());
    logger.info('Recurring donation cancelled', { donationId: donation.id });
    return toPublicDonation(cancelled);
  }

  async function myDonations(sub: string): Promise<Donation[]> {
    const records = await deps.repository.queryByDonor(sub);
    return records.map(toPublicDonation);
  }

  return async function handler(event: DonationApiEvent): Promise<DonationApiResult> {
    assertDonationsEnabled(deps.env);
    const sub = callerSub(event);
    const fieldName = event.info?.fieldName;

    switch (fieldName) {
      case 'initiateDonation':
        return initiateDonation(sub, event.arguments ?? {});
      case 'cancelDonation':
        return cancelDonation(sub, event.arguments ?? {});
      case 'myDonations':
        return myDonations(sub);
      default:
        throw new Error(`donation-api: unsupported operation "${String(fieldName)}"`);
    }
  };
}

// --- Lambda entry point: real clients, built lazily on first use -----------
let realDeps: DonationApiDeps | undefined;

function realDependencies(): DonationApiDeps {
  realDeps ??= {
    repository: new DonationRepository(DynamoDBDocumentClient.from(new DynamoDBClient({})), {
      tableName: process.env.DONATION_TABLE_NAME ?? '',
    }),
    adapter: new PlaceholderAggregatorAdapter(),
    env: process.env,
  };
  return realDeps;
}

export const handler = async (event: DonationApiEvent): Promise<DonationApiResult> => {
  // Flag first, so a disabled deployment never even constructs a client.
  assertDonationsEnabled(process.env);
  return createHandler(realDependencies())(event);
};
