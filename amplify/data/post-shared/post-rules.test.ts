/**
 * feed-unit — tests for the pure Post rules (rules.md BR2.1, BR2.2, BR2.4, BR2.6).
 */
import {
  AGE_OUT_WINDOW_MS,
  DESCRIPTION_MAX,
  POST_TYPES,
  TITLE_MAX,
  ageOutCutoffIso,
  canonicalDateTimeIso,
  isNotDeleted,
  isVisibleInFeed,
  sortMostRecentFirst,
  validatePostInput,
  type PostLike,
} from './post-rules';

const NOW = '2026-09-17T10:00:00.000Z';
const HOUR_MS = 60 * 60 * 1000;

function iso(offsetMs: number): string {
  return new Date(Date.parse(NOW) + offsetMs).toISOString();
}

function aPost(overrides: Partial<PostLike> & { id: string }): PostLike {
  return { dateTime: iso(HOUR_MS), deletedAt: null, ...overrides };
}

const validCreate = {
  type: 'EVENT',
  title: 'Paryushan Parva',
  description: 'Eight days of reflection at the temple.',
  dateTime: '2026-09-20T18:30:00Z',
};

describe('feed-unit: post-rules — validatePostInput (BR2.1, BR2.2)', () => {
  it('accepts every declared post type and rejects an unknown one (BR2.1)', () => {
    for (const type of POST_TYPES) {
      expect(validatePostInput({ ...validCreate, type }, { partial: false })).toEqual({ ok: true });
    }
    const rejected = validatePostInput({ ...validCreate, type: 'FESTIVAL' }, { partial: false });
    expect(rejected.ok).toBe(false);
    expect(rejected).toMatchObject({ message: expect.stringContaining('BR2.1') });
    expect(validatePostInput({ ...validCreate, type: undefined }, { partial: false }).ok).toBe(
      false,
    );
  });

  it('accepts a title of exactly 100 characters and rejects 101 (BR2.2)', () => {
    expect(TITLE_MAX).toBe(100);
    expect(
      validatePostInput({ ...validCreate, title: 'x'.repeat(100) }, { partial: false }),
    ).toEqual({ ok: true });
    const rejected = validatePostInput(
      { ...validCreate, title: 'x'.repeat(101) },
      { partial: false },
    );
    expect(rejected).toEqual({
      ok: false,
      message: expect.stringContaining('title must not exceed 100 characters'),
    });
  });

  it('accepts a description of exactly 1000 characters and rejects 1001 (BR2.2)', () => {
    expect(DESCRIPTION_MAX).toBe(1000);
    expect(
      validatePostInput({ ...validCreate, description: 'd'.repeat(1000) }, { partial: false }),
    ).toEqual({ ok: true });
    const rejected = validatePostInput(
      { ...validCreate, description: 'd'.repeat(1001) },
      { partial: false },
    );
    expect(rejected).toEqual({
      ok: false,
      message: expect.stringContaining('description must not exceed 1000 characters'),
    });
  });

  it('partial validation skips absent fields but still checks the supplied ones, reporting every violation at once', () => {
    expect(validatePostInput({}, { partial: true })).toEqual({ ok: true });
    expect(validatePostInput({ title: null, dateTime: undefined }, { partial: true })).toEqual({
      ok: true,
    });
    expect(validatePostInput({ title: 'Aarti timings' }, { partial: true })).toEqual({ ok: true });

    const rejected = validatePostInput({ type: 'NOPE', title: 'x'.repeat(101) }, { partial: true });
    expect(rejected.ok).toBe(false);
    const message = rejected.ok ? '' : rejected.message;
    expect(message).toContain('BR2.1');
    expect(message).toContain('title must not exceed 100 characters');
    // Missing description/dateTime are NOT reported in partial mode.
    expect(message).not.toContain('description');
    expect(message).not.toContain('dateTime');
  });
});

describe('feed-unit: post-rules — read-time rules (BR2.4, BR2.6)', () => {
  it('computes the age-out cutoff exactly 24 hours before now, in canonical UTC form', () => {
    expect(AGE_OUT_WINDOW_MS).toBe(24 * HOUR_MS);
    expect(ageOutCutoffIso(NOW)).toBe('2026-09-16T10:00:00.000Z');
    // Offsets and missing millis are normalized (the invariant the string
    // comparisons rely on).
    expect(ageOutCutoffIso('2026-09-17T15:30:00+05:30')).toBe('2026-09-16T10:00:00.000Z');
    expect(canonicalDateTimeIso('2026-09-20T18:30:00Z')).toBe('2026-09-20T18:30:00.000Z');
    expect(() => ageOutCutoffIso('not-a-date')).toThrow('not an ISO-8601 timestamp');
  });

  it('shows a post 23h in the past, hides one 25h in the past, and hides any deleted post regardless of date', () => {
    expect(isVisibleInFeed(aPost({ id: 'a', dateTime: iso(-23 * HOUR_MS) }), NOW)).toBe(true);
    expect(isVisibleInFeed(aPost({ id: 'b', dateTime: iso(-25 * HOUR_MS) }), NOW)).toBe(false);
    // Exactly at the cutoff is inclusive ("within 1 day (inclusive)").
    expect(isVisibleInFeed(aPost({ id: 'c', dateTime: iso(-24 * HOUR_MS) }), NOW)).toBe(true);
    expect(isVisibleInFeed(aPost({ id: 'd', dateTime: iso(48 * HOUR_MS) }), NOW)).toBe(true);
    expect(
      isVisibleInFeed(aPost({ id: 'e', dateTime: iso(48 * HOUR_MS), deletedAt: NOW }), NOW),
    ).toBe(false);
  });

  it('isNotDeleted treats only a set deletedAt as deleted', () => {
    expect(isNotDeleted(aPost({ id: 'a' }))).toBe(true);
    expect(isNotDeleted({ id: 'b', dateTime: NOW })).toBe(true);
    expect(isNotDeleted(aPost({ id: 'c', deletedAt: '2026-09-01T00:00:00.000Z' }))).toBe(false);
  });

  it('sorts most-recent dateTime first with a deterministic id tie-break and never mutates the input', () => {
    const input = [
      aPost({ id: 'old', dateTime: iso(-10 * HOUR_MS) }),
      aPost({ id: 'tie-b', dateTime: iso(HOUR_MS) }),
      aPost({ id: 'newest', dateTime: iso(72 * HOUR_MS) }),
      aPost({ id: 'tie-a', dateTime: iso(HOUR_MS) }),
    ];
    const snapshot = input.map((p) => p.id);
    expect(sortMostRecentFirst(input).map((p) => p.id)).toEqual([
      'newest',
      'tie-b',
      'tie-a',
      'old',
    ]);
    expect(input.map((p) => p.id)).toEqual(snapshot);
    expect(sortMostRecentFirst([])).toEqual([]);
  });
});
