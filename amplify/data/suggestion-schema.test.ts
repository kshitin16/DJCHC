/**
 * suggestion-unit — tests for the `Suggestion` model, the internal
 * `SuggestionDailyCount` counter and the three Contract 4 operations in the
 * shared Amplify Data schema.
 *
 * As in `document-schema.test.ts`: `@aws-amplify/backend` is NOT mocked and
 * nothing is synthesized. The tests read the exported schema definition and
 * the GraphQL SDL `schema.transform()` derives from it — the SDL AppSync gets.
 */
import { SUGGESTION_SUBMITTER_INDEX, schema } from './resource';
import { allSuggestions } from '../functions/all-suggestions/resource';
import { submitSuggestion } from '../functions/submit-suggestion/resource';

type IndexLike = { data: { partitionKey: string; sortKeys: readonly string[]; indexName: string } };
type ModelLike = {
  data: {
    fields: Record<string, unknown>;
    secondaryIndexes: readonly IndexLike[];
    disabledOperations: readonly string[];
  };
};
type OperationLike = {
  data: { arguments: Record<string, unknown> | null; typeName: string; handlers: unknown[] | null };
};

const types = schema.data.types as Record<string, unknown>;
const sdl = schema.transform().schema;

/** The operation's whole definition, including a wrapped `@auth` directive. */
function operationLine(name: string): string {
  const lines = sdl.split('\n');
  const start = lines.findIndex(
    (l) => l.trim().startsWith(`${name}(`) || l.trim().startsWith(`${name}:`),
  );
  if (start < 0) return '';
  const block = [lines[start]];
  for (const line of lines.slice(start + 1)) {
    if (/^ {2}[A-Za-z]/.test(line) || line.startsWith('}')) break;
    block.push(line);
  }
  return block.join('\n');
}

/** The `defineFunction` factory behind an operation's single handler (kept behind a private symbol). */
function handlerFactoryOf(operation: string): unknown {
  const handlers = (types[operation] as OperationLike).data.handlers;
  expect(handlers).toHaveLength(1);
  const handlerObject = handlers?.[0] as unknown as Record<symbol, unknown>;
  const handlerData = Object.getOwnPropertySymbols(handlerObject)
    .map((sym) => handlerObject[sym])
    .find(
      (value): value is { handler: unknown } =>
        typeof value === 'object' && value !== null && 'handler' in value,
    );
  return handlerData?.handler;
}

function modelBlock(name: string): string {
  const start = sdl.indexOf(`type ${name} @model`);
  const end = sdl.indexOf('\n}\n', start);
  return sdl.slice(start, end);
}

describe('suggestion-unit: Suggestion schema (Contract 4, entities.md)', () => {
  it('declares exactly the entities.md fields with the contract types — no delete marker, no read/resolved state (BR3.4, BR3.6)', () => {
    const fields = Object.keys((types.Suggestion as ModelLike).data.fields);
    expect(fields.sort()).toEqual(['submittedByGoogleId', 'text', 'submittedAt'].sort());
    const model = modelBlock('Suggestion');
    expect(model).toContain('submittedByGoogleId: String! @index(');
    expect(model).toContain('text: String!');
    expect(model).toContain('submittedAt: AWSDateTime!');
    expect(model).not.toMatch(/deletedAt|status|resolved|readAt/);
    // The identifier is `id`, exactly as Contract 4 names it.
    expect(sdl).not.toContain('suggestionId');
  });

  it('disables the generated queries, mutations and subscriptions on BOTH models, so Contract 4 names stay exact and no client write path exists', () => {
    for (const name of ['Suggestion', 'SuggestionDailyCount']) {
      expect((types[name] as ModelLike).data.disabledOperations).toEqual([
        'queries',
        'mutations',
        'subscriptions',
      ]);
      expect(sdl).toContain(`type ${name} @model(queries:null,mutations:null,subscriptions:null)`);
    }
    expect(sdl).not.toMatch(/deleteSuggestion|createSuggestion|updateSuggestion/);
  });

  it('declares submitterIndex on submittedByGoogleId, sorted by submittedAt, so myPastSuggestions is an owner-keyed Query', () => {
    const indexes = (types.Suggestion as ModelLike).data.secondaryIndexes.map((i) => i.data);
    expect(indexes).toEqual([
      expect.objectContaining({
        partitionKey: 'submittedByGoogleId',
        sortKeys: ['submittedAt'],
        indexName: SUGGESTION_SUBMITTER_INDEX,
      }),
    ]);
    expect(SUGGESTION_SUBMITTER_INDEX).toBe('submitterIndex');
    expect(sdl).toContain('@index(name: "submitterIndex", sortKeyFields: ["submittedAt"]');
  });

  it('exposes the three Contract 4 operations with the exact names, arguments and return types and the right handler kind', () => {
    expect((types.submitSuggestion as OperationLike).data.typeName).toBe('Mutation');
    expect((types.myPastSuggestions as OperationLike).data.typeName).toBe('Query');
    expect((types.allSuggestions as OperationLike).data.typeName).toBe('Query');

    expect(Object.keys((types.submitSuggestion as OperationLike).data.arguments ?? {})).toEqual([
      'text',
    ]);
    expect(Object.keys((types.myPastSuggestions as OperationLike).data.arguments ?? {})).toEqual(
      [],
    );
    expect(Object.keys((types.allSuggestions as OperationLike).data.arguments ?? {})).toEqual([]);

    expect(operationLine('submitSuggestion')).toMatch(
      /^\s*submitSuggestion\(text: String!\): Suggestion! @function\(/,
    );
    expect(operationLine('myPastSuggestions')).toMatch(/^\s*myPastSuggestions: \[Suggestion!\]! /);
    expect(operationLine('myPastSuggestions')).not.toContain('@function');
    expect(operationLine('allSuggestions')).toMatch(
      /^\s*allSuggestions: \[Suggestion!\]! @function\(/,
    );

    expect(handlerFactoryOf('submitSuggestion')).toBe(submitSuggestion);
    expect(handlerFactoryOf('allSuggestions')).toBe(allSuggestions);
    expect(handlerFactoryOf('myPastSuggestions')).toBeUndefined(); // a JS resolver, not a Lambda
  });

  it('lets any signed-in user call submitSuggestion and myPastSuggestions, and ONLY the Admin group call allSuggestions; the model grants owner READ + Admin READ and nothing else (BR3.2, BR3.3)', () => {
    // A Lambda-backed operation renders `allow: private`; a JS-resolver
    // operation renders the equivalent `@aws_cognito_user_pools` directive.
    expect(operationLine('submitSuggestion')).toContain('@auth(rules: [{allow: private}])');
    expect(operationLine('myPastSuggestions')).toMatch(
      /^\s*myPastSuggestions: \[Suggestion!\]! @aws_cognito_user_pools\s*$/,
    );
    for (const op of ['submitSuggestion', 'myPastSuggestions']) {
      expect(operationLine(op)).not.toMatch(/groups|public|apiKey|aws_api_key|aws_iam/);
    }
    const admin = operationLine('allSuggestions');
    expect(admin).toContain('@auth(rules: [{allow: groups, groups: ["Admin"]}])');
    expect(admin).not.toMatch(/allow: public|allow: private|apiKey|aws_iam/);

    const modelAuth = modelBlock('Suggestion').match(/@auth\(rules: \[([\s\S]*?)\]\)/)?.[1] ?? '';
    expect(modelAuth).toContain(
      '{allow: owner, operations: [read], ownerField: "submittedByGoogleId", identityClaim: "sub"}',
    );
    expect(modelAuth).toContain('{allow: groups, operations: [read], groups: ["Admin"]}');
    expect(modelAuth).not.toMatch(/allow: private|allow: public|create|update|delete/);
    // Exactly two rules — nothing else may read, nobody may write.
    expect(modelAuth.match(/allow:/g)).toHaveLength(2);
  });

  it('keeps SuggestionDailyCount internal: count + ttl, Admin READ only, no owner rule and no client operation (BR3.5, NFR-RATE.1)', () => {
    expect(Object.keys((types.SuggestionDailyCount as ModelLike).data.fields).sort()).toEqual([
      'count',
      'ttl',
    ]);
    const block = modelBlock('SuggestionDailyCount');
    expect(block).toContain('count: Int!');
    expect(block).toContain('ttl: Int!');
    const auth = block.match(/@auth\(rules: \[([\s\S]*?)\]\)/)?.[1] ?? '';
    expect(auth).toBe('{allow: groups, operations: [read], groups: ["Admin"]}');
    expect(auth).not.toMatch(/owner|private|public/);
    // No Query/Mutation field anywhere mentions the counter type.
    const operations = sdl.slice(sdl.indexOf('type Query'));
    expect(operations).not.toContain('SuggestionDailyCount');
  });
});
