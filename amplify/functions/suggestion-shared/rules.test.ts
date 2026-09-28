/**
 * suggestion-unit — pure business-rule tests (BR3.1, BR3.5, NFR-RATE.1).
 * IST tests use fixed UTC instants around the 18:30Z boundary, which is
 * midnight in Asia/Kolkata (UTC+05:30).
 */
import { SuggestionValidationError } from './errors';
import {
  DAILY_LIMIT,
  MAX_WORDS,
  istDateOf,
  istMidnightPlus48hEpochSeconds,
  validateText,
  wordCount,
} from './rules';

/** An n-word string. */
function wordsOf(n: number): string {
  return Array.from({ length: n }, (_, i) => `word${i + 1}`).join(' ');
}

describe('suggestion-unit: rules', () => {
  it('accepts exactly 300 words and returns the trimmed text (BR3.1)', () => {
    const text = `  ${wordsOf(300)}\n`;
    expect(wordCount(text)).toBe(300);
    expect(validateText(text)).toBe(wordsOf(300));
    expect(MAX_WORDS).toBe(300);
  });

  it('rejects 301 words before anything is written, without echoing the text (BR3.1)', () => {
    const text = wordsOf(301);
    expect(() => validateText(text)).toThrow(SuggestionValidationError);
    expect(() => validateText(text)).toThrow('up to 300 words; this one has 301');
    try {
      validateText(text);
    } catch (error) {
      expect((error as Error).message).not.toContain('word1 ');
    }
  });

  it('counts a run of spaces, tabs and newlines as ONE separator (BR3.1: whitespace-tokenized)', () => {
    expect(wordCount('one   two\t\tthree\n\nfour')).toBe(4);
    expect(wordCount('  leading and trailing  ')).toBe(3);
    expect(validateText(`${wordsOf(299)}\n\n\n   lastword`)).toBe(
      `${wordsOf(299)}\n\n\n   lastword`,
    );
    expect(wordCount(`${wordsOf(299)}\n\n\n   lastword`)).toBe(300);
  });

  it('rejects empty, whitespace-only and non-string text (BR3.1 boundary validation)', () => {
    for (const bad of ['', '   ', '\n\t', undefined, null, 42]) {
      expect(() => validateText(bad)).toThrow(SuggestionValidationError);
      expect(() => validateText(bad)).toThrow('A suggestion needs some text');
    }
    expect(wordCount('')).toBe(0);
    expect(wordCount('   ')).toBe(0);
  });

  it('resolves the IST date just BEFORE IST midnight (18:29:59Z) to the earlier day (BR3.5)', () => {
    expect(istDateOf('2026-09-19T18:29:59.000Z')).toBe('2026-09-19');
    // Mid-morning UTC is afternoon IST, same date.
    expect(istDateOf('2026-09-19T10:00:00.000Z')).toBe('2026-09-19');
  });

  it('resolves the IST date just AFTER IST midnight (18:30:00Z) to the next day, including across a month boundary (BR3.5)', () => {
    expect(istDateOf('2026-09-19T18:30:00.000Z')).toBe('2026-09-20');
    expect(istDateOf('2026-09-30T18:30:00.000Z')).toBe('2026-10-01');
    // Early-UTC instants are already the same IST date, not the previous one.
    expect(istDateOf('2026-09-20T00:30:00.000Z')).toBe('2026-09-20');
    expect(() => istDateOf('not-a-date')).toThrow('ISO-8601');
  });

  it('computes the counter TTL as the IST midnight FOLLOWING now, plus 48 hours, in epoch seconds (NFR-RATE.1)', () => {
    // IST day 2026-09-19 ends at 2026-09-19T18:30:00Z.
    const nextIstMidnight = Date.parse('2026-09-19T18:30:00.000Z') / 1000;
    const expected = nextIstMidnight + 48 * 3600;

    expect(istMidnightPlus48hEpochSeconds('2026-09-19T10:00:00.000Z')).toBe(expected);
    expect(istMidnightPlus48hEpochSeconds('2026-09-19T18:29:59.000Z')).toBe(expected);
    // The very first second of the next IST day rolls over to the next midnight.
    expect(istMidnightPlus48hEpochSeconds('2026-09-19T18:30:00.000Z')).toBe(expected + 24 * 3600);
    // Sanity: the TTL is strictly after the instant and after the IST day it counts.
    const ttl = istMidnightPlus48hEpochSeconds('2026-09-19T10:00:00.000Z');
    expect(ttl).toBeGreaterThan(Date.parse('2026-09-19T10:00:00.000Z') / 1000);
    expect(ttl).toBeGreaterThan(nextIstMidnight);
    expect(istDateOf(new Date(ttl * 1000).toISOString())).toBe('2026-09-22');
  });

  it('fixes the daily cap at 5 (BR3.5)', () => {
    expect(DAILY_LIMIT).toBe(5);
  });
});
