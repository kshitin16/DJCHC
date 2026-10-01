/**
 * donation-unit (U4) — scheduled reconciliation poller (Payment Status
 * Reconciliation workflow, timeout path).
 *
 * BR5.4 (project.md Mandated — the highest-severity rule in this Unit): a
 * donation that has stayed PENDING past the confirmation window is NEVER
 * resolved from the timeout itself. For each such donation the poller asks
 * the aggregator for its own record (`adapter.getPaymentRecord`) and applies
 * `decideSettlement` to THAT: captured → SUCCEEDED, failed or absent → FAILED.
 *
 * NFR5.1: this is the reconciliation trigger — `schedule: 'every 1m'` in
 * `./resource.ts`. NFR5.2: the write is the same atomic conditional
 * `applySettlement` the webhook uses, so a webhook and a poller tick racing on
 * the same donation cannot double-apply — and since revision 1 (review F-1)
 * that write also refuses to rewrite a row that has already reached a terminal
 * status, so a tick holding a row it listed as PENDING can no longer overwrite
 * a SUCCEEDED webhook result. On this path the idempotency key is a
 * deterministic marker derived from the aggregator transaction id (the
 * status-query result carries no separate payment id in the thin adapter
 * interface).
 *
 * Orphan sweep (revision 1, review F-3): besides stale PENDING rows the tick
 * also lists rows still INITIATED long past checkout — the state left behind
 * when `markPending` fails after the aggregator checkout was created. Such a
 * row carries no aggregator reference (`markPending` writes the status and the
 * reference in one update), so there is nothing to ask the aggregator about:
 * the poller SURFACES it (an ERROR log line per row plus an `orphaned` count in
 * the tick summary, which the deferred NFR-OBS.4 alert topic will alarm on) and
 * never guesses an outcome, because BR5.4 forbids resolving a donation without
 * the aggregator's own record. A donor who did pay is still settled correctly
 * without this sweep: the webhook looks the row up by `order_id`
 * (= `Donation.id`) and `applySettlement` accepts an INITIATED row.
 *
 * Per-item errors are logged and skipped so one aggregator failure never stops
 * the rest of the batch; the tick returns a summary. Alerting on repeated
 * failures (NFR-OBS.4, SNS topic) is deferred to the full build.
 */
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import {
  PlaceholderAggregatorAdapter,
  type AggregatorAdapter,
} from '../donation-shared/aggregator-adapter';
import { DonationRepository } from '../donation-shared/donation-repository';
import { isDonationsEnabled, type DonationEnv } from '../donation-shared/flag';
import { createLogger, describeError, type Logger } from '../donation-shared/logging';
import { decideSettlement } from '../donation-shared/reconciliation';
import type { DonationRecord } from '../donation-shared/types';

export const DEFAULT_CONFIRMATION_WINDOW_MINUTES = 15;

/**
 * How long a row may stay INITIATED before the tick reports it as an orphan.
 * Deliberately far longer than any aggregator webhook retry schedule, so a
 * payment still in flight is never reported as stuck.
 */
export const DEFAULT_INITIATED_SWEEP_MINUTES = 1440;

export type DonationReconcilerRepository = Pick<
  DonationRepository,
  'queryPendingOlderThan' | 'queryInitiatedOlderThan' | 'applySettlement'
>;

export interface DonationReconcilerDeps {
  repository: DonationReconcilerRepository;
  adapter: Pick<AggregatorAdapter, 'getPaymentRecord'>;
  env: DonationEnv;
  /** Injected clock (ms since epoch) so tests control the cutoff. */
  now?: () => number;
  logger?: Logger;
}

export interface ReconciliationSummary {
  enabled: boolean;
  cutoff?: string;
  scanned: number;
  settled: number;
  duplicates: number;
  failed: number;
  /** Rows still INITIATED past `DONATION_INITIATED_SWEEP_MINUTES` (F-3). */
  initiatedCutoff?: string;
  initiatedScanned: number;
  /** Stale INITIATED rows with no aggregator reference — reported, never guessed. */
  orphaned: number;
}

function windowMs(raw: string | undefined, defaultMinutes: number): number {
  const minutes = Number(raw);
  const effective = Number.isFinite(minutes) && minutes > 0 ? minutes : defaultMinutes;
  return effective * 60_000;
}

export function confirmationWindowMs(env: DonationEnv): number {
  return windowMs(env.DONATION_CONFIRMATION_WINDOW_MINUTES, DEFAULT_CONFIRMATION_WINDOW_MINUTES);
}

export function initiatedSweepWindowMs(env: DonationEnv): number {
  return windowMs(env.DONATION_INITIATED_SWEEP_MINUTES, DEFAULT_INITIATED_SWEEP_MINUTES);
}

/** Idempotency key for a settlement the poller (not a webhook) applied. */
export function reconciliationPaymentKey(aggregatorTransactionId: string): string {
  return `reconciled:${aggregatorTransactionId}`;
}

export function createHandler(deps: DonationReconcilerDeps) {
  const logger = deps.logger ?? createLogger('donation-reconciler');
  const now = deps.now ?? (() => Date.now());

  /** Ask the aggregator what happened and write its answer (BR5.4). */
  async function reconcile(donation: DonationRecord, summary: ReconciliationSummary) {
    const reference = donation.aggregatorTransactionId as string;
    const record = await deps.adapter.getPaymentRecord(reference);
    const status = decideSettlement(record);
    const result = await deps.repository.applySettlement(
      donation.id,
      status,
      reconciliationPaymentKey(reference),
    );
    if (result.applied) summary.settled += 1;
    else summary.duplicates += 1;
    logger.info(
      result.applied
        ? 'Reconciled from the aggregator record'
        : 'Settlement rejected; row already settled or duplicate — no state change',
      {
        donationId: donation.id,
        record,
        status,
        applied: result.applied,
        ...(result.currentStatus ? { currentStatus: result.currentStatus } : {}),
      },
    );
  }

  return async function handler(): Promise<ReconciliationSummary> {
    const summary: ReconciliationSummary = {
      enabled: isDonationsEnabled(deps.env),
      scanned: 0,
      settled: 0,
      duplicates: 0,
      failed: 0,
      initiatedScanned: 0,
      orphaned: 0,
    };
    if (!summary.enabled) {
      logger.info('Donations disabled; reconciliation tick skipped');
      return summary;
    }

    const cutoff = new Date(now() - confirmationWindowMs(deps.env)).toISOString();
    summary.cutoff = cutoff;

    let pending;
    try {
      pending = await deps.repository.queryPendingOlderThan(cutoff);
    } catch (error) {
      // Fatal for this tick: without the list there is nothing to reconcile.
      logger.error('Could not list stale PENDING donations', describeError(error));
      throw error;
    }
    summary.scanned = pending.length;

    for (const donation of pending) {
      if (!donation.aggregatorTransactionId) {
        // PENDING implies markPending stored a reference; a row without one is
        // an anomaly to investigate, never something to resolve blindly (BR5.4).
        logger.error('PENDING donation has no aggregatorTransactionId; skipped', {
          donationId: donation.id,
        });
        summary.failed += 1;
        continue;
      }
      try {
        await reconcile(donation, summary);
      } catch (error) {
        // Recoverable: the next tick retries this donation; the batch continues.
        summary.failed += 1;
        logger.error('Reconciliation failed for donation; will retry next tick', {
          donationId: donation.id,
          ...describeError(error),
        });
      }
    }

    // --- Orphan sweep (F-3) --------------------------------------------------
    const initiatedCutoff = new Date(now() - initiatedSweepWindowMs(deps.env)).toISOString();
    summary.initiatedCutoff = initiatedCutoff;
    let stuck: DonationRecord[] = [];
    try {
      stuck = await deps.repository.queryInitiatedOlderThan(initiatedCutoff);
    } catch (error) {
      // Not fatal: the PENDING sweep above already did the load-bearing work.
      logger.error('Could not list stale INITIATED donations', describeError(error));
    }
    summary.initiatedScanned = stuck.length;

    for (const donation of stuck) {
      if (!donation.aggregatorTransactionId) {
        // `markPending` writes status and reference together, so a stale
        // INITIATED row normally has no reference at all: report it, do not
        // invent an outcome (BR5.4).
        summary.orphaned += 1;
        logger.error(
          'Donation stuck INITIATED with no aggregator reference; needs manual reconciliation against the aggregator dashboard',
          { donationId: donation.id, createdAt: donation.createdAt },
        );
        continue;
      }
      // Defensive: a reference on an INITIATED row means markPending stored it
      // but the status write was lost. That IS answerable from the aggregator.
      try {
        await reconcile(donation, summary);
      } catch (error) {
        summary.failed += 1;
        logger.error('Reconciliation of a stuck INITIATED donation failed; will retry next tick', {
          donationId: donation.id,
          ...describeError(error),
        });
      }
    }

    logger.info('Reconciliation tick complete', { ...summary });
    return summary;
  };
}

// --- Lambda entry point ----------------------------------------------------
let realDeps: DonationReconcilerDeps | undefined;

function realDependencies(): DonationReconcilerDeps {
  realDeps ??= {
    repository: new DonationRepository(DynamoDBDocumentClient.from(new DynamoDBClient({})), {
      tableName: process.env.DONATION_TABLE_NAME ?? '',
    }),
    adapter: new PlaceholderAggregatorAdapter(),
    env: process.env,
  };
  return realDeps;
}

export const handler = async (): Promise<ReconciliationSummary> => {
  if (!isDonationsEnabled(process.env)) {
    return {
      enabled: false,
      scanned: 0,
      settled: 0,
      duplicates: 0,
      failed: 0,
      initiatedScanned: 0,
      orphaned: 0,
    };
  }
  return createHandler(realDependencies())();
};
