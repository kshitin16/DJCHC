/**
 * reminder-unit (U7) — the pure business rules (`rules.md`), with no I/O so
 * they are testable with fixed instants.
 *
 * IST is a fixed UTC+05:30 (no daylight saving), so every conversion is
 * arithmetic on epoch milliseconds: shift by the offset, read the calendar
 * fields with the UTC getters, shift back.
 *
 * - `initialFireAtFor`  BR7.2: 09:00 IST on the day BEFORE the Post's IST date.
 *                       Computed from the DATE component only — a same-date
 *                       time edit yields the identical value (BR7.1/BR7.8).
 * - `snoozeFireAtFor`   BR7.3: a FIXED 21:00 IST on the initial fire's IST
 *                       day (not an offset from when snooze was tapped).
 * - `isPastSnoozeCutoff` BR7.3: once 21:00 IST of that day has passed a
 *                       SCHEDULED Reminder can no longer be snoozed.
 * - `hasPostPassed`     BR7.4: the Post's own `dateTime` has been reached.
 * - `needsBackfill`     BR7.1 (widened): true unless the device already holds
 *                       a Reminder for this Post with EXACTLY the currently
 *                       correct `initialFireAt` — so a moved DATE yields an
 *                       additional Reminder on next sync (BR7.8 no-op).
 * - `isTerminal`        BR7.10: FIRED / CLEARED / CANCELLED.
 * - `dedupeKey`         BR7.10: `<postId>#<updatedAt>` identifies one stream
 *                       record's business event for the Contract 8 handler.
 */
import { FIRE_HOUR_IST, IST_OFFSET_MINUTES, SNOOZE_HOUR_IST } from './constants';
import { TERMINAL_STATUSES, type ReminderRecord, type ReminderStatus } from './types';

const IST_OFFSET_MS = IST_OFFSET_MINUTES * 60 * 1000;

function parseInstant(iso: string, label: string): number {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) throw new Error(`reminder rules: ${label} is not a valid datetime: ${iso}`);
  return ms;
}

/** The IST calendar date (`{ y, m, d }`, month 0-based) of a UTC instant. */
function istDateOf(ms: number): { y: number; m: number; d: number } {
  const shifted = new Date(ms + IST_OFFSET_MS);
  return { y: shifted.getUTCFullYear(), m: shifted.getUTCMonth(), d: shifted.getUTCDate() };
}

/** The UTC instant of `hour:00 IST` on the given IST calendar date (day offset applied). */
function istWallClockToIso(
  date: { y: number; m: number; d: number },
  dayOffset: number,
  hour: number,
): string {
  const utcMs = Date.UTC(date.y, date.m, date.d + dayOffset, hour, 0, 0, 0) - IST_OFFSET_MS;
  return new Date(utcMs).toISOString();
}

/** BR7.2 */
export function initialFireAtFor(postDateTimeIso: string): string {
  const date = istDateOf(parseInstant(postDateTimeIso, 'post dateTime'));
  return istWallClockToIso(date, -1, FIRE_HOUR_IST);
}

/** BR7.3 */
export function snoozeFireAtFor(initialFireAtIso: string): string {
  const date = istDateOf(parseInstant(initialFireAtIso, 'initialFireAt'));
  return istWallClockToIso(date, 0, SNOOZE_HOUR_IST);
}

/** BR7.3: true once 21:00 IST of the initial fire's day has been reached. */
export function isPastSnoozeCutoff(nowIso: string, initialFireAtIso: string): boolean {
  return parseInstant(nowIso, 'now') >= parseInstant(snoozeFireAtFor(initialFireAtIso), 'cutoff');
}

/** BR7.4 */
export function hasPostPassed(nowIso: string, postDateTimeIso: string): boolean {
  return parseInstant(nowIso, 'now') >= parseInstant(postDateTimeIso, 'post dateTime');
}

/** BR7.1 (widened): compared as instants so formatting differences never cause a duplicate. */
export function needsBackfill(
  existingForPost: readonly ReminderRecord[],
  initialFireAtIso: string,
): boolean {
  const wanted = parseInstant(initialFireAtIso, 'initialFireAt');
  return !existingForPost.some((r) => Date.parse(r.initialFireAt) === wanted);
}

/** BR7.10 */
export function isTerminal(status: ReminderStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

/** BR7.10: the Contract 8 handler's idempotency key for one stream record. */
export function dedupeKey(postId: string, updatedAt: string): string {
  return `${postId}#${updatedAt}`;
}
