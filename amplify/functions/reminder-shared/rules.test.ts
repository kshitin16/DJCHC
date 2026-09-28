/**
 * reminder-unit — tests for the pure rules (BR7.1–BR7.4, BR7.10) with fixed
 * UTC instants: 03:30Z = 09:00 IST, 15:30Z = 21:00 IST, 18:30Z = IST midnight.
 */
import {
  dedupeKey,
  hasPostPassed,
  initialFireAtFor,
  isPastSnoozeCutoff,
  isTerminal,
  needsBackfill,
  snoozeFireAtFor,
} from './rules';
import type { ReminderRecord } from './types';

function aReminder(overrides: Partial<ReminderRecord> = {}): ReminderRecord {
  return {
    id: 'rem-1',
    postId: 'post-1',
    ownerIdentityId: 'identity-A',
    status: 'SCHEDULED',
    initialFireAt: '2026-10-01T03:30:00.000Z',
    createdAt: '2026-09-20T00:00:00.000Z',
    updatedAt: '2026-09-20T00:00:00.000Z',
    ...overrides,
  };
}

describe('reminder-unit: rules', () => {
  it('BR7.2: an event at 02:00 IST (20:30Z the previous UTC day) fires at 09:00 IST the day before the IST date', () => {
    // 2026-10-02 02:00 IST == 2026-10-01T20:30:00Z; IST date is Oct 2 → fire Oct 1 09:00 IST == Oct 1 03:30Z.
    expect(initialFireAtFor('2026-10-01T20:30:00.000Z')).toBe('2026-10-01T03:30:00.000Z');
  });

  it('BR7.2: an event at 22:00 IST fires at 09:00 IST the day before; the time-of-day never changes the result', () => {
    // 2026-10-02 22:00 IST == 2026-10-02T16:30:00Z → fire Oct 1 03:30Z.
    expect(initialFireAtFor('2026-10-02T16:30:00.000Z')).toBe('2026-10-01T03:30:00.000Z');
    expect(initialFireAtFor('2026-10-02T04:30:00.000Z')).toBe('2026-10-01T03:30:00.000Z');
    // Month boundary: an event on Nov 1 IST fires Oct 31.
    expect(initialFireAtFor('2026-11-01T05:00:00.000Z')).toBe('2026-10-31T03:30:00.000Z');
    expect(() => initialFireAtFor('nope')).toThrow('not a valid datetime');
  });

  it('BR7.3: the snooze time is a fixed 21:00 IST on the initial fire’s IST day', () => {
    expect(snoozeFireAtFor('2026-10-01T03:30:00.000Z')).toBe('2026-10-01T15:30:00.000Z');
  });

  it('BR7.3: the cutoff is reached exactly at 21:00 IST — before it a snooze is allowed, at/after it refused', () => {
    const fire = '2026-10-01T03:30:00.000Z';
    expect(isPastSnoozeCutoff('2026-10-01T15:29:59.000Z', fire)).toBe(false);
    expect(isPastSnoozeCutoff('2026-10-01T15:30:00.000Z', fire)).toBe(true);
    expect(isPastSnoozeCutoff('2026-10-01T18:30:00.000Z', fire)).toBe(true);
  });

  it('BR7.4: the Post has passed at exactly its dateTime, not one millisecond before', () => {
    const post = '2026-10-02T04:30:00.000Z';
    expect(hasPostPassed('2026-10-02T04:29:59.999Z', post)).toBe(false);
    expect(hasPostPassed(post, post)).toBe(true);
  });

  it('BR7.1 (widened): no backfill when a Reminder with the exact initialFireAt already exists', () => {
    expect(
      needsBackfill(
        [aReminder({ initialFireAt: '2026-10-01T03:30:00.000Z' })],
        '2026-10-01T03:30:00.000Z',
      ),
    ).toBe(false);
    // Same instant, different formatting: still a match.
    expect(
      needsBackfill(
        [aReminder({ initialFireAt: '2026-10-01T09:00:00+05:30' })],
        '2026-10-01T03:30:00.000Z',
      ),
    ).toBe(false);
  });

  it('BR7.1 (widened): backfill when only a stale-date Reminder exists for the Post, whatever its status', () => {
    const stale = aReminder({ initialFireAt: '2026-09-30T03:30:00.000Z', status: 'CLEARED' });
    expect(needsBackfill([stale], '2026-10-01T03:30:00.000Z')).toBe(true);
    expect(needsBackfill([], '2026-10-01T03:30:00.000Z')).toBe(true);
  });

  it('BR7.10: FIRED, CLEARED and CANCELLED are terminal; SCHEDULED and SNOOZED are not', () => {
    expect(isTerminal('FIRED')).toBe(true);
    expect(isTerminal('CLEARED')).toBe(true);
    expect(isTerminal('CANCELLED')).toBe(true);
    expect(isTerminal('SCHEDULED')).toBe(false);
    expect(isTerminal('SNOOZED')).toBe(false);
  });

  it('BR7.10: the dedupe key is `<postId>#<updatedAt>`', () => {
    expect(dedupeKey('post-1', '2026-09-20T10:00:00.000Z')).toBe('post-1#2026-09-20T10:00:00.000Z');
  });
});
