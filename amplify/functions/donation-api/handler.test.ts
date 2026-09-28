/**
 * donation-unit — `donation-api` handler tests with a fake repository and a
 * fake aggregator adapter injected through `createHandler`. No AWS access.
 */
import type { AppSyncResolverEvent } from 'aws-lambda';
import { createHandler, type DonationApiDeps, type DonationApiEvent } from './handler';
import type { CheckoutRequest, CheckoutSession } from '../donation-shared/aggregator-adapter';
import {
  DonationAuthorizationError,
  DonationCheckoutError,
  DonationStateError,
  DonationValidationError,
  DonationsDisabledError,
} from '../donation-shared/errors';
import { silentLogger } from '../donation-shared/logging';
import type { DonationRecord } from '../donation-shared/types';

const NOW = '2026-09-16T10:00:00.000Z';
const DONOR = 'sub-donor-1';
const OTHER = 'sub-someone-else';

function aDonation(overrides: Partial<DonationRecord> = {}): DonationRecord {
  return {
    id: 'don-1',
    donorGoogleId: DONOR,
    amount: 501,
    donationType: 'RECURRING',
    frequency: 'MONTHLY',
    status: 'SUCCEEDED',
    aggregatorTransactionId: 'order_abc',
    createdAt: NOW,
    updatedAt: NOW,
    processedPaymentId: 'pay_1',
    ...overrides,
  };
}

function fakeRepository(seed: DonationRecord[] = []) {
  const rows = new Map(seed.map((d) => [d.id, { ...d }]));
  const calls: string[] = [];
  const repository: DonationApiDeps['repository'] = {
    async create(input) {
      calls.push('create');
      const record: DonationRecord = {
        id: 'don-new',
        ...input,
        status: 'INITIATED',
        createdAt: NOW,
        updatedAt: NOW,
      };
      rows.set(record.id, record);
      return record;
    },
    async getById(id) {
      calls.push('getById');
      return rows.get(id);
    },
    async queryByDonor(donorGoogleId) {
      calls.push(`queryByDonor:${donorGoogleId}`);
      return [...rows.values()].filter((d) => d.donorGoogleId === donorGoogleId);
    },
    async markPending(id, aggregatorTransactionId) {
      calls.push('markPending');
      const row = rows.get(id)!;
      Object.assign(row, { status: 'PENDING', aggregatorTransactionId });
      return row;
    },
    async markCancelled(id, cancelledAt) {
      calls.push('markCancelled');
      const row = rows.get(id)!;
      Object.assign(row, { status: 'CANCELLED', cancelledAt });
      return row;
    },
  };
  return { repository, rows, calls };
}

function fakeAdapter(options: { failCheckout?: boolean; failStop?: boolean } = {}) {
  const calls: string[] = [];
  const adapter: DonationApiDeps['adapter'] = {
    async createCheckout(request: CheckoutRequest): Promise<CheckoutSession> {
      calls.push('createCheckout');
      if (options.failCheckout) throw new Error('aggregator 503');
      return {
        checkoutUrl: 'https://checkout.example.test/session/xyz',
        checkoutReference: `ref-${request.donationId}`,
        aggregatorTransactionId: 'order_new',
      };
    },
    async stopMandate() {
      calls.push('stopMandate');
      if (options.failStop) throw new Error('aggregator 502');
    },
  };
  return { adapter, calls };
}

function anEvent(
  fieldName: string,
  args: Record<string, unknown> = {},
  sub: string | null = DONOR,
): DonationApiEvent {
  return {
    arguments: args,
    identity: sub
      ? {
          sub,
          username: sub,
          claims: {},
          issuer: '',
          sourceIp: [],
          defaultAuthStrategy: 'ALLOW',
          groups: null,
        }
      : null,
    info: {
      fieldName,
      parentTypeName: 'Mutation',
      selectionSetList: [],
      selectionSetGraphQL: '',
      variables: {},
    },
    source: null,
    request: { headers: {}, domainName: null },
    prev: null,
    stash: {},
  } as unknown as AppSyncResolverEvent<Record<string, unknown>>;
}

function handlerWith(
  repo = fakeRepository(),
  agg = fakeAdapter(),
  env: Record<string, string> = { DONATIONS_ENABLED: 'true' },
) {
  return {
    handler: createHandler({
      repository: repo.repository,
      adapter: agg.adapter,
      env,
      now: () => NOW,
      logger: silentLogger,
    }),
    repo,
    agg,
  };
}

describe('donation-unit: donation-api handler', () => {
  it('refuses all three operations with DonationsDisabledError while the flag is off, touching nothing', async () => {
    const repo = fakeRepository([aDonation()]);
    const { handler } = handlerWith(repo, fakeAdapter(), { DONATIONS_ENABLED: 'false' });

    await expect(
      handler(anEvent('initiateDonation', { amount: 10, donationType: 'ONE_TIME' })),
    ).rejects.toBeInstanceOf(DonationsDisabledError);
    await expect(handler(anEvent('cancelDonation', { id: 'don-1' }))).rejects.toBeInstanceOf(
      DonationsDisabledError,
    );
    await expect(handler(anEvent('myDonations'))).rejects.toBeInstanceOf(DonationsDisabledError);
    expect(repo.calls).toEqual([]);
  });

  it('initiateDonation rejects an invalid amount with a validation error and creates nothing (BR5.2)', async () => {
    const { handler, repo, agg } = handlerWith();

    await expect(
      handler(anEvent('initiateDonation', { amount: 0, donationType: 'ONE_TIME' })),
    ).rejects.toBeInstanceOf(DonationValidationError);
    await expect(
      handler(anEvent('initiateDonation', { amount: 10, donationType: 'RECURRING' })),
    ).rejects.toThrow(/frequency/);
    expect(repo.calls).toEqual([]);
    expect(agg.calls).toEqual([]);
  });

  it('initiateDonation happy path returns the Contract 5 DonationInitiation shape and leaves the row PENDING', async () => {
    const { handler, repo, agg } = handlerWith();

    const result = await handler(
      anEvent('initiateDonation', {
        amount: 251.5,
        donationType: 'RECURRING',
        frequency: 'YEARLY',
      }),
    );

    expect(result).toEqual({
      donationId: 'don-new',
      checkoutUrl: 'https://checkout.example.test/session/xyz',
      checkoutReference: 'ref-don-new',
    });
    expect(Object.keys(result as object).sort()).toEqual([
      'checkoutReference',
      'checkoutUrl',
      'donationId',
    ]);
    expect(repo.rows.get('don-new')).toMatchObject({
      donorGoogleId: DONOR, // from the JWT, not an argument
      amount: 251.5,
      donationType: 'RECURRING',
      frequency: 'YEARLY',
      status: 'PENDING',
      aggregatorTransactionId: 'order_new',
    });
    expect(repo.calls).toEqual(['create', 'markPending']);
    expect(agg.calls).toEqual(['createCheckout']);
  });

  it('initiateDonation leaves the row INITIATED and throws a plain-language error when the aggregator checkout fails', async () => {
    const { handler, repo } = handlerWith(fakeRepository(), fakeAdapter({ failCheckout: true }));

    await expect(
      handler(anEvent('initiateDonation', { amount: 100, donationType: 'ONE_TIME' })),
    ).rejects.toBeInstanceOf(DonationCheckoutError);
    expect(repo.rows.get('don-new')?.status).toBe('INITIATED');
    expect(repo.calls).toEqual(['create']); // no markPending
  });

  it('cancelDonation by a non-owner is refused before any aggregator call (BR5.6)', async () => {
    const repo = fakeRepository([aDonation()]);
    const agg = fakeAdapter();
    const { handler } = handlerWith(repo, agg);

    await expect(handler(anEvent('cancelDonation', { id: 'don-1' }, OTHER))).rejects.toBeInstanceOf(
      DonationAuthorizationError,
    );
    // An unknown id gets the same refusal so ids cannot be probed.
    await expect(handler(anEvent('cancelDonation', { id: 'nope' }))).rejects.toBeInstanceOf(
      DonationAuthorizationError,
    );
    expect(agg.calls).toEqual([]);
    expect(repo.rows.get('don-1')?.status).toBe('SUCCEEDED');
  });

  it('cancelDonation happy path calls stopMandate BEFORE markCancelled and returns the public Donation', async () => {
    const repo = fakeRepository([aDonation()]);
    const agg = fakeAdapter();
    const order: string[] = [];
    const originalStop = agg.adapter.stopMandate;
    agg.adapter.stopMandate = async (id) => {
      order.push('stopMandate');
      return originalStop(id);
    };
    const originalCancel = repo.repository.markCancelled;
    repo.repository.markCancelled = async (id, at) => {
      order.push('markCancelled');
      return originalCancel(id, at);
    };
    const { handler } = handlerWith(repo, agg);

    const result = await handler(anEvent('cancelDonation', { id: 'don-1' }));

    expect(order).toEqual(['stopMandate', 'markCancelled']);
    expect(result).toMatchObject({ id: 'don-1', status: 'CANCELLED', cancelledAt: NOW });
    expect(result).not.toHaveProperty('processedPaymentId');
    expect(result).not.toHaveProperty('updatedAt');

    // Aggregator refuses → never CANCELLED.
    const repo2 = fakeRepository([aDonation()]);
    const { handler: handler2 } = handlerWith(repo2, fakeAdapter({ failStop: true }));
    await expect(handler2(anEvent('cancelDonation', { id: 'don-1' }))).rejects.toThrow(
      'aggregator 502',
    );
    expect(repo2.rows.get('don-1')?.status).toBe('SUCCEEDED');
  });

  it('cancelDonation refuses a ONE_TIME or non-SUCCEEDED donation with a state error', async () => {
    const repo = fakeRepository([
      aDonation({ id: 'one-time', donationType: 'ONE_TIME', frequency: undefined }),
      aDonation({ id: 'pending', status: 'PENDING' }),
    ]);
    const agg = fakeAdapter();
    const { handler } = handlerWith(repo, agg);

    await expect(handler(anEvent('cancelDonation', { id: 'one-time' }))).rejects.toBeInstanceOf(
      DonationStateError,
    );
    await expect(handler(anEvent('cancelDonation', { id: 'pending' }))).rejects.toBeInstanceOf(
      DonationStateError,
    );
    expect(agg.calls).toEqual([]);
  });

  it('myDonations queries by the caller sub from the JWT, never by an argument, and strips internal fields', async () => {
    const repo = fakeRepository([aDonation(), aDonation({ id: 'don-2', donorGoogleId: OTHER })]);
    const { handler } = handlerWith(repo);

    const result = (await handler(
      anEvent('myDonations', { donorGoogleId: OTHER }, DONOR),
    )) as Array<Record<string, unknown>>;

    expect(repo.calls).toEqual([`queryByDonor:${DONOR}`]);
    expect(result.map((d) => d.id)).toEqual(['don-1']);
    expect(result[0]).not.toHaveProperty('processedPaymentId');
  });

  it('refuses a request without a Cognito identity and an unknown field name', async () => {
    const { handler } = handlerWith();
    await expect(handler(anEvent('myDonations', {}, null))).rejects.toBeInstanceOf(
      DonationAuthorizationError,
    );
    await expect(handler(anEvent('deleteDonation', { id: 'x' }))).rejects.toThrow(
      /unsupported operation/,
    );
  });
});
