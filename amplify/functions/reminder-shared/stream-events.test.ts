/**
 * reminder-unit — tests for Contract 8 classification of raw `Post` stream records.
 */
import type { DynamoDBRecord } from 'aws-lambda';
import { classifyPostRecord } from './stream-events';

type Attrs = Record<string, string | null>;

function image(attrs: Attrs): Record<string, { S?: string; NULL?: boolean }> {
  return Object.fromEntries(
    Object.entries(attrs).map(([k, v]) => [k, v === null ? { NULL: true } : { S: v }]),
  );
}

function aStreamRecord(input: {
  eventName?: 'INSERT' | 'MODIFY' | 'REMOVE';
  old?: Attrs;
  new?: Attrs;
}): DynamoDBRecord {
  return {
    eventName: input.eventName ?? 'MODIFY',
    dynamodb: {
      SequenceNumber: '111',
      OldImage: input.old ? image(input.old) : undefined,
      NewImage: input.new ? image(input.new) : undefined,
    },
  } as DynamoDBRecord;
}

const base = {
  id: 'post-1',
  dateTime: '2026-10-02T04:30:00.000Z',
  updatedAt: '2026-09-20T10:00:00.000Z',
};

describe('reminder-unit: classifyPostRecord (Contract 8)', () => {
  it('a MODIFY whose deletedAt goes from absent/null to set is PostDeleted, keyed on postId + updatedAt', () => {
    const record = aStreamRecord({
      old: { ...base, deletedAt: null },
      new: {
        ...base,
        updatedAt: '2026-09-21T10:00:00.000Z',
        deletedAt: '2026-09-21T10:00:00.000Z',
      },
    });
    expect(classifyPostRecord(record)).toEqual({
      kind: 'PostDeleted',
      postId: 'post-1',
      dedupeKey: 'post-1#2026-09-21T10:00:00.000Z',
    });
  });

  it('a MODIFY whose dateTime differs is PostDateTimeChanged with the new dateTime', () => {
    const record = aStreamRecord({
      old: base,
      new: { ...base, dateTime: '2026-10-05T04:30:00.000Z' },
    });
    expect(classifyPostRecord(record)).toEqual({
      kind: 'PostDateTimeChanged',
      postId: 'post-1',
      newDateTime: '2026-10-05T04:30:00.000Z',
      dedupeKey: 'post-1#2026-09-20T10:00:00.000Z',
    });
  });

  it('an unrelated MODIFY (title edit; or a delete that was already set) is Ignored', () => {
    expect(
      classifyPostRecord(
        aStreamRecord({ old: { ...base, title: 'a' }, new: { ...base, title: 'b' } }),
      ).kind,
    ).toBe('Ignored');
    expect(
      classifyPostRecord(
        aStreamRecord({ old: { ...base, deletedAt: 'x' }, new: { ...base, deletedAt: 'x' } }),
      ).kind,
    ).toBe('Ignored');
    expect(classifyPostRecord(aStreamRecord({ old: {}, new: {} })).kind).toBe('Ignored');
  });

  it('an INSERT is Ignored (a new Post is picked up lazily by the next sync, BR7.1)', () => {
    expect(classifyPostRecord(aStreamRecord({ eventName: 'INSERT', new: base }))).toEqual({
      kind: 'Ignored',
      reason: 'INSERT record',
    });
  });

  it('a REMOVE is Ignored (feed-unit never hard-deletes a Post)', () => {
    expect(classifyPostRecord(aStreamRecord({ eventName: 'REMOVE', old: base })).kind).toBe(
      'Ignored',
    );
  });
});
