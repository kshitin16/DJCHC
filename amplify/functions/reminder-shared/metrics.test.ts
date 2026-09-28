/**
 * reminder-unit — tests for the `reminder-delivery-delta` emitter.
 */
import { PutMetricDataCommand } from '@aws-sdk/client-cloudwatch';
import { silentLogger } from '../donation-shared/logging';
import { ReminderMetrics } from './metrics';

describe('reminder-unit: ReminderMetrics', () => {
  it('emits reminder-delivery-delta in seconds under the SarovarJinalaya/Reminders namespace', async () => {
    const sent: Array<{ name: string; input: Record<string, unknown> }> = [];
    const client = {
      send: async (command: { constructor: { name: string }; input: Record<string, unknown> }) => {
        sent.push({ name: command.constructor.name, input: command.input });
        return {};
      },
    };
    await new ReminderMetrics(client, silentLogger).emitDeliveryDelta(42);
    expect(sent[0]).toMatchObject({
      name: PutMetricDataCommand.name,
      input: {
        Namespace: 'SarovarJinalaya/Reminders',
        MetricData: [{ MetricName: 'reminder-delivery-delta', Value: 42, Unit: 'Seconds' }],
      },
    });
  });

  it('swallows an emission failure (observability never fails a delivery)', async () => {
    const client = {
      send: async () => {
        throw new Error('cloudwatch down');
      },
    };
    await expect(
      new ReminderMetrics(client, silentLogger).emitDeliveryDelta(1),
    ).resolves.toBeUndefined();
  });
});
