/**
 * suggestion-unit — `suggestion-count` metric emitter tests against a fake
 * CloudWatch client. No AWS credentials, no network.
 */
import { PutMetricDataCommand } from '@aws-sdk/client-cloudwatch';
import type { Logger } from '../donation-shared/logging';
import {
  SUGGESTION_COUNT_METRIC,
  SUGGESTION_METRIC_NAMESPACE,
  SuggestionMetrics,
  type CloudWatchClientLike,
} from './metrics';

type SentCommand = { name: string; input: Record<string, unknown> };

function fakeClient(replies: unknown[]): { client: CloudWatchClientLike; sent: SentCommand[] } {
  const sent: SentCommand[] = [];
  const queue = [...replies];
  const client = {
    send: async (command: { constructor: { name: string }; input: Record<string, unknown> }) => {
      sent.push({ name: command.constructor.name, input: command.input });
      const reply = queue.shift();
      if (reply instanceof Error) throw reply;
      return reply ?? {};
    },
  } as unknown as CloudWatchClientLike;
  return { client, sent };
}

function recordingLogger() {
  const warnings: { message: string; fields?: Record<string, unknown> }[] = [];
  const logger: Logger = {
    info: () => {},
    warn: (message, fields) => warnings.push({ message, fields }),
    error: () => {},
  };
  return { logger, warnings };
}

describe('suggestion-unit: SuggestionMetrics (NFR-OBS.1)', () => {
  it('emits one PutMetricData with the suggestion-count metric, value 1, in the SarovarJinalaya/Suggestions namespace', async () => {
    const { client, sent } = fakeClient([{}]);
    const { logger, warnings } = recordingLogger();

    await new SuggestionMetrics(client, logger).emitSuggestionCount();

    expect(sent).toHaveLength(1);
    expect(sent[0].name).toBe(PutMetricDataCommand.name);
    expect(sent[0].input).toEqual({
      Namespace: 'SarovarJinalaya/Suggestions',
      MetricData: [{ MetricName: 'suggestion-count', Value: 1, Unit: 'Count' }],
    });
    expect(SUGGESTION_METRIC_NAMESPACE).toBe('SarovarJinalaya/Suggestions');
    expect(SUGGESTION_COUNT_METRIC).toBe('suggestion-count');
    expect(warnings).toEqual([]);
  });

  it('swallows a CloudWatch failure and logs a warning — a metric never fails a submission', async () => {
    const failure = new Error('AccessDeniedException');
    const { client } = fakeClient([failure]);
    const { logger, warnings } = recordingLogger();

    await expect(
      new SuggestionMetrics(client, logger).emitSuggestionCount(),
    ).resolves.toBeUndefined();

    expect(warnings).toHaveLength(1);
    expect(warnings[0].message).toContain('suggestion-count');
    expect(warnings[0].fields).toEqual({
      error: { name: 'Error', message: 'AccessDeniedException' },
    });
  });

  it('calls the client exactly once per emission', async () => {
    const { client, sent } = fakeClient([{}, {}, {}]);
    const metrics = new SuggestionMetrics(client, recordingLogger().logger);

    await metrics.emitSuggestionCount();
    await metrics.emitSuggestionCount();
    await metrics.emitSuggestionCount();

    expect(sent).toHaveLength(3);
    expect(sent.every((c) => c.name === PutMetricDataCommand.name)).toBe(true);
  });
});
