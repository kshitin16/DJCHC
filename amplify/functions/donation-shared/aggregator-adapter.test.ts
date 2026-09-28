/**
 * donation-unit — placeholder adapter tests: the HMAC check is real, the
 * network methods throw, and the request type has no credential-shaped field
 * (BR5.1). The secret is an obviously fake constant.
 */
import { createHmac } from 'node:crypto';
import {
  PlaceholderAggregatorAdapter,
  verifyHmacSha256Hex,
  type AggregatorAdapter,
  type CheckoutRequest,
} from './aggregator-adapter';
import { AggregatorNotConfiguredError } from './errors';

const SECRET = 'test-secret';
const BODY = JSON.stringify({
  event: 'payment.captured',
  payload: { order_id: 'don-1', payment_id: 'pay_1' },
});
const sign = (body: string, secret: string) =>
  createHmac('sha256', secret).update(body, 'utf8').digest('hex');

describe('donation-unit: PlaceholderAggregatorAdapter', () => {
  // Typed as the interface — exactly how the Lambdas hold it.
  const adapter: AggregatorAdapter = new PlaceholderAggregatorAdapter();

  it('accepts a valid HMAC-SHA256 hex signature over the raw body (NFR3.1, Contract 7)', () => {
    expect(adapter.verifyWebhookSignature(BODY, sign(BODY, SECRET), SECRET)).toBe(true);
    // Case-insensitive hex, surrounding whitespace tolerated.
    expect(
      adapter.verifyWebhookSignature(BODY, ` ${sign(BODY, SECRET).toUpperCase()} `, SECRET),
    ).toBe(true);
  });

  it('rejects a tampered body', () => {
    const tampered = BODY.replace('pay_1', 'pay_2');
    expect(adapter.verifyWebhookSignature(tampered, sign(BODY, SECRET), SECRET)).toBe(false);
  });

  it('rejects a signature made with the wrong secret, a missing signature, and a missing secret', () => {
    expect(adapter.verifyWebhookSignature(BODY, sign(BODY, 'other-secret'), SECRET)).toBe(false);
    expect(adapter.verifyWebhookSignature(BODY, '', SECRET)).toBe(false);
    expect(adapter.verifyWebhookSignature(BODY, sign(BODY, SECRET), '')).toBe(false);
    expect(verifyHmacSha256Hex(BODY, 'abc', SECRET)).toBe(false); // wrong length, no throw
  });

  it('throws AggregatorNotConfiguredError from each network method (thin build)', async () => {
    const request: CheckoutRequest = {
      donationId: 'don-1',
      amount: 100,
      currency: 'INR',
      donationType: 'ONE_TIME',
    };
    await expect(adapter.createCheckout(request)).rejects.toBeInstanceOf(
      AggregatorNotConfiguredError,
    );
    await expect(adapter.getPaymentRecord('order_1')).rejects.toBeInstanceOf(
      AggregatorNotConfiguredError,
    );
    await expect(adapter.stopMandate('order_1')).rejects.toBeInstanceOf(
      AggregatorNotConfiguredError,
    );
    await expect(adapter.createCheckout(request)).rejects.toThrow(/not configured/);
  });

  it('has no credential-shaped field in the checkout request (BR5.1)', () => {
    // Compile-time: a CheckoutRequest cannot carry a card number or UPI PIN.
    type ForbiddenKeys = 'cardNumber' | 'card' | 'cvv' | 'expiry' | 'upiPin' | 'pin' | 'vpa';
    type HasForbidden = Extract<keyof CheckoutRequest, ForbiddenKeys>;
    const noForbiddenKeys: HasForbidden extends never ? true : false = true;
    expect(noForbiddenKeys).toBe(true);

    // Runtime: the only keys a request object carries are donation metadata.
    const request: CheckoutRequest = {
      donationId: 'don-1',
      amount: 100,
      currency: 'INR',
      donationType: 'RECURRING',
      frequency: 'MONTHLY',
    };
    expect(Object.keys(request).sort()).toEqual(
      ['amount', 'currency', 'donationId', 'donationType', 'frequency'].sort(),
    );
    expect(Object.keys(request).join(' ')).not.toMatch(/card|cvv|pin|upi|expiry/i);
  });
});
