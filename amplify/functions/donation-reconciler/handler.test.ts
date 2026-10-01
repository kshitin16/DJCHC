/**
 * donation-unit — `donation-reconciler` handler tests through `createHandler`
 * with a fake repository, a controllable fake adapter and an injected clock.
 */
import {
  confirmationWindowMs,
  createHandler,
  initiatedSweepWindowMs,
  reconciliationPaymentKey,
  type DonationReconcilerDeps,
} from './handler';
import type { PaymentRecord } from '../donation-shared/aggregator-adapter';
import { silentLogger } from '../donation-shared/logging';
import type { DonationRecord } from '../donation-shared/types';

const NOW_MS = Date.parse('2026-09-16T10:00:00.000Z');

function aPending(
  id: string,
  aggregatorTransactionId: string | undefined = `order_${id}`,
): DonationRecord {
  return {
    id,
    donorGoogleId: 'sub-donor',
    amount: 100,
    donationType: 'ONE_TIME',
    status: 'PENDING',
    ...(aggregatorTransactionId ? { aggregatorTransactionId } : {}),
    createdAt: '2026-09-16T09:00:00.000Z',
    updatedAt: '2026-09-16T09:00:00.000Z',
  };
}

function anInitiated(id: string, aggregatorTransactionId?: string): DonationRecord {
  return {
    id,
    donorGoogleId: 'sub-donor',
    amount: 100,
    donationType: 'ONE_TIME',
    status: 'INITIATED',
    ...(aggregatorTransactionId ? { aggregatorTransactionId } : {}),
    createdAt: '2026-09-14T09:00:00.000Z',
    updatedAt: '2026-09-14T09:00:00.000Z',
  };
}

function fakeRepository(
  pending: DonationRecord[],
  alreadySettled: string[] = [],
  stuckInitiated: DonationRecord[] = [],
) {
  const rows = new Map([...pending, ...stuckInitiated].map((d) => [d.id, { ...d }]));
  const calls: Array<{ op: string; args: unknown[] }> = [];
  const repository: DonationReconcilerDeps['repository'] = {
    async queryPendingOlderThan(cutoff) {
      calls.push({ op: 'queryPendingOlderThan', args: [cutoff] });
      return pending.map((d) => rows.get(d.id)!);
    },
    async queryInitiatedOlderThan(cutoff) {
      calls.push({ op: 'queryInitiatedOlderThan', args: [cutoff] });
      return stuckInitiated.map((d) => rows.get(d.id)!);
    },
    async applySettlement(id, status, paymentId) {
      calls.push({ op: 'applySettlement', args: [id, status, paymentId] });
      if (alreadySettled.includes(id)) return { applied: false }; // a webhook won the race
      Object.assign(rows.get(id)!, { status, processedPaymentId: paymentId });
      return { applied: true, donation: rows.get(id) };
    },
  };
  return { repository, rows, calls };
}

function fakeAdapter(records: Record<string, PaymentRecord | Error>) {
  const asked: string[] = [];
  const adapter: DonationReconcilerDeps['adapter'] = {
    async getPaymentRecord(aggregatorTransactionId) {
      asked.push(aggregatorTransactionId);
      const record = records[aggregatorTransactionId];
      if (record instanceof Error) throw record;
      if (!record) throw new Error(`no canned record for ${aggregatorTransactionId}`);
      return record;
    },
  };
  return { adapter, asked };
}

function handlerWith(
  repo: ReturnType<typeof fakeRepository>,
  agg: ReturnType<typeof fakeAdapter>,
  env: Record<string, string | undefined> = {
    DONATIONS_ENABLED: 'true',
    DONATION_CONFIRMATION_WINDOW_MINUTES: '15',
  },
) {
  return createHandler({
    repository: repo.repository,
    adapter: agg.adapter,
    env,
    now: () => NOW_MS,
    logger: silentLogger,
  });
}

describe('donation-unit: donation-reconciler handler', () => {
  it('does not query anything while the flag is off', async () => {
    const repo = fakeRepository([aPending('a')]);
    const agg = fakeAdapter({ order_a: 'captured' });
    const summary = await handlerWith(repo, agg, { DONATIONS_ENABLED: 'false' })();
    expect(summary).toEqual({
      enabled: false,
      scanned: 0,
      settled: 0,
      duplicates: 0,
      failed: 0,
      initiatedScanned: 0,
      orphaned: 0,
    });
    expect(repo.calls).toEqual([]);
    expect(agg.asked).toEqual([]);
  });

  it('settles a stale PENDING donation as SUCCEEDED from a captured aggregator record, using the confirmation-window cutoff (BR5.4, NFR5.1)', async () => {
    const repo = fakeRepository([aPending('a')]);
    const agg = fakeAdapter({ order_a: 'captured' });

    const summary = await handlerWith(repo, agg)();

    expect(repo.calls[0]).toEqual({
      op: 'queryPendingOlderThan',
      args: ['2026-09-16T09:45:00.000Z'], // now − 15 minutes
    });
    expect(agg.asked).toEqual(['order_a']);
    expect(repo.calls[1]).toEqual({
      op: 'applySettlement',
      args: ['a', 'SUCCEEDED', reconciliationPaymentKey('order_a')],
    });
    expect(repo.rows.get('a')?.status).toBe('SUCCEEDED');
    expect(summary).toMatchObject({ enabled: true, scanned: 1, settled: 1, failed: 0 });
  });

  it('settles as FAILED when the aggregator record is absent or failed — never from the timeout alone (BR5.4)', async () => {
    const repo = fakeRepository([aPending('absent'), aPending('failed')]);
    const agg = fakeAdapter({ order_absent: 'absent', order_failed: 'failed' });

    const summary = await handlerWith(repo, agg)();

    expect(agg.asked.sort()).toEqual(['order_absent', 'order_failed']);
    expect(repo.rows.get('absent')?.status).toBe('FAILED');
    expect(repo.rows.get('failed')?.status).toBe('FAILED');
    expect(summary.settled).toBe(2);
  });

  it("isolates one donation's aggregator error so the others are still reconciled; a row without a reference is skipped and counted", async () => {
    const repo = fakeRepository([aPending('bad'), aPending('good'), aPending('noref', undefined)]);
    const agg = fakeAdapter({ order_bad: new Error('aggregator timeout'), order_good: 'captured' });

    const summary = await handlerWith(repo, agg)();

    expect(repo.rows.get('good')?.status).toBe('SUCCEEDED');
    expect(repo.rows.get('bad')?.status).toBe('PENDING'); // retried next tick
    expect(repo.rows.get('noref')?.status).toBe('PENDING');
    expect(summary).toMatchObject({ scanned: 3, settled: 1, failed: 2 });
  });

  it('counts a settlement the webhook already applied as a duplicate, not a failure (NFR5.2 race)', async () => {
    const repo = fakeRepository([aPending('raced')], ['raced']);
    const summary = await handlerWith(repo, fakeAdapter({ order_raced: 'captured' }))();
    expect(summary).toMatchObject({ scanned: 1, settled: 0, duplicates: 1, failed: 0 });
  });

  it('rethrows when the PENDING list itself cannot be read (fatal for the tick) and defaults a bad window to 15 minutes', async () => {
    const repo = fakeRepository([]);
    repo.repository.queryPendingOlderThan = async () => {
      throw new Error('table unavailable');
    };
    await expect(handlerWith(repo, fakeAdapter({}))()).rejects.toThrow('table unavailable');

    expect(confirmationWindowMs({ DONATION_CONFIRMATION_WINDOW_MINUTES: '5' })).toBe(5 * 60_000);
    expect(confirmationWindowMs({ DONATION_CONFIRMATION_WINDOW_MINUTES: 'soon' })).toBe(
      15 * 60_000,
    );
    expect(confirmationWindowMs({})).toBe(15 * 60_000);
  });

  it('reports a donation stuck INITIATED as an orphan instead of guessing its outcome (F-3, BR5.4)', async () => {
    const repo = fakeRepository([], [], [anInitiated('stuck')]);
    const agg = fakeAdapter({});

    const summary = await handlerWith(repo, agg)();

    expect(repo.calls).toEqual([
      { op: 'queryPendingOlderThan', args: ['2026-09-16T09:45:00.000Z'] },
      // now − 1440 minutes (the default orphan window)
      { op: 'queryInitiatedOlderThan', args: ['2026-09-15T10:00:00.000Z'] },
    ]);
    // Never asked the aggregator (there is no reference) and never wrote.
    expect(agg.asked).toEqual([]);
    expect(repo.rows.get('stuck')?.status).toBe('INITIATED');
    expect(summary).toMatchObject({ initiatedScanned: 1, orphaned: 1, settled: 0, failed: 0 });
  });

  it('reconciles a stuck INITIATED row that DOES carry an aggregator reference from the aggregator record (F-3)', async () => {
    const repo = fakeRepository([], [], [anInitiated('half', 'order_half')]);
    const agg = fakeAdapter({ order_half: 'captured' });

    const summary = await handlerWith(repo, agg)();

    expect(agg.asked).toEqual(['order_half']);
    expect(repo.rows.get('half')?.status).toBe('SUCCEEDED');
    expect(summary).toMatchObject({ initiatedScanned: 1, orphaned: 0, settled: 1 });
  });

  it('keeps reconciling PENDING rows when the orphan sweep query itself fails, and honours the configured orphan window', async () => {
    const repo = fakeRepository([aPending('a')]);
    repo.repository.queryInitiatedOlderThan = async () => {
      throw new Error('index unavailable');
    };
    const summary = await handlerWith(repo, fakeAdapter({ order_a: 'captured' }))();

    expect(repo.rows.get('a')?.status).toBe('SUCCEEDED');
    expect(summary).toMatchObject({ settled: 1, initiatedScanned: 0, orphaned: 0 });

    expect(initiatedSweepWindowMs({ DONATION_INITIATED_SWEEP_MINUTES: '30' })).toBe(30 * 60_000);
    expect(initiatedSweepWindowMs({ DONATION_INITIATED_SWEEP_MINUTES: 'later' })).toBe(
      1440 * 60_000,
    );
    expect(initiatedSweepWindowMs({})).toBe(1440 * 60_000);
  });
});
