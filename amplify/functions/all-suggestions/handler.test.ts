/**
 * suggestion-unit — `all-suggestions` Lambda tests (BR3.3 backstop, BR3.6,
 * newest-first ordering, full Scan). The declarative `allow.group('Admin')`
 * rule is asserted in `amplify/data/suggestion-schema.test.ts`.
 */
import type { AppSyncResolverEvent } from 'aws-lambda';
import { SuggestionAuthorizationError } from '../suggestion-shared/errors';
import type { SuggestionRecord } from '../suggestion-shared/types';
import { createHandler, sortNewestFirst, type AllSuggestionsEvent } from './handler';

function event(identity: unknown, fieldName = 'allSuggestions'): AllSuggestionsEvent {
  return {
    arguments: {},
    identity,
    source: null,
    request: { headers: {}, domainName: null },
    info: {
      fieldName,
      parentTypeName: 'Query',
      variables: {},
      selectionSetList: [],
      selectionSetGraphQL: '',
    },
    prev: null,
    stash: {},
  } as unknown as AppSyncResolverEvent<Record<string, never>>;
}

const ADMIN = { sub: 'admin-sub', groups: ['Admin'] };

function aSuggestion(id: string, submittedAt: string): SuggestionRecord {
  return {
    id,
    submittedByGoogleId: `sub-${id}`,
    text: `Suggestion ${id}`,
    submittedAt,
    createdAt: submittedAt,
    updatedAt: submittedAt,
  };
}

function handlerOver(rows: SuggestionRecord[]) {
  let listAllCalls = 0;
  const handler = createHandler({
    repository: {
      listAll: async () => {
        listAllCalls += 1;
        return rows;
      },
    },
  });
  return { handler, calls: () => listAllCalls };
}

describe('suggestion-unit: all-suggestions Lambda', () => {
  it('refuses a non-admin, an anonymous caller and a wrong operation without touching the table (BR3.3 backstop)', async () => {
    const { handler, calls } = handlerOver([aSuggestion('a', '2026-09-19T10:00:00.000Z')]);
    await expect(handler(event({ sub: 'user-sub', groups: null }))).rejects.toBeInstanceOf(
      SuggestionAuthorizationError,
    );
    await expect(handler(event({ sub: 'user-sub', groups: ['Members'] }))).rejects.toThrow(
      'Only an admin can view all suggestions',
    );
    await expect(handler(event(null))).rejects.toBeInstanceOf(SuggestionAuthorizationError);
    await expect(handler(event(ADMIN, 'listSuggestions'))).rejects.toThrow('unsupported operation');
    expect(calls()).toBe(0);
  });

  it("returns everything the repository read (all pages are the repository's job — one listAll call)", async () => {
    const rows = [
      aSuggestion('a', '2026-09-19T10:00:00.000Z'),
      aSuggestion('b', '2026-09-18T10:00:00.000Z'),
      aSuggestion('c', '2026-09-17T10:00:00.000Z'),
    ];
    const { handler, calls } = handlerOver(rows);
    const result = await handler(event(ADMIN));
    expect(result).toHaveLength(3);
    expect(new Set(result.map((r) => r.id))).toEqual(new Set(['a', 'b', 'c']));
    expect(calls()).toBe(1);
  });

  it('sorts newest first, deterministic on equal timestamps, without mutating the input', async () => {
    const rows = [
      aSuggestion('old', '2026-09-01T10:00:00.000Z'),
      aSuggestion('tie-b', '2026-09-19T10:00:00.000Z'),
      aSuggestion('newest', '2026-09-19T12:00:00.000Z'),
      aSuggestion('tie-a', '2026-09-19T10:00:00.000Z'),
    ];
    const snapshot = rows.map((r) => r.id);
    const { handler } = handlerOver(rows);
    expect((await handler(event(ADMIN))).map((r) => r.id)).toEqual([
      'newest',
      'tie-a',
      'tie-b',
      'old',
    ]);
    expect(rows.map((r) => r.id)).toEqual(snapshot);
    expect(sortNewestFirst([]).length).toBe(0);
  });

  it('returns [] for an empty table', async () => {
    const { handler } = handlerOver([]);
    expect(await handler(event(ADMIN))).toEqual([]);
  });
});
