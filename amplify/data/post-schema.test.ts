/**
 * feed-unit — tests for the `Post` model and the six Contract 3 operations in
 * the shared Amplify Data schema.
 *
 * As in `donation-schema.test.ts`: `@aws-amplify/backend` is NOT mocked and
 * nothing is synthesized. The tests read the exported schema definition and
 * the GraphQL SDL `schema.transform()` derives from it — the SDL AppSync gets.
 */
import { POST_TYPES, data, schema } from './resource';
import { feedApi } from '../functions/feed-api/resource';

type EnumLike = { values: readonly string[] };
type ModelLike = {
  data: {
    fields: Record<string, unknown>;
    disabledOperations: readonly string[];
  };
};
type OperationLike = {
  data: { arguments: Record<string, unknown> | null; typeName: string };
};
type CustomTypeLike = { data: { fields: Record<string, unknown> } };

const types = schema.data.types as Record<string, unknown>;
const transformed = schema.transform();
const sdl = transformed.schema;
type JsResolver = {
  typeName: string;
  fieldName: string;
  handlers?: { dataSource?: string }[];
};
// Only the JS resolvers bound to the Post table: the schema is shared, and
// later Units (suggestion-unit's `myPastSuggestions`) add JS resolvers on
// their own tables.
const jsResolvers = ((transformed as { jsFunctions?: JsResolver[] }).jsFunctions ?? []).filter(
  (r) => r.handlers?.some((h) => h.dataSource === 'PostTable'),
);

const ADMIN_OPERATIONS = [
  'listAllPostsForAdmin',
  'getPost',
  'createPost',
  'updatePost',
  'deletePost',
] as const;

/**
 * The operation's whole definition: from its own line up to (not including)
 * the next field or the closing brace — an `@auth` directive can wrap lines.
 */
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

describe('feed-unit: Post schema (Contract 3, entities.md)', () => {
  it('declares PostType with the Contract 3 values, verbatim (BR2.1)', () => {
    expect((types.PostType as EnumLike).values).toEqual([
      'EVENT',
      'VISITING_DIGNITARY',
      'DONATION_CALL_OUT',
    ]);
    expect([...POST_TYPES]).toEqual((types.PostType as EnumLike).values);
  });

  it('declares every entities.md field with the contract types, including the optional soft-delete marker', () => {
    const fields = Object.keys((types.Post as ModelLike).data.fields);
    expect(fields.sort()).toEqual(
      [
        'type',
        'title',
        'description',
        'dateTime',
        'createdByGoogleId',
        'createdAt',
        'updatedAt',
        'deletedAt',
      ].sort(),
    );
    expect(sdl).toContain('type: PostType!');
    expect(sdl).toContain('title: String!');
    expect(sdl).toContain('description: String!');
    expect(sdl).toContain('dateTime: AWSDateTime!');
    expect(sdl).toContain('createdByGoogleId: String!');
    expect(sdl).toContain('updatedAt: AWSDateTime!');
    expect(sdl).toContain('deletedAt: AWSDateTime\n');
  });

  it('disables the generated model queries, mutations and subscriptions so Contract 3 names stay exact and the table is reachable only through the resolvers (BR2.6)', () => {
    expect((types.Post as ModelLike).data.disabledOperations).toEqual([
      'queries',
      'mutations',
      'subscriptions',
    ]);
    expect(sdl).toContain('type Post @model(queries:null,mutations:null,subscriptions:null)');
  });

  it('exposes the six Contract 3 operations with the contract argument names and return shapes — the two list queries Lambda-handled, the four single-item admin operations JS resolvers on the Post table', () => {
    expect((types.listPosts as OperationLike).data.typeName).toBe('Query');
    expect((types.listAllPostsForAdmin as OperationLike).data.typeName).toBe('Query');
    expect((types.getPost as OperationLike).data.typeName).toBe('Query');
    expect((types.createPost as OperationLike).data.typeName).toBe('Mutation');
    expect((types.updatePost as OperationLike).data.typeName).toBe('Mutation');
    expect((types.deletePost as OperationLike).data.typeName).toBe('Mutation');

    expect(Object.keys((types.listPosts as OperationLike).data.arguments ?? {})).toEqual([]);
    expect(Object.keys((types.listAllPostsForAdmin as OperationLike).data.arguments ?? {})).toEqual(
      [],
    );
    expect(Object.keys((types.getPost as OperationLike).data.arguments ?? {})).toEqual(['id']);
    expect(Object.keys((types.createPost as OperationLike).data.arguments ?? {})).toEqual([
      'input',
    ]);
    expect(Object.keys((types.updatePost as OperationLike).data.arguments ?? {})).toEqual([
      'id',
      'input',
    ]);
    expect(Object.keys((types.deletePost as OperationLike).data.arguments ?? {})).toEqual(['id']);

    expect(operationLine('listPosts')).toMatch(/^\s*listPosts: \[Post!\]! /);
    expect(operationLine('listAllPostsForAdmin')).toMatch(/^\s*listAllPostsForAdmin: \[Post!\]! /);
    expect(operationLine('getPost')).toMatch(/^\s*getPost\(id: ID!\): Post /);
    expect(operationLine('createPost')).toMatch(
      /^\s*createPost\(input: CreatePostInput!\): Post! /,
    );
    expect(operationLine('updatePost')).toMatch(
      /^\s*updatePost\(id: ID!, input: UpdatePostInput!\): Post! /,
    );
    expect(operationLine('deletePost')).toMatch(/^\s*deletePost\(id: ID!\): Post! /);

    // Revision 1 (finding F-1): `listAllPostsForAdmin` moved off the JS
    // resolvers onto the `feed-api` Lambda so it can page the table; only the
    // four single-item operations remain JS resolvers on the Post table.
    const resolverFields = (jsResolvers ?? []).map((r) => `${r.typeName}.${r.fieldName}`).sort();
    expect(resolverFields).toEqual(
      ['Query.getPost', 'Mutation.createPost', 'Mutation.updatePost', 'Mutation.deletePost'].sort(),
    );
    expect(resolverFields).not.toContain('Query.listAllPostsForAdmin');

    expect(operationLine('listPosts')).toContain('@function(name: "FnListPosts")');
    expect(operationLine('listAllPostsForAdmin')).toContain(
      '@function(name: "FnListAllPostsForAdmin")',
    );
    // Both list queries must be handled by the SAME feedApi function: that
    // shared handler is what keeps one paginated Scan implementation for both.
    for (const field of ['listPosts', 'listAllPostsForAdmin'] as const) {
      const handlers = (types[field] as { data: { handlers: unknown[] | null } }).data.handlers;
      expect(handlers).toHaveLength(1);
      // The handler's data lives behind a private symbol; it must be the
      // feedApi function factory (not a resolver entry file).
      const handlerObject = handlers?.[0] as unknown as Record<symbol, unknown>;
      const handlerData = Object.getOwnPropertySymbols(handlerObject)
        .map((sym) => handlerObject[sym])
        .find(
          (value): value is { handler: unknown } =>
            typeof value === 'object' && value !== null && 'handler' in value,
        );
      expect(handlerData?.handler).toBe(feedApi);
    }
  });

  it('lets a guest (identity-pool unauthenticated role) and any signed-in user call listPosts, and ONLY the Admin group call the five admin operations (BR2.3, BR2.7, NFR-AUTHZ.1)', () => {
    const publicRead = operationLine('listPosts');
    expect(publicRead).toContain('{allow: public, provider: identityPool}');
    expect(publicRead).toContain('{allow: private}');
    expect(publicRead).not.toMatch(/groups|apiKey|aws_api_key/);

    // All five admin operations restrict to the Admin group, but the SDL
    // renders the rule at a different stage depending on the handler: a JS
    // resolver field is already expanded to the cognito-groups directive,
    // while a `@function`-handled field still carries the `@auth` rule the
    // Amplify transformer expands at deploy time (`listPosts` shows the same
    // form above). Both are the declarative, server-side enforcing layer.
    for (const op of ADMIN_OPERATIONS) {
      const line = operationLine(op);
      const restrictedToAdmin =
        line.includes('@aws_cognito_user_pools(cognito_groups: ["Admin"])') ||
        line.includes('@auth(rules: [{allow: groups, groups: ["Admin"]}])');
      expect({ op, restrictedToAdmin }).toEqual({ op, restrictedToAdmin: true });
      // Nothing else may reach them: no guest, no plain authenticated caller,
      // no API key, no IAM principal.
      expect(line).not.toContain('@aws_api_key');
      expect(line).not.toContain('@aws_iam');
      expect(line).not.toContain('apiKey');
      expect(line).not.toContain('identityPool');
      expect(line).not.toContain('{allow: public');
      expect(line).not.toContain('{allow: private');
    }
    // The two Lambda-backed queries must NOT share an authorization rule just
    // because they share a handler.
    expect(operationLine('listAllPostsForAdmin')).not.toContain('{allow: public');
    expect(operationLine('listPosts')).not.toContain('groups');

    // Type-level rules on Post mirror the operations: public/authenticated
    // READ only, full access for Admin — never a write for anyone else.
    const modelAuth = sdl.match(/type Post @model[^@]*@auth\(rules: \[([\s\S]*?)\]\)/)?.[1] ?? '';
    expect(modelAuth).toContain('{allow: public, provider: identityPool, operations: [read]}');
    expect(modelAuth).toContain('{allow: private, operations: [read]}');
    expect(modelAuth).toContain('{allow: groups, groups: ["Admin"]}');
    expect(modelAuth).not.toMatch(/allow: owner|apiKey/);

    // Revision 2: no API-key mode anywhere — nothing about the public read expires.
    expect(sdl).not.toMatch(/apiKey|aws_api_key/);
    const modes = (data as unknown as { props: { authorizationModes: Record<string, unknown> } })
      .props.authorizationModes;
    expect(modes).toEqual({ defaultAuthorizationMode: 'userPool' });
  });

  it('defines CreatePostInput (all four fields required) and UpdatePostInput (all four optional) exactly per Contract 3', () => {
    expect(Object.keys((types.CreatePost as CustomTypeLike).data.fields)).toEqual([
      'type',
      'title',
      'description',
      'dateTime',
    ]);
    expect(Object.keys((types.UpdatePost as CustomTypeLike).data.fields)).toEqual([
      'type',
      'title',
      'description',
      'dateTime',
    ]);
    expect(sdl).toContain(
      'input CreatePostInput {\n  type: PostType!\n  title: String!\n  description: String!\n  dateTime: AWSDateTime!\n}',
    );
    expect(sdl).toContain(
      'input UpdatePostInput {\n  type: PostType\n  title: String\n  description: String\n  dateTime: AWSDateTime\n}',
    );
  });
});
