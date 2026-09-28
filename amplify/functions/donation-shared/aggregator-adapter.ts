/**
 * donation-unit (U4) — the ONE boundary between this backend and the payment
 * aggregator.
 *
 * `AggregatorAdapter` is the interface every donation Lambda depends on; the
 * `PlaceholderAggregatorAdapter` below is the thin build's only
 * implementation. When the real aggregator account exists, THIS FILE's
 * implementation is replaced (plus `amplify/donations-flag.ts` flipped) and
 * nothing else in the Unit changes.
 *
 * BR5.1 (project.md Forbidden — never store or transmit raw payment details):
 * the request/response types here carry only amounts, donation metadata and
 * aggregator-issued references. There is deliberately no field for a card
 * number, expiry, CVV, UPI ID or UPI PIN; the donor enters those on the
 * aggregator's own hosted checkout page (`checkoutUrl`), never in this app.
 * `aggregator-adapter.test.ts` asserts the request shape stays that way.
 *
 * NFR3.1 (Contract 7 `aggregatorSignature`): `verifyWebhookSignature` is REAL
 * even in the placeholder — an HMAC-SHA256 hex digest of the raw body,
 * compared in constant time — because that is the Razorpay-compatible scheme
 * Contract 7 assumes and it has no network dependency.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import { AggregatorNotConfiguredError } from './errors';
import type { DonationFrequency, DonationType } from './types';

/** What the aggregator needs to open a checkout session — no payment credentials, ever (BR5.1). */
export interface CheckoutRequest {
  donationId: string;
  amount: number;
  currency: 'INR';
  donationType: DonationType;
  frequency?: DonationFrequency;
}

/** Functional-spec step 5/6: the checkout hand-off returned to the client. */
export interface CheckoutSession {
  checkoutUrl: string;
  checkoutReference: string;
  aggregatorTransactionId: string;
}

/**
 * The aggregator's own record of a payment (BR5.4): `absent` means the
 * aggregator has no such transaction, which the state machine resolves as
 * FAILED — never left hanging, never assumed from the timeout.
 */
export type PaymentRecord = 'captured' | 'failed' | 'absent';

export interface AggregatorAdapter {
  /** Initiate Donation step 4 — open a hosted checkout session. */
  createCheckout(request: CheckoutRequest): Promise<CheckoutSession>;
  /** Reconciliation timeout path (BR5.4) — ask the aggregator what actually happened. */
  getPaymentRecord(aggregatorTransactionId: string): Promise<PaymentRecord>;
  /** Cancel Recurring Donation step 2 — stop future charges; must resolve before CANCELLED is written. */
  stopMandate(aggregatorTransactionId: string): Promise<void>;
  /** Contract 7 signature check; pure, synchronous, no network. */
  verifyWebhookSignature(rawBody: string, signatureHeader: string, secret: string): boolean;
}

/** Constant-time comparison of an HMAC-SHA256 hex signature over the raw body. */
export function verifyHmacSha256Hex(
  rawBody: string,
  signatureHeader: string,
  secret: string,
): boolean {
  if (!secret || !signatureHeader) return false;
  const expected = createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');
  const provided = signatureHeader.trim().toLowerCase();
  if (provided.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(provided, 'utf8'), Buffer.from(expected, 'utf8'));
}

/**
 * Thin-build placeholder (deliberate, per the approved plan): every network
 * method throws `AggregatorNotConfiguredError`. With `DONATIONS_ENABLED=false`
 * no caller reaches these methods; if the flag were flipped without replacing
 * this class, every donation attempt fails loudly instead of pretending.
 */
export class PlaceholderAggregatorAdapter implements AggregatorAdapter {
  async createCheckout(): Promise<CheckoutSession> {
    throw new AggregatorNotConfiguredError('createCheckout');
  }

  async getPaymentRecord(): Promise<PaymentRecord> {
    throw new AggregatorNotConfiguredError('getPaymentRecord');
  }

  async stopMandate(): Promise<void> {
    throw new AggregatorNotConfiguredError('stopMandate');
  }

  verifyWebhookSignature(rawBody: string, signatureHeader: string, secret: string): boolean {
    return verifyHmacSha256Hex(rawBody, signatureHeader, secret);
  }
}
