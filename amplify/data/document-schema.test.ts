/**
 * pdf-library-unit — tests for the `Document` model and the five Contract 6
 * operations in the shared Amplify Data schema.
 *
 * As in `donation-schema.test.ts` / `post-schema.test.ts`:
 * `@aws-amplify/backend` is NOT mocked and nothing is synthesized. The tests
 * read the exported schema definition and the GraphQL SDL
 * `schema.transform()` derives from it — the SDL AppSync gets.
 */
import { DOCUMENT_CATEGORIES, DOCUMENT_CATEGORY_INDEX, schema } from './resource';
import { documentApi } from '../functions/document-api/resource';

type EnumLike = { values: readonly string[] };
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
type CustomTypeLike = { data: { fields: Record<string, unknown> } };

const types = schema.data.types as Record<string, unknown>;
const sdl = schema.transform().schema;

const PUBLIC_OPERATIONS = ['listDocuments', 'getDocumentDownloadUrl'] as const;
const ADMIN_OPERATIONS = [
  'createDocumentUploadUrl',
  'confirmDocumentUpload',
  'deleteDocument',
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

describe('pdf-library-unit: Document schema (Contract 6, entities.md)', () => {
  it('declares DocumentCategory with the three fixed Contract 6 values, verbatim (BR6.1)', () => {
    expect((types.DocumentCategory as EnumLike).values).toEqual([
      'DAILY_POOJAN',
      'VARIOUS_VIDHAANS',
      'BHAKTAMAR',
    ]);
    // The constant the Lambda validates against is the same list.
    expect([...DOCUMENT_CATEGORIES]).toEqual((types.DocumentCategory as EnumLike).values);
    expect(sdl).toContain(
      'enum DocumentCategory {\n  DAILY_POOJAN\n  VARIOUS_VIDHAANS\n  BHAKTAMAR\n}',
    );
  });

  it('declares exactly the entities.md fields with the contract types — no soft-delete marker (BR6.4 is a hard delete)', () => {
    const fields = Object.keys((types.Document as ModelLike).data.fields);
    expect(fields.sort()).toEqual(
      ['title', 'category', 's3Key', 'uploadedByGoogleId', 'uploadedAt'].sort(),
    );
    const model = sdl.slice(
      sdl.indexOf('type Document @model'),
      sdl.indexOf('type DocumentUploadTarget'),
    );
    expect(model).toContain('title: String!');
    expect(model).toContain('category: DocumentCategory! @index(');
    expect(model).toContain('s3Key: String!');
    expect(model).toContain('uploadedByGoogleId: String!');
    expect(model).toContain('uploadedAt: AWSDateTime!');
    expect(model).not.toMatch(/deletedAt|status/);
  });

  it('disables the generated model queries, mutations and subscriptions so Contract 6 names stay exact and the table is reachable only through the Lambda', () => {
    expect((types.Document as ModelLike).data.disabledOperations).toEqual([
      'queries',
      'mutations',
      'subscriptions',
    ]);
    expect(sdl).toContain('type Document @model(queries:null,mutations:null,subscriptions:null)');
  });

  it('declares categoryIndex on category, sorted by uploadedAt, so browsing a category is a Query', () => {
    const indexes = (types.Document as ModelLike).data.secondaryIndexes.map((i) => i.data);
    expect(indexes).toEqual([
      expect.objectContaining({
        partitionKey: 'category',
        sortKeys: ['uploadedAt'],
        indexName: DOCUMENT_CATEGORY_INDEX,
      }),
    ]);
    expect(DOCUMENT_CATEGORY_INDEX).toBe('categoryIndex');
    expect(sdl).toContain('@index(name: "categoryIndex", sortKeyFields: ["uploadedAt"]');
  });

  it('exposes the five Contract 6 operations with the exact argument names and return types, all handled by the document-api Lambda', () => {
    expect((types.listDocuments as OperationLike).data.typeName).toBe('Query');
    expect((types.getDocumentDownloadUrl as OperationLike).data.typeName).toBe('Query');
    expect((types.createDocumentUploadUrl as OperationLike).data.typeName).toBe('Mutation');
    expect((types.confirmDocumentUpload as OperationLike).data.typeName).toBe('Mutation');
    expect((types.deleteDocument as OperationLike).data.typeName).toBe('Mutation');

    expect(Object.keys((types.listDocuments as OperationLike).data.arguments ?? {})).toEqual([
      'category',
    ]);
    expect(
      Object.keys((types.getDocumentDownloadUrl as OperationLike).data.arguments ?? {}),
    ).toEqual(['id']);
    expect(
      Object.keys((types.createDocumentUploadUrl as OperationLike).data.arguments ?? {}),
    ).toEqual(['title', 'category']);
    expect(
      Object.keys((types.confirmDocumentUpload as OperationLike).data.arguments ?? {}),
    ).toEqual(['s3Key', 'title', 'category']);
    expect(Object.keys((types.deleteDocument as OperationLike).data.arguments ?? {})).toEqual([
      'id',
    ]);

    expect(operationLine('listDocuments')).toMatch(
      /^\s*listDocuments\(category: DocumentCategory\): \[Document!\]! @function\(/,
    );
    expect(operationLine('getDocumentDownloadUrl')).toMatch(
      /^\s*getDocumentDownloadUrl\(id: ID!\): AWSURL! @function\(/,
    );
    expect(operationLine('createDocumentUploadUrl')).toMatch(
      /^\s*createDocumentUploadUrl\(title: String!, category: DocumentCategory!\): DocumentUploadTarget! @function\(/,
    );
    expect(operationLine('confirmDocumentUpload')).toMatch(
      /^\s*confirmDocumentUpload\(s3Key: String!, title: String!, category: DocumentCategory!\): Document! @function\(/,
    );
    expect(operationLine('deleteDocument')).toMatch(
      /^\s*deleteDocument\(id: ID!\): ID! @function\(/,
    );

    // DocumentUploadTarget: exactly the two contract fields.
    expect(Object.keys((types.DocumentUploadTarget as CustomTypeLike).data.fields)).toEqual([
      'uploadUrl',
      's3Key',
    ]);
    expect(sdl).toContain('uploadUrl: AWSURL!');

    // Every one of the five is the one shared Lambda — no JS resolver, no other function.
    for (const op of [...PUBLIC_OPERATIONS, ...ADMIN_OPERATIONS]) {
      expect(handlerFactoryOf(op)).toBe(documentApi);
    }
  });

  it('lets a guest and any signed-in user call the two public reads, and ONLY the Admin group call the three admin operations (BR6.3, BR6.5)', () => {
    for (const op of PUBLIC_OPERATIONS) {
      const line = operationLine(op);
      expect(line).toContain('{allow: public, provider: identityPool}');
      expect(line).toContain('{allow: private}');
      expect(line).not.toMatch(/groups|apiKey|aws_api_key/);
    }

    for (const op of ADMIN_OPERATIONS) {
      const line = operationLine(op);
      expect(line).toContain('@auth(rules: [{allow: groups, groups: ["Admin"]}])');
      expect(line).not.toMatch(/allow: public|allow: private|apiKey|aws_iam/);
    }

    // Type-level rules on Document mirror the operations: public/authenticated
    // READ only, full access for Admin — never a write for anyone else.
    const modelAuth =
      sdl.match(/type Document @model[^@]*@auth\(rules: \[([\s\S]*?)\]\)/)?.[1] ?? '';
    expect(modelAuth).toContain('{allow: public, provider: identityPool, operations: [read]}');
    expect(modelAuth).toContain('{allow: private, operations: [read]}');
    expect(modelAuth).toContain('{allow: groups, groups: ["Admin"]}');
    expect(modelAuth).not.toMatch(/allow: owner|apiKey/);
  });
});
