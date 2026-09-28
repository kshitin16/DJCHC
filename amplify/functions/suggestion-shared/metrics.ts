/**
 * suggestion-unit (U3) — the `suggestion-count` custom CloudWatch metric
 * (NFR-OBS.1, observability-design.md): a running total of submissions,
 * emitted once per successful `submitSuggestion` (increment only — BR3.4
 * means no delete path exists to decrement).
 *
 * The CloudWatch client is injected (a real `CloudWatchClient` in the
 * Lambda, a fake in tests). A failure to emit is LOGGED and SWALLOWED: the
 * metric is observability, not correctness, and must never fail a
 * submission whose record is already saved. Nothing about the suggestion
 * (text, submitter) is ever sent or logged here.
 */
import { PutMetricDataCommand, type CloudWatchClient } from '@aws-sdk/client-cloudwatch';
import { createLogger, describeError, type Logger } from '../donation-shared/logging';

/** The namespace `amplify/backend.ts` pins in the Lambda's `cloudwatch:namespace` IAM condition. */
export const SUGGESTION_METRIC_NAMESPACE = 'SarovarJinalaya/Suggestions';
export const SUGGESTION_COUNT_METRIC = 'suggestion-count';

/** The one method the emitter needs — satisfied by a real `CloudWatchClient` or a test fake. */
export type CloudWatchClientLike = Pick<CloudWatchClient, 'send'>;

/** What the handler depends on; `SuggestionMetrics` implements it, tests fake it. */
export interface SuggestionMetricsLike {
  emitSuggestionCount(): Promise<void>;
}

export class SuggestionMetrics implements SuggestionMetricsLike {
  constructor(
    private readonly client: CloudWatchClientLike,
    private readonly logger: Logger = createLogger('suggestion-metrics'),
  ) {}

  /** One `PutMetricData` with value 1; best-effort (see the file header). */
  async emitSuggestionCount(): Promise<void> {
    try {
      await this.client.send(
        new PutMetricDataCommand({
          Namespace: SUGGESTION_METRIC_NAMESPACE,
          MetricData: [{ MetricName: SUGGESTION_COUNT_METRIC, Value: 1, Unit: 'Count' }],
        }),
      );
    } catch (error) {
      this.logger.warn('suggestion-count metric emission failed; submission unaffected', {
        error: describeError(error),
      });
    }
  }
}
