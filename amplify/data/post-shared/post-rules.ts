/**
 * feed-unit — pure business rules for the `Post` entity (rules.md BR2.1–BR2.7).
 *
 * This file is the REFERENCE implementation and the single home of Contract
 * 3's constants. It is plain TypeScript with no AppSync imports so it can be
 * unit-tested directly and imported by the schema (`../resource.ts`) and by
 * the `feed-api` Lambda (`../../functions/feed-api/handler.ts`, bundled by
 * esbuild, which implements the public `listPosts` read with it).
 *
 * The five AppSync JavaScript resolvers in `../post-resolvers/` cannot import
 * it: Amplify uploads each resolver file verbatim as an S3 asset (no
 * bundling — see `@aws-amplify/backend-data/lib/convert_js_resolvers.js`),
 * and the APPSYNC_JS runtime can only import `@aws-appsync/utils`. Each
 * resolver therefore INLINES the function(s) it needs, marked
 * `// mirrors post-shared/post-rules.ts`, and `post-rules-parity.test.ts`
 * asserts the inlined copies return the same verdicts as this file for a
 * fixed table of inputs. When a rule changes, change it here first, then in
 * every mirror, and let the parity test prove they agree.
 *
 * ## The one invariant the reads depend on
 *
 * `Post.dateTime` is stored in the canonical UTC form
 * `YYYY-MM-DDTHH:mm:ss.SSSZ` — `createPost`/`updatePost` normalize whatever
 * the AWSDateTime scalar accepted (offsets, no millis) through
 * `util.time.epochMilliSecondsToISO8601(util.time.parseISO8601ToEpochMilliSeconds(x))`.
 * In that form, lexicographic string order IS chronological order, which is
 * what (a) the DynamoDB filter `dateTime >= :cutoff` (BR2.4, in the
 * `feed-api` Lambda) and (b) the comparator-less sort the APPSYNC_JS runtime allows (`Array.prototype.sort()`
 * takes no arguments there) both rely on. `canonicalDateTimeIso` is that
 * normalization, expressed with `Date` here and with `util.time` in the
 * resolvers.
 */

/** BR2.1 — the declared post types (Contract 3 `PostType`). */
export const POST_TYPES = ['EVENT', 'VISITING_DIGNITARY', 'DONATION_CALL_OUT'] as const;
export type PostType = (typeof POST_TYPES)[number];

/** BR2.2 — length limits, in characters. */
export const TITLE_MAX = 100;
export const DESCRIPTION_MAX = 1000;

/** BR2.4 — a post ages out of the public feed 1 day after its `dateTime`. */
export const AGE_OUT_WINDOW_MS = 24 * 60 * 60 * 1000;

/** The four client-writable fields of a Post (Contract 3 input types). */
export type PostInput = {
  type?: unknown;
  title?: unknown;
  description?: unknown;
  dateTime?: unknown;
};

export type ValidationResult = { ok: true } | { ok: false; message: string };

/** The subset of a stored Post the read rules look at. */
export type PostLike = {
  id: string;
  dateTime: string;
  deletedAt?: string | null;
};

function isAbsent(value: unknown): boolean {
  return value === undefined || value === null;
}

/**
 * BR2.1 + BR2.2. With `partial: false` (create) every field is required; with
 * `partial: true` (update) absent (`undefined`/`null`) fields are skipped and
 * only the supplied ones are checked. Returns every violation in one message.
 */
export function validatePostInput(
  input: PostInput,
  options: { partial: boolean },
): ValidationResult {
  const messages: string[] = [];
  const partial = options.partial;

  if (!partial || !isAbsent(input.type)) {
    if (typeof input.type !== 'string' || !(POST_TYPES as readonly string[]).includes(input.type)) {
      messages.push(`type must be one of ${POST_TYPES.join(', ')} (BR2.1)`);
    }
  }

  if (!partial || !isAbsent(input.title)) {
    if (typeof input.title !== 'string') {
      messages.push('title is required (BR2.2)');
    } else if (input.title.length > TITLE_MAX) {
      messages.push(`title must not exceed ${TITLE_MAX} characters (BR2.2)`);
    }
  }

  if (!partial || !isAbsent(input.description)) {
    if (typeof input.description !== 'string') {
      messages.push('description is required (BR2.2)');
    } else if (input.description.length > DESCRIPTION_MAX) {
      messages.push(`description must not exceed ${DESCRIPTION_MAX} characters (BR2.2)`);
    }
  }

  if (!partial || !isAbsent(input.dateTime)) {
    if (typeof input.dateTime !== 'string' || input.dateTime.length === 0) {
      messages.push('dateTime is required');
    }
  }

  if (messages.length > 0) {
    return { ok: false, message: messages.join('; ') };
  }
  return { ok: true };
}

/** The canonical stored form of `dateTime` (see the file header). */
export function canonicalDateTimeIso(iso: string): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) {
    throw new Error(`canonicalDateTimeIso: not an ISO-8601 timestamp: ${iso}`);
  }
  return new Date(ms).toISOString();
}

/** BR2.4 — the oldest `dateTime` still shown in the public feed, at `nowIso`. */
export function ageOutCutoffIso(nowIso: string): string {
  const nowMs = Date.parse(nowIso);
  if (Number.isNaN(nowMs)) {
    throw new Error(`ageOutCutoffIso: not an ISO-8601 timestamp: ${nowIso}`);
  }
  return new Date(nowMs - AGE_OUT_WINDOW_MS).toISOString();
}

/** BR2.6 — a post with `deletedAt` set is excluded from every view. */
export function isNotDeleted(post: PostLike): boolean {
  return isAbsent(post.deletedAt);
}

/** BR2.4 + BR2.6 — visible in the public feed at `nowIso`. */
export function isVisibleInFeed(post: PostLike, nowIso: string): boolean {
  return isNotDeleted(post) && canonicalDateTimeIso(post.dateTime) >= ageOutCutoffIso(nowIso);
}

/**
 * BR2.4 — most recent `dateTime` first. Implemented exactly as the resolvers
 * must: a comparator-less string sort over `<dateTime>#<id>` keys (ties on
 * `dateTime` break by `id`, deterministic). Never mutates its input.
 */
export function sortMostRecentFirst<T extends PostLike>(posts: readonly T[]): T[] {
  const byKey: Record<string, T> = {};
  for (const post of posts) {
    byKey[`${post.dateTime}#${post.id}`] = post;
  }
  return Object.keys(byKey)
    .sort()
    .reverse()
    .map((key) => byKey[key]);
}
