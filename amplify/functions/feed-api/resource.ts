/**
 * feed-unit (U2) — `feed-api` Lambda declaration (plan Revision 2).
 *
 * Handles exactly one Contract 3 operation, the public `listPosts` query, as
 * an AppSync Lambda resolver; see `./handler.ts` for the logic and the rules
 * it realizes (BR2.4, BR2.6). The five admin operations stay Lambda-free
 * (AppSync JavaScript resolvers in `amplify/data/post-resolvers/`).
 *
 * Why a Lambda at all: the installed `@aws-amplify/data-schema` refuses the
 * identity-pool guest rule (`allow.guest()`) on `a.handler.custom`
 * operations, and the builder chose a small function over an expiring API
 * key so the public feed keeps the guest-identity model the design intended.
 *
 * Sizing: 128MB / 10s — one paginated DynamoDB Scan of a few-hundred-row
 * table, no outbound calls (NFR1.1).
 *
 * Environment:
 * - `POST_TABLE_NAME` — injected by `amplify/backend.ts` from the
 *   Amplify-Data-generated `Post` table.
 *
 * `resourceGroupName: 'data'` places this function in the data stack: the
 * schema references it as a handler AND it reads the `Post` table name,
 * which would otherwise be a circular dependency between the two stacks.
 */
import { defineFunction } from '@aws-amplify/backend';

export const feedApi = defineFunction({
  name: 'feed-api',
  entry: './handler.ts',
  memoryMB: 128,
  timeoutSeconds: 10,
  resourceGroupName: 'data',
});
