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
 * the same donation cannot double-apply. On this path the idempotency key is a
 * deterministic marker derived from the aggregator transaction id (the
 * status-query result carries no separate payment id in the thin adapter
 * interface).
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

export const DEFAULT_CONFIRMATION_WINDOW_MINUTES = 15;

export type DonationReconcilerRepository = Pick<
  DonationRepository,
  'queryPendingOlderThan' | 'applySettlement'
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
}

export function confirmationWindowMs(env: DonationEnv): number {
  const minutes = Number(env.DONATION_CONFIRMATION_WINDOW_MINUTES);
  const effective =
    Number.isFinite(minutes) && minutes > 0 ? minutes : DEFAULT_CONFIRMATION_WINDOW_MINUTES;
  return effective * 60_000;
}

/** Idempotency key for a settlement the poller (not a webhook) applied. */
export function reconciliationPaymentKey(aggregatorTransactionId: string): string {
  return `reconciled:${aggregatorTransactionId}`;
}

export function createHandler(deps: DonationReconcilerDeps) {
  const logger = deps.logger ?? createLogger('donation-reconciler');
  const now = deps.now ?? (() => Date.now());

  return async function handler(): Promise<ReconciliationSummary> {
    const summary: ReconciliationSummary = {
      enabled: isDonationsEnabled(deps.env),
      scanned: 0,
      settled: 0,
      duplicates: 0,
      failed: 0,
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
        const record = await deps.adapter.getPaymentRecord(donation.aggregatorTransactionId);
        const status = decideSettlement(record);
        const result = await deps.repository.applySettlement(
          donation.id,
          status,
          reconciliationPaymentKey(donation.aggregatorTransactionId),
        );
        if (result.applied) summary.settled += 1;
        else summary.duplicates += 1;
        logger.info('Reconciled from the aggregator record', {
          donationId: donation.id,
          record,
          status,
          applied: result.applied,
        });
      } catch (error) {
        // Recoverable: the next tick retries this donation; the batch continues.
        summary.failed += 1;
        logger.error('Reconciliation failed for donation; will retry next tick', {
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
    return { enabled: false, scanned: 0, settled: 0, duplicates: 0, failed: 0 };
  }
  return createHandler(realDependencies())();
};
