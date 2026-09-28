/**
 * feed-unit — Jest test double for `@aws-appsync/utils`.
 *
 * The real module exists only inside the AppSync `APPSYNC_JS` runtime; under
 * Jest, `jest.config.ts` maps `@aws-appsync/utils` to this file so the six
 * resolver files in `amplify/data/post-resolvers/` can be imported and their
 * exported `request(ctx)` / `response(ctx)` executed against hand-built `ctx`
 * objects. It implements exactly the functions those resolvers use, with the
 * documented AppSync semantics, and nothing else:
 *
 * - `util.dynamodb.toDynamoDB` / `toMapValues` — DynamoDB attribute-value
 *   marshalling (`{ S }`, `{ N }`, `{ BOOL }`, `{ NULL }`, `{ L }`, `{ M }`).
 * - `util.time.nowISO8601` / `nowEpochMilliSeconds` /
 *   `epochMilliSecondsToISO8601` / `parseISO8601ToEpochMilliSeconds` — driven
 *   by an injectable clock (`setNow`) so cutoff assertions are exact.
 * - `util.autoId` — deterministic (`resetAutoId` restarts the sequence).
 * - `util.error` / `util.unauthorized` — throw (the runtime aborts the
 *   resolver; a throw is the closest Node equivalent).
 *
 * Excluded from coverage collection (`jest.config.ts`); never deployed.
 */

type DynamoDBValue =
  | { S: string }
  | { N: string }
  | { BOOL: boolean }
  | { NULL: true }
  | { L: DynamoDBValue[] }
  | { M: Record<string, DynamoDBValue> };

/** Thrown by `util.error`; carries the AppSync error type. */
export class AppSyncResolverError extends Error {
  readonly errorType: string;
  constructor(message: string, errorType: string) {
    super(message);
    this.name = 'AppSyncResolverError';
    this.errorType = errorType;
  }
}

/** Thrown by `util.unauthorized`. */
export class AppSyncUnauthorizedError extends AppSyncResolverError {
  constructor() {
    super('Unauthorized', 'Unauthorized');
    this.name = 'AppSyncUnauthorizedError';
  }
}

let nowMs = Date.parse('2026-09-17T10:00:00.000Z');
let autoIdCounter = 0;

/** Pin the double's clock; every `util.time.now*` call reads it. */
export function setNow(iso: string): void {
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) {
    throw new Error(`appsync-utils-double.setNow: not an ISO-8601 timestamp: ${iso}`);
  }
  nowMs = parsed;
}

/** Restart `util.autoId()` at `auto-id-1`. */
export function resetAutoId(): void {
  autoIdCounter = 0;
}

function toDynamoDB(value: unknown): DynamoDBValue {
  if (value === null || value === undefined) {
    return { NULL: true };
  }
  if (typeof value === 'string') {
    return { S: value };
  }
  if (typeof value === 'number') {
    return { N: String(value) };
  }
  if (typeof value === 'boolean') {
    return { BOOL: value };
  }
  if (Array.isArray(value)) {
    return { L: value.map(toDynamoDB) };
  }
  if (typeof value === 'object') {
    return { M: toMapValues(value as Record<string, unknown>) };
  }
  throw new Error(`appsync-utils-double.toDynamoDB: unsupported value type ${typeof value}`);
}

function toMapValues(value: Record<string, unknown>): Record<string, DynamoDBValue> {
  const out: Record<string, DynamoDBValue> = {};
  for (const [key, item] of Object.entries(value)) {
    if (item !== undefined) {
      out[key] = toDynamoDB(item);
    }
  }
  return out;
}

export const util = {
  dynamodb: {
    toDynamoDB,
    toMapValues,
  },
  time: {
    nowISO8601(): string {
      return new Date(nowMs).toISOString();
    },
    nowEpochMilliSeconds(): number {
      return nowMs;
    },
    epochMilliSecondsToISO8601(milliseconds: number): string {
      return new Date(milliseconds).toISOString();
    },
    parseISO8601ToEpochMilliSeconds(timestamp: string): number {
      const parsed = Date.parse(timestamp);
      if (Number.isNaN(parsed)) {
        throw new AppSyncResolverError(
          `Unable to parse ISO-8601 timestamp: ${timestamp}`,
          'RuntimeError',
        );
      }
      return parsed;
    },
  },
  autoId(): string {
    autoIdCounter += 1;
    return `auto-id-${autoIdCounter}`;
  },
  error(message: string, errorType = 'UnknownError'): never {
    throw new AppSyncResolverError(message, errorType);
  },
  unauthorized(): never {
    throw new AppSyncUnauthorizedError();
  },
};
