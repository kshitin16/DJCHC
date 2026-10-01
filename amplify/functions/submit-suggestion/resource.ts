/**
 * suggestion-unit (U3) — `submit-suggestion` Lambda declaration.
 *
 * Backs Contract 4's `submitSuggestion(text: String!)` mutation as an AppSync
 * Lambda resolver (infrastructure-specification.md: a Lambda rather than a
 * multi-data-source JS pipeline, because `a.handler.custom()` binds one data
 * source per step and this operation touches two tables). See `./handler.ts`
 * for the rules it realizes (BR3.1, BR3.2, BR3.5, NFR-OBS.1).
 *
 * Sizing: 128MB / 5s (infrastructure-specification.md) — one conditional
 * `UpdateItem`, one `PutItem` and one `PutMetricData`; no Scan, no loop.
 *
 * Environment (both injected by `amplify/backend.ts`):
 * - `SUGGESTION_TABLE_NAME`             — the Amplify-Data `Suggestion` table.
 * - `SUGGESTION_DAILY_COUNT_TABLE_NAME` — the Amplify-Data `SuggestionDailyCount` table.
 *
 * `resourceGroupName: 'data'` places this function in the data stack: the
 * schema references it as a handler AND it reads both table names, which
 * would otherwise be a circular dependency between the two stacks (as with
 * `feed-api` and `document-api`).
 */
import { defineFunction } from '@aws-amplify/backend';

export const submitSuggestion = defineFunction({
  name: 'submit-suggestion',
  entry: './handler.ts',
  memoryMB: 128,
  timeoutSeconds: 5,
  resourceGroupName: 'data',
  logging: {
    // 30 days — the project default (NFR-OBS.2), as resolved at Observability Setup Q2: CloudWatch
    // sets retention per log GROUP, not per level, so the per-level
    // split NFR-OBS.2 asked for cannot be configured. Unset means
    // logs are kept forever, which is both a cost and a privacy leak.
    retention: '1 month',
  },
});
