/**
 * reminder-unit — tests for the Contract 8 stream handler (BR7.8, BR7.9,
 * BR7.10, partial-batch failure reporting) with recording fakes.
 */
import type { DynamoDBRecord, DynamoDBStreamEvent } from 'aws-lambda';
import {
  FakeReminderRepository,
  FakeSchedules,
  IDENTITY_B,
  SNOOZE_AT,
  aReminder,
} from '../reminder-shared/test-fakes';
import { createHandler } from './handler';

type Attrs = Record<string, string | null>;
const NOW = '2026-09-25T06:00:00.000Z';
const base = {
  id: 'post-1',
  dateTime: '2026-10-02T04:30:00.000Z',
  updatedAt: '2026-09-20T10:00:00.000Z',
};

function image(attrs: Attrs) {
  return Object.fromEntries(
    Object.entries(attrs).map(([k, v]) => [k, v === null ? { NULL: true } : { S: v }]),
  );
}

function aStreamRecord(input: {
  eventName?: 'INSERT' | 'MODIFY' | 'REMOVE';
  old?: Attrs;
  new?: Attrs;
  seq?: string;
}): DynamoDBRecord {
  return {
    eventID: `evt-${input.seq ?? '1'}`,
    eventName: input.eventName ?? 'MODIFY',
    dynamodb: {
      SequenceNumber: input.seq ?? '1',
      OldImage: input.old ? image(input.old) : undefined,
      NewImage: input.new ? image(input.new) : undefined,
    },
  } as DynamoDBRecord;
}

const deleteRecord = (seq = '1') =>
  aStreamRecord({
    old: { ...base, deletedAt: null },
    new: { ...base, deletedAt: '2026-09-21T10:00:00.000Z' },
    seq,
  });

function build(reminders = [aReminder()]) {
  const repository = new FakeReminderRepository(reminders);
  const schedules = new FakeSchedules();
  const handler = createHandler({ repository, schedules, now: () => NOW });
  return { repository, schedules, handler };
}

describe('reminder-unit: reminder-stream-handler', () => {
  it('a soft-delete cancels every SCHEDULED/SNOOZED Reminder for the Post (any owner) and deletes both schedules each (BR7.9)', async () => {
    const { handler, repository, schedules } = build([
      aReminder({ id: 'rem-1', status: 'SCHEDULED' }),
      aReminder({
        id: 'rem-2',
        status: 'SNOOZED',
        snoozeFireAt: SNOOZE_AT,
        ownerIdentityId: IDENTITY_B,
      }),
      aReminder({ id: 'rem-other', postId: 'post-2' }),
    ]);
    const response = await handler({ Records: [deleteRecord()] } as DynamoDBStreamEvent);
    expect(response).toEqual({ batchItemFailures: [] });
    expect(repository.reminders.get('rem-1')?.status).toBe('CANCELLED');
    expect(repository.reminders.get('rem-2')?.status).toBe('CANCELLED');
    expect(repository.reminders.get('rem-other')?.status).toBe('SCHEDULED');
    expect(repository.ops()).toEqual([
      'listRemindersByPost',
      'transitionReminder',
      'transitionReminder',
    ]);
    expect(repository.calls[1].args).toEqual([
      'rem-1',
      ['SCHEDULED', 'SNOOZED'],
      'CANCELLED',
      NOW,
      undefined,
    ]);
    expect(schedules.calls.map((c) => c.args[0])).toEqual([
      'fire-rem-1',
      'clear-rem-1',
      'fire-rem-2',
      'clear-rem-2',
    ]);
  });

  it('leaves FIRED / CLEARED / CANCELLED Reminders untouched and issues no schedule call for them', async () => {
    const { handler, repository, schedules } = build([
      aReminder({ id: 'f', status: 'FIRED' }),
      aReminder({ id: 'c', status: 'CLEARED' }),
      aReminder({ id: 'x', status: 'CANCELLED' }),
    ]);
    await handler({ Records: [deleteRecord()] } as DynamoDBStreamEvent);
    expect(repository.ops()).toEqual(['listRemindersByPost']);
    expect(schedules.calls).toEqual([]);
  });

  it('a redelivered record (no active rows left) is a no-op on the rows but still safe; an active row raced to terminal still gets its deletes (BR7.10)', async () => {
    const { handler, repository, schedules } = build([aReminder({ id: 'rem-1' })]);
    await handler({ Records: [deleteRecord('1')] } as DynamoDBStreamEvent);
    await handler({ Records: [deleteRecord('1')] } as DynamoDBStreamEvent);
    expect(repository.calls.filter((c) => c.op === 'transitionReminder')).toHaveLength(1);
    expect(schedules.ops()).toEqual(['delete', 'delete']);

    const raced = build([aReminder({ id: 'rem-9' })]);
    raced.repository.forceConditionFailureFor = 'rem-9';
    await raced.handler({ Records: [deleteRecord()] } as DynamoDBStreamEvent);
    expect(raced.repository.reminders.get('rem-9')?.status).toBe('SCHEDULED');
    expect(raced.schedules.calls.map((c) => c.args[0])).toEqual(['fire-rem-9', 'clear-rem-9']);
  });

  it('a PostDateTimeChanged record does NOTHING (BR7.8 — the builder’s deliberate no-op); INSERT/REMOVE are ignored too', async () => {
    const { handler, repository, schedules } = build();
    await handler({
      Records: [
        aStreamRecord({ old: base, new: { ...base, dateTime: '2026-10-05T04:30:00.000Z' } }),
        aStreamRecord({ eventName: 'INSERT', new: base }),
        aStreamRecord({ eventName: 'REMOVE', old: base }),
      ],
    } as DynamoDBStreamEvent);
    expect(repository.calls).toEqual([]);
    expect(schedules.calls).toEqual([]);
    expect(repository.reminders.get('rem-1')?.initialFireAt).toBe(aReminder().initialFireAt);
  });

  it('isolates a failing record: batchItemFailures lists only its sequence number; the others are processed', async () => {
    const { handler, repository, schedules } = build([aReminder({ id: 'rem-1' })]);
    let call = 0;
    const original = repository.listRemindersByPost.bind(repository);
    repository.listRemindersByPost = async (postId: string) => {
      call += 1;
      if (call === 1) throw new Error('dynamodb throttled');
      return original(postId);
    };
    const response = await handler({
      Records: [deleteRecord('100'), deleteRecord('101')],
    } as DynamoDBStreamEvent);
    expect(response).toEqual({ batchItemFailures: [{ itemIdentifier: '100' }] });
    expect(repository.reminders.get('rem-1')?.status).toBe('CANCELLED');
    expect(schedules.ops()).toEqual(['delete', 'delete']);
    expect(await handler({} as DynamoDBStreamEvent)).toEqual({ batchItemFailures: [] });
  });
});
