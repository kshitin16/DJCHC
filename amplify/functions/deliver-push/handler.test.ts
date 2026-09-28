/**
 * reminder-unit — tests for `deliver-push` (BR7.11, BR7.7, BR7.10, NFR-OBS.1)
 * with fakes for the repository, push sender and metrics.
 */
import { PushTokenInvalidError } from '../reminder-shared/errors';
import {
  FIRE_AT,
  FakeMetrics,
  FakePushSender,
  FakeReminderRepository,
  IDENTITY_A,
  SNOOZE_AT,
  aDeviceToken,
  aReminder,
} from '../reminder-shared/test-fakes';
import { REMINDER_NOTIFICATION, createHandler } from './handler';

/** 90 seconds after the initial fire time. */
const NOW = '2026-10-01T03:31:30.000Z';

function build(reminders = [aReminder()], devices = [aDeviceToken()], push = new FakePushSender()) {
  const repository = new FakeReminderRepository(reminders, devices);
  const metrics = new FakeMetrics();
  const handler = createHandler({ repository, push, metrics, now: () => NOW });
  return { repository, push, metrics, handler };
}

describe('reminder-unit: deliver-push handler', () => {
  it('sends the push to the owner’s registered token and marks the Reminder FIRED', async () => {
    const { handler, repository, push } = build();
    const result = await handler({ reminderId: 'rem-1', postId: 'post-1' });
    expect(result).toEqual({ outcome: 'delivered', reminderId: 'rem-1', deltaSeconds: 90 });
    expect(push.sent).toEqual([
      {
        pushToken: 'push-token-1',
        platform: 'ANDROID',
        notification: { ...REMINDER_NOTIFICATION, data: { reminderId: 'rem-1', postId: 'post-1' } },
      },
    ]);
    expect(repository.reminders.get('rem-1')).toMatchObject({ status: 'FIRED', updatedAt: NOW });
    expect(repository.calls.find((c) => c.op === 'getDeviceTokenByOwner')?.args).toEqual([
      IDENTITY_A,
    ]);
    expect(repository.calls.find((c) => c.op === 'transitionReminder')?.args).toEqual([
      'rem-1',
      ['SCHEDULED', 'SNOOZED'],
      'FIRED',
      NOW,
      undefined,
    ]);
  });

  it('skips a Reminder that is no longer pending (terminal) or does not exist — no push, no transition (BR7.10)', async () => {
    for (const status of ['FIRED', 'CLEARED', 'CANCELLED'] as const) {
      const { handler, push, repository } = build([aReminder({ status })]);
      expect(await handler({ reminderId: 'rem-1' })).toEqual({
        outcome: 'skipped',
        reminderId: 'rem-1',
        reason: `status ${status}`,
      });
      expect(push.sent).toEqual([]);
      expect(repository.ops()).toEqual(['getReminderById']);
    }
    const { handler, push } = build([]);
    expect(await handler({ reminderId: 'ghost' })).toMatchObject({
      outcome: 'skipped',
      reason: 'not found',
    });
    expect(push.sent).toEqual([]);
    await expect(handler({})).rejects.toThrow('payload must carry a reminderId');
  });

  it('with no DeviceToken for the owner, warns and leaves the Reminder pending (no transition, no metric)', async () => {
    const { handler, repository, push, metrics } = build([aReminder()], []);
    expect(await handler({ reminderId: 'rem-1' })).toMatchObject({
      outcome: 'skipped',
      reason: 'no device token',
    });
    expect(push.sent).toEqual([]);
    expect(repository.reminders.get('rem-1')?.status).toBe('SCHEDULED');
    expect(metrics.deltas).toEqual([]);
  });

  it('an invalid token leaves the Reminder pending with a warning; any other send failure is thrown', async () => {
    const invalid = build(
      [aReminder()],
      [aDeviceToken()],
      new FakePushSender(new PushTokenInvalidError()),
    );
    expect(await invalid.handler({ reminderId: 'rem-1' })).toMatchObject({
      outcome: 'skipped',
      reason: 'invalid device token',
    });
    expect(invalid.repository.reminders.get('rem-1')?.status).toBe('SCHEDULED');
    expect(invalid.metrics.deltas).toEqual([]);

    const down = build(
      [aReminder()],
      [aDeviceToken()],
      new FakePushSender(new Error('FCM responded 503')),
    );
    await expect(down.handler({ reminderId: 'rem-1' })).rejects.toThrow('FCM responded 503');
    expect(down.repository.reminders.get('rem-1')?.status).toBe('SCHEDULED');
  });

  it('emits the delivery delta against snoozeFireAt for a SNOOZED Reminder (and still fires it — BR7.7 toggle is irrelevant here)', async () => {
    const snoozed = aReminder({ status: 'SNOOZED', snoozeFireAt: SNOOZE_AT });
    const repository = new FakeReminderRepository(
      [snoozed],
      [aDeviceToken({ remindersEnabled: false })],
    );
    const metrics = new FakeMetrics();
    const push = new FakePushSender();
    const handler = createHandler({
      repository,
      push,
      metrics,
      now: () => '2026-10-01T15:32:00.000Z',
    });
    expect(await handler({ reminderId: 'rem-1' })).toEqual({
      outcome: 'delivered',
      reminderId: 'rem-1',
      deltaSeconds: 120,
    });
    expect(metrics.deltas).toEqual([120]);
    expect(push.sent).toHaveLength(1);
    expect(repository.reminders.get('rem-1')).toMatchObject({ status: 'FIRED' });
    expect(repository.reminders.get('rem-1')).not.toHaveProperty('snoozeFireAt');
    // Sanity: the initial-fire delta path used FIRE_AT.
    expect(FIRE_AT).toBe('2026-10-01T03:30:00.000Z');
  });
});
