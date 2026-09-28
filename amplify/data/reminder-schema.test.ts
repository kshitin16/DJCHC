/**
 * reminder-unit — tests for the `Reminder` / `DeviceToken` models and the
 * five Contract 9 operations in the shared Amplify Data schema.
 *
 * As in `suggestion-schema.test.ts`: `@aws-amplify/backend` is NOT mocked and
 * nothing is synthesized. The tests read the exported schema definition and
 * the GraphQL SDL `schema.transform()` derives from it — the SDL AppSync gets.
 */
import {
  DEVICE_PLATFORMS,
  DEVICE_TOKEN_OWNER_INDEX,
  REMINDER_OWNER_INDEX,
  REMINDER_POST_INDEX,
  REMINDER_STATUSES,
  schema,
} from './resource';
import { reminderApi } from '../functions/reminder-api/resource';

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
const transformed = schema.transform();
const sdl = transformed.schema;

const CONTRACT_9_OPERATIONS = [
  'myReminders',
  'registerDeviceToken',
  'setRemindersEnabled',
  'snoozeReminder',
  'cancelReminder',
] as const;

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

/** Everything under this Unit's models plus its five operations. */
function reminderUnitSdl(): string {
  return [
    modelBlock('Reminder'),
    modelBlock('DeviceToken'),
    ...CONTRACT_9_OPERATIONS.map(operationLine),
  ].join('\n');
}

describe('reminder-unit: Reminder / DeviceToken schema (Contract 9, entities.md)', () => {
  it('declares the ReminderStatus and DevicePlatform enums with exactly the contract values', () => {
    expect([...REMINDER_STATUSES]).toEqual([
      'SCHEDULED',
      'SNOOZED',
      'FIRED',
      'CLEARED',
      'CANCELLED',
    ]);
    expect([...DEVICE_PLATFORMS]).toEqual(['IOS', 'ANDROID']);
    expect(sdl).toMatch(
      /enum ReminderStatus\s*{\s*SCHEDULED\s*SNOOZED\s*FIRED\s*CLEARED\s*CANCELLED\s*}/,
    );
    expect(sdl).toMatch(/enum DevicePlatform\s*{\s*IOS\s*ANDROID\s*}/);
  });

  it('declares exactly the entities.md fields on both models, with `id` as the identifier', () => {
    expect(Object.keys((types.Reminder as ModelLike).data.fields).sort()).toEqual(
      ['postId', 'ownerIdentityId', 'status', 'initialFireAt', 'snoozeFireAt', 'createdAt'].sort(),
    );
    const reminder = modelBlock('Reminder');
    expect(reminder).toContain('postId: ID! @index(');
    expect(reminder).toContain('ownerIdentityId: String! @index(');
    expect(reminder).toContain('status: ReminderStatus!');
    expect(reminder).toContain('initialFireAt: AWSDateTime!');
    expect(reminder).toContain('snoozeFireAt: AWSDateTime\n');
    expect(reminder).toContain('createdAt: AWSDateTime!');

    expect(Object.keys((types.DeviceToken as ModelLike).data.fields).sort()).toEqual(
      ['ownerIdentityId', 'pushToken', 'platform', 'remindersEnabled', 'registeredAt'].sort(),
    );
    const device = modelBlock('DeviceToken');
    expect(device).toContain('pushToken: String!');
    expect(device).toContain('platform: DevicePlatform!');
    expect(device).toContain('remindersEnabled: Boolean!');
    expect(device).toContain('registeredAt: AWSDateTime!');
    // Contract 9 names both identifiers `id`; no internal rename leaks out.
    expect(sdl).not.toMatch(/reminderId: ID|deviceTokenId/);
  });

  it('carries ownerIndex on BOTH tables (R-04) plus postIdIndex on Reminder, with the specified keys', () => {
    const reminderIndexes = (types.Reminder as ModelLike).data.secondaryIndexes.map((i) => i.data);
    expect(reminderIndexes).toEqual([
      expect.objectContaining({
        partitionKey: 'postId',
        sortKeys: [],
        indexName: REMINDER_POST_INDEX,
      }),
      expect.objectContaining({
        partitionKey: 'ownerIdentityId',
        sortKeys: ['initialFireAt'],
        indexName: REMINDER_OWNER_INDEX,
      }),
    ]);
    const deviceIndexes = (types.DeviceToken as ModelLike).data.secondaryIndexes.map((i) => i.data);
    expect(deviceIndexes).toEqual([
      expect.objectContaining({
        partitionKey: 'ownerIdentityId',
        sortKeys: [],
        indexName: DEVICE_TOKEN_OWNER_INDEX,
      }),
    ]);
    expect(REMINDER_POST_INDEX).toBe('postIdIndex');
    expect(REMINDER_OWNER_INDEX).toBe('ownerIndex');
    expect(DEVICE_TOKEN_OWNER_INDEX).toBe('ownerIndex');
    expect(modelBlock('Reminder')).toContain('@index(name: "postIdIndex"');
    expect(modelBlock('Reminder')).toContain(
      '@index(name: "ownerIndex", sortKeyFields: ["initialFireAt"]',
    );
    expect(modelBlock('DeviceToken')).toContain('@index(name: "ownerIndex"');
  });

  it('disables the generated queries, mutations and subscriptions on BOTH models, so Contract 9 names stay exact and no client path bypasses the Lambda', () => {
    for (const name of ['Reminder', 'DeviceToken']) {
      expect((types[name] as ModelLike).data.disabledOperations).toEqual([
        'queries',
        'mutations',
        'subscriptions',
      ]);
      expect(sdl).toContain(`type ${name} @model(queries:null,mutations:null,subscriptions:null)`);
    }
    const operations = sdl.slice(sdl.indexOf('type Query'));
    expect(operations).not.toMatch(
      /listReminders|getReminder|createReminder|updateReminder|deleteReminder|listDeviceTokens|createDeviceToken/,
    );
  });

  it('exposes the five Contract 9 operations with the exact names, arguments and return types, all handled by reminder-api', () => {
    expect((types.myReminders as OperationLike).data.typeName).toBe('Query');
    for (const op of CONTRACT_9_OPERATIONS.slice(1)) {
      expect((types[op] as OperationLike).data.typeName).toBe('Mutation');
    }
    expect(Object.keys((types.myReminders as OperationLike).data.arguments ?? {})).toEqual([]);
    expect(Object.keys((types.registerDeviceToken as OperationLike).data.arguments ?? {})).toEqual([
      'pushToken',
      'platform',
    ]);
    expect(Object.keys((types.setRemindersEnabled as OperationLike).data.arguments ?? {})).toEqual([
      'enabled',
    ]);
    expect(Object.keys((types.snoozeReminder as OperationLike).data.arguments ?? {})).toEqual([
      'id',
    ]);
    expect(Object.keys((types.cancelReminder as OperationLike).data.arguments ?? {})).toEqual([
      'id',
    ]);

    expect(operationLine('myReminders')).toMatch(/^\s*myReminders: \[Reminder!\]! @function\(/);
    expect(operationLine('registerDeviceToken')).toMatch(
      /^\s*registerDeviceToken\(pushToken: String!, platform: DevicePlatform!\): DeviceToken! @function\(/,
    );
    expect(operationLine('setRemindersEnabled')).toMatch(
      /^\s*setRemindersEnabled\(enabled: Boolean!\): DeviceToken! @function\(/,
    );
    expect(operationLine('snoozeReminder')).toMatch(
      /^\s*snoozeReminder\(id: ID!\): Reminder! @function\(/,
    );
    expect(operationLine('cancelReminder')).toMatch(
      /^\s*cancelReminder\(id: ID!\): Reminder! @function\(/,
    );
    for (const op of CONTRACT_9_OPERATIONS) {
      expect(handlerFactoryOf(op)).toBe(reminderApi);
    }
  });

  it('lets guests AND signed-in users call all five operations (BR7.6), and carries NO schema-wide function grant — listPosts access is a single-field IAM grant in backend.ts (review R-01)', () => {
    for (const op of CONTRACT_9_OPERATIONS) {
      const line = operationLine(op);
      expect(line).toContain('{allow: public, provider: identityPool}');
      expect(line).toContain('{allow: private}');
    }
    // A schema-level `allow.resource(fn).to(['query'])` would grant
    // `appsync:GraphQL` on `types/Query/*` — every query, admin-only ones
    // included. The reminder-api Lambda must therefore appear in NO
    // schema-wide grant; backend.ts names the one `listPosts` field instead.
    const access = (
      transformed as unknown as {
        functionSchemaAccess: Array<{ resourceProvider: unknown; actions: string[] }>;
      }
    ).functionSchemaAccess;
    expect(access.some((entry) => entry.resourceProvider === reminderApi)).toBe(false);
  });

  it('carries no Admin-group, owner or API-key rule anywhere in this Unit — the guest identity is the only authorization model', () => {
    const unit = reminderUnitSdl();
    expect(unit).not.toMatch(
      /allow: groups|allow: owner|identityClaim|apiKey|aws_api_key|aws_cognito_user_pools/,
    );
    for (const name of ['Reminder', 'DeviceToken']) {
      const auth = modelBlock(name).match(/@auth\(rules: \[([\s\S]*?)\]\)/)?.[1] ?? '';
      expect(auth).toContain('{allow: public, provider: identityPool, operations: [read]}');
      expect(auth).toContain('{allow: private, operations: [read]}');
      expect(auth).not.toMatch(/create|update|delete/);
      expect(auth.match(/allow:/g)).toHaveLength(2);
    }
  });
});
