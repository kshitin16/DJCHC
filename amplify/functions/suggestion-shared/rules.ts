/**
 * suggestion-unit (U3) — the pure business rules of the suggestion box.
 *
 * - BR3.1  `MAX_WORDS`, `wordCount`, `validateText`: up to 300 WORDS (not
 *          characters), whitespace-tokenized after trimming.
 * - BR3.5  `DAILY_LIMIT` (5 per IST calendar day) and `istDateOf`: the
 *          `YYYY-MM-DD` of an instant in `Asia/Kolkata`, computed with
 *          `Intl.DateTimeFormat` — no date library.
 * - NFR-RATE.1  `istMidnightPlus48hEpochSeconds`: the counter row's TTL —
 *          the IST midnight that FOLLOWS `now`, plus 48 hours, in epoch
 *          seconds (security-design.md's cleanup rule; DynamoDB TTL compares
 *          epoch seconds only, so the IST anchor is resolved here).
 *
 * Nothing here touches AWS, the clock or the suggestion text beyond
 * counting its words; none of it logs.
 */
import { SuggestionValidationError } from './errors';

export const MAX_WORDS = 300;
export const DAILY_LIMIT = 5;
export const IST_TIME_ZONE = 'Asia/Kolkata';

/** IST is UTC+05:30 with no daylight saving — fixed by definition. */
const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const TTL_GRACE_MS = 48 * 60 * 60 * 1000;

/** BR3.1: trim, then split on runs of whitespace; empty text has zero words. */
export function wordCount(text: string): number {
  const trimmed = text.trim();
  if (trimmed.length === 0) return 0;
  return trimmed.split(/\s+/).length;
}

/**
 * BR3.1 boundary validation: a string, non-empty after trimming, at most
 * `MAX_WORDS` words. Returns the trimmed text that will be stored. The error
 * messages never echo the text itself.
 */
export function validateText(text: unknown): string {
  if (typeof text !== 'string') {
    throw new SuggestionValidationError('A suggestion needs some text');
  }
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    throw new SuggestionValidationError('A suggestion needs some text');
  }
  const words = wordCount(trimmed);
  if (words > MAX_WORDS) {
    throw new SuggestionValidationError(
      `A suggestion can be up to ${MAX_WORDS} words; this one has ${words}`,
    );
  }
  return trimmed;
}

function parseInstant(isoNow: string): Date {
  const date = new Date(isoNow);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`suggestion-unit: not an ISO-8601 instant: ${isoNow}`);
  }
  return date;
}

const IST_DATE_FORMAT = new Intl.DateTimeFormat('en-CA', {
  timeZone: IST_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** BR3.5: the `YYYY-MM-DD` calendar day of `isoNow` in `Asia/Kolkata`. */
export function istDateOf(isoNow: string): string {
  return IST_DATE_FORMAT.format(parseInstant(isoNow));
}

/**
 * NFR-RATE.1: TTL for the counter row of the day containing `isoNow` — the
 * next IST midnight (the moment the day's cap resets) plus 48 hours, in
 * epoch seconds. Computed with the fixed +05:30 offset: shift to IST wall
 * time, floor to the day, step forward one day, shift back.
 */
export function istMidnightPlus48hEpochSeconds(isoNow: string): number {
  const utcMs = parseInstant(isoNow).getTime();
  const istWallMs = utcMs + IST_OFFSET_MS;
  const istDayStartWallMs = Math.floor(istWallMs / DAY_MS) * DAY_MS;
  const nextIstMidnightUtcMs = istDayStartWallMs + DAY_MS - IST_OFFSET_MS;
  return Math.floor((nextIstMidnightUtcMs + TTL_GRACE_MS) / 1000);
}
