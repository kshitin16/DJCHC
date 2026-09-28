/**
 * suggestion-unit (U3) — the record shapes and index names shared by the
 * two suggestion Lambdas, the schema (`amplify/data/resource.ts`) and the
 * tests. Lambda code imports from here, never from the schema file.
 *
 * `Suggestion` is exactly Contract 4 / `entities.md`: `id`, `submittedByGoogleId`,
 * `text`, `submittedAt`. The identifier is named `id`, matching the shared
 * GraphQL contract (project.md Correction: never silently rename it).
 */

/** The `Suggestion` table's secondary index: `submittedByGoogleId`, sorted by `submittedAt`. */
export const SUGGESTION_SUBMITTER_INDEX = 'submitterIndex';

/** Env var names `amplify/backend.ts` injects into the Lambdas. */
export const SUGGESTION_TABLE_ENV = 'SUGGESTION_TABLE_NAME';
export const SUGGESTION_DAILY_COUNT_TABLE_ENV = 'SUGGESTION_DAILY_COUNT_TABLE_NAME';

/** What `submitSuggestion` hands the repository: every Contract 4 field, id included. */
export interface NewSuggestion {
  id: string;
  submittedByGoogleId: string;
  text: string;
  submittedAt: string;
}

/**
 * The stored row. `createdAt`/`updatedAt` are the `@model` transformer's
 * implicit non-null timestamps (as with `Document`); the repository stamps
 * both from `submittedAt` so a client selecting them never sees a null.
 */
export interface SuggestionRecord extends NewSuggestion {
  createdAt: string;
  updatedAt: string;
}

/** Result of the atomic BR3.5 check-and-increment. */
export interface DailyCountResult {
  /** `true` when the increment succeeded (the caller was under the cap). */
  allowed: boolean;
}
