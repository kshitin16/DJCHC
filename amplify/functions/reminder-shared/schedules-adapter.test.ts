/**
 * reminder-unit — tests for `SchedulesAdapter` against a fake Scheduler
 * client that records `CreateSchedule` / `UpdateSchedule` / `DeleteSchedule`
 * inputs and throws on demand.
 */
import {
  CreateScheduleCommand,
  DeleteScheduleCommand,
  UpdateScheduleCommand,
} from '@aws-sdk/client-scheduler';
import { silentLogger } from '../donation-shared/logging';
import { SchedulesAdapter, atExpression } from './schedules-adapter';

function fakeScheduler(errors: Array<Error | undefined> = []) {
  const sent: Array<{ name: string; input: Record<string, unknown> }> = [];
  const queue = [...errors];
  return {
    sent,
    send: async (command: { constructor: { name: string }; input: Record<string, unknown> }) => {
      sent.push({ name: command.constructor.name, input: command.input });
      const error = queue.shift();
      if (error) throw error;
      return {};
    },
  };
}

const options = { groupName: 'reminder-unit-schedules-test', roleArn: 'arn:aws:iam::1:role/sched' };
const payload = { reminderId: 'rem-1', postId: 'post-1' };

describe('reminder-unit: SchedulesAdapter', () => {
  it('createOneTime uses an at(YYYY-MM-DDTHH:MM:SS) expression in UTC with no Z, second precision', async () => {
    const client = fakeScheduler();
    await new SchedulesAdapter(client, options, silentLogger).createOneTime(
      'fire-rem-1',
      '2026-10-01T03:30:00.000Z',
      'arn:aws:lambda:ap-south-1:1:function:deliver-push',
      payload,
    );
    expect(client.sent[0].name).toBe(CreateScheduleCommand.name);
    expect(client.sent[0].input.ScheduleExpression).toBe('at(2026-10-01T03:30:00)');
    expect(client.sent[0].input.ScheduleExpressionTimezone).toBe('UTC');
    expect(client.sent[0].input.FlexibleTimeWindow).toEqual({ Mode: 'OFF' });
    expect(atExpression('2026-10-01T09:00:00+05:30')).toBe('at(2026-10-01T03:30:00)');
    expect(() => atExpression('not-a-date')).toThrow('invalid fire time');
  });

  it('createOneTime targets the group and execution role from its options, with ActionAfterCompletion DELETE', async () => {
    const client = fakeScheduler();
    await new SchedulesAdapter(client, options, silentLogger).createOneTime(
      'fire-rem-1',
      '2026-10-01T03:30:00.000Z',
      'arn:target',
      payload,
    );
    expect(client.sent[0].input).toMatchObject({
      Name: 'fire-rem-1',
      GroupName: 'reminder-unit-schedules-test',
      ActionAfterCompletion: 'DELETE',
      Target: { Arn: 'arn:target', RoleArn: 'arn:aws:iam::1:role/sched' },
    });
    expect(() => new SchedulesAdapter(client, { ...options, groupName: '' })).toThrow(
      'REMINDER_SCHEDULE_GROUP_NAME',
    );
    expect(() => new SchedulesAdapter(client, { ...options, roleArn: '' })).toThrow(
      'REMINDER_SCHEDULER_ROLE_ARN',
    );
  });

  it('the schedule payload carries the reminder id and post id (NFR-OBS.3 correlation), for create and update alike', async () => {
    const client = fakeScheduler();
    const adapter = new SchedulesAdapter(client, options, silentLogger);
    await adapter.createOneTime('fire-rem-1', '2026-10-01T03:30:00.000Z', 'arn:target', payload);
    await adapter.updateTime('fire-rem-1', '2026-10-01T15:30:00.000Z', 'arn:target', payload);
    for (const call of client.sent) {
      expect(JSON.parse((call.input.Target as { Input: string }).Input)).toEqual(payload);
    }
    expect(client.sent[1].name).toBe(UpdateScheduleCommand.name);
    expect(client.sent[1].input.ScheduleExpression).toBe('at(2026-10-01T15:30:00)');
  });

  it('delete swallows ResourceNotFoundException only (BR7.10 re-sync is a no-op on an already-gone schedule)', async () => {
    const notFound = new Error('gone');
    notFound.name = 'ResourceNotFoundException';
    const client = fakeScheduler([notFound]);
    const adapter = new SchedulesAdapter(client, options, silentLogger);
    await expect(adapter.delete('fire-rem-1', payload)).resolves.toBeUndefined();
    expect(client.sent[0]).toMatchObject({
      name: DeleteScheduleCommand.name,
      input: { Name: 'fire-rem-1', GroupName: 'reminder-unit-schedules-test' },
    });
  });

  it('delete rethrows every other error', async () => {
    const denied = new Error('denied');
    denied.name = 'AccessDeniedException';
    const client = fakeScheduler([denied, undefined]);
    const adapter = new SchedulesAdapter(client, options, silentLogger);
    await expect(adapter.delete('fire-rem-1', payload)).rejects.toBe(denied);
    await expect(adapter.delete('clear-rem-1', payload)).resolves.toBeUndefined();
  });
});
