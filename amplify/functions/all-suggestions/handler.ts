/**
 * suggestion-unit (U3) — AppSync Lambda resolver for Contract 4's admin-only
 * `allSuggestions: [Suggestion!]!`.
 *
 * Rules realized: BR3.3 (admin visibility — backstop), BR3.6 (a plain list;
 * no read/resolved state exists to manage), the functional spec's
 * newest-first ordering, and performance-design.md's full Scan loop.
 *
 * ## Who enforces what (project.md Correction: never leave implicit)
 *
 * - AppSync (declarative, server-side — THE enforcing layer): the operation
 *   carries `allow.group('Admin')` ONLY in `amplify/data/resource.ts`, so a
 *   caller whose `cognito:groups` claim (Contract 2) lacks "Admin" never
 *   reaches this code.
 * - This handler (defense-in-depth BACKSTOP): `requireAdmin` re-checks
 *   `event.identity.groups` and throws otherwise. Identity is read ONLY from
 *   `event.identity`, never from arguments or headers.
 *
 * **CORRECTED 2026-10-01, against the first real deployment.** The claim above
 * that AppSync filters the caller before this code runs is FALSE for this
 * Lambda-backed operation. `allow.group('Admin')` is declared in
 * `amplify/data/resource.ts`, but Amplify Data only translates it into an
 * `@aws_cognito_user_pools(cognito_groups:["Admin"])` directive for
 * `a.handler.custom(...)` JS resolvers. For `a.handler.function(...)` it
 * degrades silently to plain `@aws_cognito_user_pools` — any authenticated
 * Cognito user — with no warning at synth or deploy time. Verified by reading
 * the deployed SDL with `aws appsync get-introspection-schema
 * --include-directives`.
 *
 * So `requireAdmin` below is NOT a backstop here. It is THE enforcing layer:
 * the only thing between an ordinary signed-in worshipper and this operation.
 * Do not remove or weaken it. The test asserting a non-admin is refused exists
 * to make that impossible to do by accident.
 * - Flutter screens (flutter-app-unit): UX convenience only.
 */
import type { AppSyncResolverEvent } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { SuggestionAuthorizationError } from '../suggestion-shared/errors';
import {
  SuggestionRepository,
  type SuggestionRepositoryLike,
} from '../suggestion-shared/suggestion-repository';
import { SUGGESTION_TABLE_ENV, type SuggestionRecord } from '../suggestion-shared/types';

export interface AllSuggestionsDeps {
  repository: Pick<SuggestionRepositoryLike, 'listAll'>;
}

export type AllSuggestionsEvent = AppSyncResolverEvent<Record<string, never>>;

/** BR3.3 backstop behind the declarative `allow.group('Admin')` rule. */
export function requireAdmin(event: AllSuggestionsEvent): void {
  const identity = event.identity as { sub?: unknown; groups?: unknown } | null | undefined;
  const groups = Array.isArray(identity?.groups) ? identity.groups : [];
  if (!identity || typeof identity.sub !== 'string' || !groups.includes('Admin')) {
    throw new SuggestionAuthorizationError('Only an admin can view all suggestions');
  }
}

/** Newest submission first, deterministic on ties. */
export function sortNewestFirst(suggestions: SuggestionRecord[]): SuggestionRecord[] {
  return [...suggestions].sort(
    (a, b) => b.submittedAt.localeCompare(a.submittedAt) || a.id.localeCompare(b.id),
  );
}

/** Builds the resolver from injected dependencies (real client in `handler`, a fake in tests). */
export function createHandler(deps: AllSuggestionsDeps) {
  return async (event: AllSuggestionsEvent): Promise<SuggestionRecord[]> => {
    if (resolvedFieldName(event) !== 'allSuggestions') {
      throw new Error(`all-suggestions: unsupported operation ${resolvedFieldName(event)}`);
    }
    requireAdmin(event);
    return sortNewestFirst(await deps.repository.listAll());
  };
}

// --- Lambda entry point: real client, built lazily on first use -----------
let realDeps: AllSuggestionsDeps | undefined;

function realDependencies(): AllSuggestionsDeps {
  realDeps ??= {
    repository: new SuggestionRepository(DynamoDBDocumentClient.from(new DynamoDBClient({})), {
      tableName: process.env[SUGGESTION_TABLE_ENV] ?? '',
    }),
  };
  return realDeps;
}

export const handler = async (event: AllSuggestionsEvent): Promise<SuggestionRecord[]> =>
  createHandler(realDependencies())(event);


/**
 * The GraphQL field being resolved, read from EITHER payload shape.
 *
 * Amplify Gen2's generated resolver does NOT send AppSync's documented context
 * object. Its request template builds a FLAT payload:
 *
 *   { typeName, fieldName, arguments, identity, source, request, prev }
 *
 * so there is no `info` and `event.info.fieldName` throws
 * "Cannot read properties of undefined (reading 'fieldName')" on the first
 * line of dispatch. Every Lambda-backed operation in this app was broken this
 * way - the feed, the document library, suggestions, reminders and donations -
 * and none of the unit tests caught it, because they construct events in the
 * DOCUMENTED nested shape rather than the one Amplify actually delivers.
 *
 * Both shapes are accepted: the flat one is production, the nested one keeps
 * the existing tests meaningful and matches AppSync's own direct-resolver
 * format, which this could be switched to later.
 *
 * Verified against the deployed request mapping template, 2026-10-18.
 */
function resolvedFieldName(event: unknown): string {
  const e = event as { info?: { fieldName?: string }; fieldName?: string };
  return e.info?.fieldName ?? e.fieldName ?? '';
}
