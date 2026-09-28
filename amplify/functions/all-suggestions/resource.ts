/**
 * suggestion-unit (U3) — `all-suggestions` Lambda declaration.
 *
 * Backs Contract 4's admin-only `allSuggestions` query as an AppSync Lambda
 * resolver: a Scan loop over the `Suggestion` table (every page, following
 * `LastEvaluatedKey`) and an in-memory newest-first sort. See `./handler.ts`.
 *
 * Sizing: 256MB / 30s (infrastructure-specification.md) — sized to the
 * ~1500-suggestion, ~3MB-worst-case 12-month ceiling performance-design.md
 * established; a handful of internal Scan pages plus a sort fits comfortably.
 *
 * Environment (injected by `amplify/backend.ts`):
 * - `SUGGESTION_TABLE_NAME` — the Amplify-Data `Suggestion` table.
 *
 * `resourceGroupName: 'data'` for the same circular-dependency reason as
 * `submit-suggestion` and the other data-stack Lambdas.
 */
import { defineFunction } from '@aws-amplify/backend';

export const allSuggestions = defineFunction({
  name: 'all-suggestions',
  entry: './handler.ts',
  memoryMB: 256,
  timeoutSeconds: 30,
  resourceGroupName: 'data',
});
