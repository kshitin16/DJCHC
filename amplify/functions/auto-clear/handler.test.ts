/**
 * reminder-unit — tests for `auto-clear` (BR7.4, BR7.10) with recording fakes.
 */
import {
  FakeReminderRepository,
  FakeSchedules,
  SNOOZE_AT,
  aReminder,
} from '../reminder-shared/test-fakes';
import { createHandler } from './handler';

const NOW = '2026-10-02T04:30:00.000Z';

function build(reminders = [aReminder()]) {
  const repository = new FakeReminderRepository(reminders);
  const schedules = new FakeSchedules();
  const handler = createHandler({ repository, schedules, now: () => NOW });
  return { repository, schedules, handler };
}

describe('reminder-unit: auto-clear handler', () => {
  it('clears a Reminder from SCHEDULED, SNOOZED and FIRED (BR7.4) with ONE conditional transition each', async () => {
    for (const status of ['SCHEDULED', 'SNOOZED', 'FIRED'] as const) {
      const { handler, repository } = build([
        aReminder({ status, snoozeFireAt: status === 'SNOOZED' ? SNOOZE_AT : undefined }),
      ]);
      expect(await handler({ reminderId: 'rem-1', postId: 'post-1' })).toEqual({
        reminderId: 'rem-1',
        cleared: true,
      });
      expect(repository.reminders.get('rem-1')).toMatchObject({
        status: 'CLEARED',
        updatedAt: NOW,
      });
      expect(repository.reminders.get('rem-1')).not.toHaveProperty('snoozeFireAt');
      expect(repository.calls).toEqual([
        {
          op: 'transitionReminder',
          args: ['rem-1', ['SCHEDULED', 'SNOOZED', 'FIRED'], 'CLEARED', NOW, undefined],
        },
      ]);
    }
  });

  it('leaves a CANCELLED Reminder alone (a user’s cancellation is final)', async () => {
    const { handler, repository } = build([aReminder({ status: 'CANCELLED' })]);
    expect(await handler({ reminderId: 'rem-1' })).toEqual({ reminderId: 'rem-1', cleared: false });
    expect(repository.reminders.get('rem-1')?.status).toBe('CANCELLED');
  });

  it('deletes the fire schedule afterwards (a snoozed fire may still be pending), never the clear schedule', async () => {
    const { handler, schedules } = build([
      aReminder({ status: 'SNOOZED', snoozeFireAt: SNOOZE_AT }),
    ]);
    await handler({ reminderId: 'rem-1', postId: 'post-1' });
    expect(schedules.calls).toEqual([
      { op: 'delete', args: ['fire-rem-1', { reminderId: 'rem-1', postId: 'post-1' }] },
    ]);
  });

  it('a failed condition (already CLEARED, or the row is gone) is a no-op, not an error; a bad payload fails fast', async () => {
    const gone = build([]);
    expect(await gone.handler({ reminderId: 'ghost' })).toEqual({
      reminderId: 'ghost',
      cleared: false,
    });
    expect(gone.schedules.ops()).toEqual(['delete']);
    const already = build([aReminder({ status: 'CLEARED' })]);
    expect(await already.handler({ reminderId: 'rem-1' })).toEqual({
      reminderId: 'rem-1',
      cleared: false,
    });
    await expect(already.handler({ postId: 'post-1' })).rejects.toThrow(
      'payload must carry a reminderId',
    );
    await expect(already.handler(null)).rejects.toThrow('payload must carry a reminderId');
  });
});
