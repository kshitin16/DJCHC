/**
 * reminder-unit (U7) — the `reminder-delivery-delta` custom CloudWatch metric
 * (NFR-OBS.1, observability-design.md): the seconds between the fire time a
 * Reminder's schedule asked for and the moment `deliver-push` actually ran —
 * the direct measure of NFR-PERF.3's 2-minute p95 target.
 *
 * Same pattern as `suggestion-shared/metrics.ts`: the client is injected; a
 * failure to emit is LOGGED and SWALLOWED, because the metric is
 * observability, not correctness, and must never fail a delivery.
 */
import { PutMetricDataCommand, type CloudWatchClient } from '@aws-sdk/client-cloudwatch';
import { createLogger, describeError, type Logger } from '../donation-shared/logging';
import { DELIVERY_DELTA_METRIC, REMINDER_METRIC_NAMESPACE } from './constants';

export type CloudWatchClientLike = Pick<CloudWatchClient, 'send'>;

/** What `deliver-push` depends on; `ReminderMetrics` implements it, tests fake it. */
export interface ReminderMetricsLike {
  emitDeliveryDelta(deltaSeconds: number): Promise<void>;
}

export class ReminderMetrics implements ReminderMetricsLike {
  constructor(
    private readonly client: CloudWatchClientLike,
    private readonly logger: Logger = createLogger('reminder-metrics'),
  ) {}

  async emitDeliveryDelta(deltaSeconds: number): Promise<void> {
    try {
      await this.client.send(
        new PutMetricDataCommand({
          Namespace: REMINDER_METRIC_NAMESPACE,
          MetricData: [{ MetricName: DELIVERY_DELTA_METRIC, Value: deltaSeconds, Unit: 'Seconds' }],
        }),
      );
    } catch (error) {
      this.logger.warn('reminder-delivery-delta metric emission failed; delivery unaffected', {
        error: describeError(error),
      });
    }
  }
}
