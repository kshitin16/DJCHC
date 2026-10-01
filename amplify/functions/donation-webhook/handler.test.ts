/**
 * donation-unit — `donation-webhook` handler tests through `createHandler`
 * with a fake repository and the real HMAC verifier (fake secret). No AWS.
 */
import { createHmac } from 'node:crypto';
import type { LambdaFunctionURLEvent } from 'aws-lambda';
import { createHandler, type DonationWebhookDeps } from './handler';
import { SETTLEABLE_STATUSES } from '../donation-shared/donation-repository';
import { PlaceholderAggregatorAdapter } from '../donation-shared/aggregator-adapter';
import { silentLogger } from '../donation-shared/logging';
import type { DonationRecord } from '../donation-shared/types';

const SECRET = 'test-secret';
const NOW = '2026-09-16T10:00:00.000Z';

const aWebhookBody = (overrides: Record<string, unknown> = {}) =>
  JSON.stringify({
    event: 'payment.captured',
    payload: { order_id: 'don-1', payment_id: 'pay_1', amount: 100, status: 'captured' },
    ...overrides,
  });

const sign = (body: string, secret = SECRET) =>
  createHmac('sha256', secret).update(body, 'utf8').digest('hex');

function aDonation(overrides: Partial<DonationRecord> = {}): DonationRecord {
  return {
    id: 'don-1',
    donorGoogleId: 'sub-donor',
    amount: 100,
    donationType: 'ONE_TIME',
    status: 'PENDING',
    aggregatorTransactionId: 'order_abc',
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function fakeRepository(seed: DonationRecord[] = [aDonation()], duplicate = false) {
  const rows = new Map(seed.map((d) => [d.id, { ...d }]));
  const calls: Array<{ op: string; args: unknown[] }> = [];
  const repository: DonationWebhookDeps['repository'] = {
    async getById(id) {
      calls.push({ op: 'getById', args: [id] });
      return rows.get(id);
    },
    async applySettlement(id, status, paymentId) {
      calls.push({ op: 'applySettlement', args: [id, status, paymentId] });
      if (duplicate) return { applied: false };
      const row = rows.get(id)!;
      Object.assign(row, { status, processedPaymentId: paymentId });
      return { applied: true, donation: row };
    },
  };
  return { repository, rows, calls };
}

function anEvent(
  body: string,
  options: { signature?: string; base64?: boolean; method?: string } = {},
): LambdaFunctionURLEvent {
  const signature = options.signature ?? sign(body);
  return {
    version: '2.0',
    routeKey: '$default',
    rawPath: '/',
    rawQueryString: '',
    headers: { 'X-Razorpay-Signature': signature, 'content-type': 'application/json' },
    requestContext: { http: { method: options.method ?? 'POST' } },
    body: options.base64 ? Buffer.from(body, 'utf8').toString('base64') : body,
    isBase64Encoded: options.base64 ?? false,
  } as unknown as LambdaFunctionURLEvent;
}

function handlerWith(
  repo = fakeRepository(),
  env: Record<string, string | undefined> = {
    DONATIONS_ENABLED: 'true',
    DONATION_AGGREGATOR_WEBHOOK_SECRET: SECRET,
  },
) {
  const handler = createHandler({
    repository: repo.repository,
    adapter: new PlaceholderAggregatorAdapter(),
    env,
    logger: silentLogger,
  });
  return { handler, repo };
}

const parse = (response: { body?: string }) => JSON.parse(response.body ?? '{}');

describe('donation-unit: donation-webhook handler', () => {
  it('returns 404 while the flag is off, without verifying or reading anything', async () => {
    const repo = fakeRepository();
    const { handler } = handlerWith(repo, {
      DONATIONS_ENABLED: 'false',
      DONATION_AGGREGATOR_WEBHOOK_SECRET: SECRET,
    });
    const response = await handler(anEvent(aWebhookBody()));
    expect(response.statusCode).toBe(404);
    expect(repo.calls).toEqual([]);
  });

  it('returns 401 on a bad signature and never touches the repository (NFR3.1)', async () => {
    const repo = fakeRepository();
    const { handler } = handlerWith(repo);
    const body = aWebhookBody();

    expect((await handler(anEvent(body, { signature: sign(body, 'wrong') }))).statusCode).toBe(401);
    expect((await handler(anEvent(body, { signature: '' }))).statusCode).toBe(401);
    const tampered = anEvent(body.replace('pay_1', 'pay_9'), { signature: sign(body) });
    expect((await handler(tampered)).statusCode).toBe(401);
    expect(repo.calls).toEqual([]);
  });

  it('applies SUCCEEDED for payment.captured and answers 200 (also with a base64-encoded body)', async () => {
    const repo = fakeRepository();
    const { handler } = handlerWith(repo);

    const response = await handler(anEvent(aWebhookBody(), { base64: true }));

    expect(response.statusCode).toBe(200);
    expect(parse(response)).toEqual({ donationId: 'don-1', status: 'SUCCEEDED', applied: true });
    expect(repo.calls).toEqual([
      { op: 'getById', args: ['don-1'] },
      { op: 'applySettlement', args: ['don-1', 'SUCCEEDED', 'pay_1'] },
    ]);
    expect(repo.rows.get('don-1')).toMatchObject({
      status: 'SUCCEEDED',
      processedPaymentId: 'pay_1',
      aggregatorTransactionId: 'order_abc', // untouched (review R-04)
    });
  });

  it('applies FAILED for payment.failed', async () => {
    const repo = fakeRepository();
    const { handler } = handlerWith(repo);
    const response = await handler(anEvent(aWebhookBody({ event: 'payment.failed' })));
    expect(response.statusCode).toBe(200);
    expect(parse(response).status).toBe('FAILED');
    expect(repo.rows.get('don-1')?.status).toBe('FAILED');
  });

  it('answers 200 with applied=false for a duplicate payment_id (BR5.5)', async () => {
    const repo = fakeRepository(
      [aDonation({ status: 'SUCCEEDED', processedPaymentId: 'pay_1' })],
      true,
    );
    const { handler } = handlerWith(repo);
    const response = await handler(anEvent(aWebhookBody()));
    expect(response.statusCode).toBe(200);
    expect(parse(response).applied).toBe(false);
    expect(repo.calls.map((c) => c.op)).toEqual(['getById', 'applySettlement']);
  });

  it('answers 404 for an unknown order_id and writes nothing (never guesses a match)', async () => {
    const repo = fakeRepository();
    const { handler } = handlerWith(repo);
    const body = aWebhookBody({ payload: { order_id: 'don-unknown', payment_id: 'pay_1' } });
    const response = await handler(anEvent(body));
    expect(response.statusCode).toBe(404);
    expect(repo.calls).toEqual([{ op: 'getById', args: ['don-unknown'] }]);
  });

  it('answers 400 for a well-signed but malformed body, 405 for non-POST, and 500 when the secret is unset or the write fails', async () => {
    const repo = fakeRepository();
    const { handler } = handlerWith(repo);
    expect((await handler(anEvent(aWebhookBody({ event: 'refund.created' })))).statusCode).toBe(
      400,
    );
    expect((await handler(anEvent('not json'))).statusCode).toBe(400);
    expect((await handler(anEvent(aWebhookBody(), { method: 'GET' }))).statusCode).toBe(405);
    expect(repo.calls).toEqual([]);

    const unconfigured = handlerWith(fakeRepository(), { DONATIONS_ENABLED: 'true' });
    expect((await unconfigured.handler(anEvent(aWebhookBody()))).statusCode).toBe(500);

    const failing = fakeRepository();
    failing.repository.applySettlement = async () => {
      throw new Error('DynamoDB unavailable');
    };
    expect((await handlerWith(failing).handler(anEvent(aWebhookBody()))).statusCode).toBe(500);
  });

  it('answers 200 without changing state when the donation is already terminal, so the aggregator stops retrying (F-1)', async () => {
    // A late `payment.failed` for an earlier attempt, carrying a DIFFERENT
    // payment id from the one that already succeeded. The repository's atomic
    // guard refuses the write; the handler must report that as a clean no-op.
    const settled = aDonation({ status: 'SUCCEEDED', processedPaymentId: 'pay_winner' });
    const rows = new Map([[settled.id, { ...settled }]]);
    const calls: Array<{ op: string; args: unknown[] }> = [];
    const repository: DonationWebhookDeps['repository'] = {
      async getById(id) {
        calls.push({ op: 'getById', args: [id] });
        return rows.get(id);
      },
      // Mirrors the real conditional write via its exported settleable set, so
      // the rule itself is not restated here.
      async applySettlement(id, status, paymentId) {
        calls.push({ op: 'applySettlement', args: [id, status, paymentId] });
        const row = rows.get(id)!;
        if (!(SETTLEABLE_STATUSES as readonly string[]).includes(row.status)) {
          return { applied: false, currentStatus: row.status };
        }
        Object.assign(row, { status, processedPaymentId: paymentId });
        return { applied: true, donation: row };
      },
    };

    const handler = createHandler({
      repository,
      adapter: new PlaceholderAggregatorAdapter(),
      env: { DONATIONS_ENABLED: 'true', DONATION_AGGREGATOR_WEBHOOK_SECRET: SECRET },
      logger: silentLogger,
    });

    const body = aWebhookBody({
      event: 'payment.failed',
      payload: { order_id: 'don-1', payment_id: 'pay_late' },
    });
    const response = await handler(anEvent(body));

    expect(response.statusCode).toBe(200);
    expect(parse(response)).toMatchObject({ applied: false, currentStatus: 'SUCCEEDED' });
    expect(rows.get('don-1')?.status).toBe('SUCCEEDED');
    expect(rows.get('don-1')?.processedPaymentId).toBe('pay_winner');
    expect(calls.map((c) => c.op)).toEqual(['getById', 'applySettlement']);
  });
});
