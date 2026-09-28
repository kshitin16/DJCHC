/** donation-unit — BR5.4 settlement decision and Contract 7 webhook parsing. */
import { DonationValidationError } from './errors';
import { decideSettlement, parseWebhook, settlementForEvent } from './reconciliation';

const aWebhookBody = (overrides: Record<string, unknown> = {}) => ({
  event: 'payment.captured',
  payload: { order_id: 'don-1', payment_id: 'pay_1', amount: 100, status: 'captured' },
  ...overrides,
});

describe('donation-unit: decideSettlement (BR5.4)', () => {
  it('captured → SUCCEEDED', () => {
    expect(decideSettlement('captured')).toBe('SUCCEEDED');
    expect(settlementForEvent('payment.captured')).toBe('SUCCEEDED');
  });

  it('failed → FAILED', () => {
    expect(decideSettlement('failed')).toBe('FAILED');
    expect(settlementForEvent('payment.failed')).toBe('FAILED');
  });

  it('absent → FAILED (the aggregator never saw it; never left PENDING, never guessed SUCCEEDED)', () => {
    expect(decideSettlement('absent')).toBe('FAILED');
  });
});

describe('donation-unit: parseWebhook (Contract 7)', () => {
  it('accepts a valid payload and maps order_id/payment_id', () => {
    expect(parseWebhook(aWebhookBody())).toEqual({
      event: 'payment.captured',
      orderId: 'don-1',
      paymentId: 'pay_1',
    });
    expect(parseWebhook(aWebhookBody({ event: 'payment.failed' })).event).toBe('payment.failed');
  });

  it('rejects an unknown event and a non-object body', () => {
    expect(() => parseWebhook(aWebhookBody({ event: 'refund.created' }))).toThrow(
      DonationValidationError,
    );
    expect(() => parseWebhook('payment.captured')).toThrow(DonationValidationError);
    expect(() => parseWebhook(null)).toThrow(DonationValidationError);
  });

  it('rejects a missing order_id, a missing payment_id, and a missing payload', () => {
    const noOrder = aWebhookBody({ payload: { payment_id: 'pay_1' } });
    expect(() => parseWebhook(noOrder)).toThrow(/order_id/);
    const noPayment = aWebhookBody({ payload: { order_id: 'don-1', payment_id: '' } });
    expect(() => parseWebhook(noPayment)).toThrow(/payment_id/);
    expect(() => parseWebhook({ event: 'payment.captured' })).toThrow(/payload/);
  });
});
