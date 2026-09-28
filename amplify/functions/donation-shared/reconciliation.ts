/**
 * donation-unit (U4) — pure reconciliation logic shared by the webhook
 * receiver and the scheduled poller (Payment Status Reconciliation workflow).
 *
 * - `decideSettlement` (BR5.4): the aggregator's own record — never a timeout —
 *   decides SUCCEEDED or FAILED. Per functional-spec.md's state machine, an
 *   `absent` record (the aggregator never saw the transaction) resolves to
 *   FAILED so no Donation stays PENDING forever.
 * - `parseWebhook` (Contract 7): validates the notification's shape at the
 *   system boundary before anything touches the table.
 */
import { DonationValidationError } from './errors';
import type { SettlementStatus } from './donation-repository';
import type { PaymentRecord } from './aggregator-adapter';

export const WEBHOOK_EVENTS = ['payment.captured', 'payment.failed'] as const;
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

export interface ParsedWebhook {
  event: WebhookEvent;
  /** Contract 7: correlates to `Donation.id` — the lookup key. */
  orderId: string;
  /** Contract 7: the aggregator's own settlement id — the idempotency key (BR5.5), never a lookup key. */
  paymentId: string;
}

export function decideSettlement(record: PaymentRecord): SettlementStatus {
  return record === 'captured' ? 'SUCCEEDED' : 'FAILED';
}

/** Map a Contract 7 event name onto the same decision the timeout path makes. */
export function settlementForEvent(event: WebhookEvent): SettlementStatus {
  return decideSettlement(event === 'payment.captured' ? 'captured' : 'failed');
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Parse and validate a Contract 7 body. Accepts the already-parsed JSON value
 * (the handler decodes the raw body first, because the raw bytes are what the
 * signature covers). Throws `DonationValidationError` on any shape problem.
 */
export function parseWebhook(body: unknown): ParsedWebhook {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new DonationValidationError('Webhook body must be a JSON object');
  }
  const { event, payload } = body as { event?: unknown; payload?: unknown };

  if (!nonEmptyString(event) || !(WEBHOOK_EVENTS as readonly string[]).includes(event)) {
    throw new DonationValidationError(
      `Unsupported webhook event; expected one of ${WEBHOOK_EVENTS.join(', ')}`,
    );
  }
  if (typeof payload !== 'object' || payload === null) {
    throw new DonationValidationError('Webhook payload is missing');
  }
  const { order_id: orderId, payment_id: paymentId } = payload as {
    order_id?: unknown;
    payment_id?: unknown;
  };
  if (!nonEmptyString(orderId)) {
    throw new DonationValidationError('Webhook payload.order_id is required');
  }
  if (!nonEmptyString(paymentId)) {
    throw new DonationValidationError('Webhook payload.payment_id is required');
  }
  return { event: event as WebhookEvent, orderId, paymentId };
}
