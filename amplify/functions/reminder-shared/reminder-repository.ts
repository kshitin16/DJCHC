/**
 * reminder-unit (U7) — data access for the `Reminder` and `DeviceToken`
 * tables. A thin class over `DynamoDBDocumentClient` (injected, so tests pass
 * a fake that records each command), in the shape of the other Units'
 * repositories.
 *
 * R-04 (Critical, fixed at Code Generation): both tables are keyed on `id`,
 * so EVERY lookup by guest identity is a Query on `ownerIndex` — never a Scan
 * and never a mis-keyed `GetItem`. Every Query follows `LastEvaluatedKey`
 * until exhausted.
 *
 * `transitionReminder` is the one write the rule-bearing paths share: ONE
 * conditional `UpdateItem` whose condition `#status IN (:from…)` is the
 * whole guard. A `ConditionalCheckFailedException` is the EXPECTED "already
 * moved on" signal (BR7.10 idempotency for cancel / cascade-cancel /
 * auto-clear / fire) and maps to `{ applied: false }`; anything else
 * (throttling, IAM, network) is rethrown so the Lambda fails loudly.
 *
 * `upsertDeviceToken` realizes Register Device Token steps 3–4: idempotent
 * per `(ownerIdentityId, pushToken)` — the same token re-registered updates
 * `registeredAt`; a NEW token for an identity that already has a row rotates
 * that row in place (one DeviceToken per device identity, entities.md);
 * `remindersEnabled` is preserved on both paths and defaults to `true` only
 * when the row is first created (BR7.1 "on by default").
 */
import {
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
  type DynamoDBDocumentClient,
} from '@aws-sdk/lib-dynamodb';
import { DEVICE_TOKEN_OWNER_INDEX, REMINDER_OWNER_INDEX, REMINDER_POST_INDEX } from './constants';
import type {
  DevicePlatform,
  DeviceTokenRecord,
  ReminderRecord,
  ReminderStatus,
  TransitionResult,
} from './types';

/** The one method the repository needs — a real `DynamoDBDocumentClient` or a test fake. */
export type ReminderClientLike = Pick<DynamoDBDocumentClient, 'send'>;

/** What `createReminder` takes: the Contract 9 row minus the implicit `updatedAt`. */
export type NewReminder = Omit<ReminderRecord, 'updatedAt'>;

/** What the handlers depend on; `ReminderRepository` implements it, tests fake it. */
export interface ReminderRepositoryLike {
  createReminder(reminder: NewReminder): Promise<ReminderRecord>;
  getReminderById(id: string): Promise<ReminderRecord | undefined>;
  listRemindersByOwner(ownerIdentityId: string): Promise<ReminderRecord[]>;
  listRemindersByPost(postId: string): Promise<ReminderRecord[]>;
  transitionReminder(
    id: string,
    from: readonly ReminderStatus[],
    to: ReminderStatus,
    now: string,
    extra?: { snoozeFireAt?: string },
  ): Promise<TransitionResult>;
  getDeviceTokenByOwner(ownerIdentityId: string): Promise<DeviceTokenRecord | undefined>;
  upsertDeviceToken(
    ownerIdentityId: string,
    pushToken: string,
    platform: DevicePlatform,
    now: string,
    newId: () => string,
  ): Promise<DeviceTokenRecord>;
  setRemindersEnabled(id: string, enabled: boolean, now: string): Promise<DeviceTokenRecord>;
}

export interface ReminderRepositoryOptions {
  /** env `REMINDER_TABLE_NAME` */
  reminderTableName: string;
  /** env `DEVICE_TOKEN_TABLE_NAME`; optional for the Lambdas that never touch DeviceToken. */
  deviceTokenTableName?: string;
}

function isConditionalCheckFailure(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { name?: unknown }).name === 'ConditionalCheckFailedException'
  );
}

export class ReminderRepository implements ReminderRepositoryLike {
  private readonly reminderTableName: string;
  private readonly deviceTokenTableName: string | undefined;

  constructor(
    private readonly client: ReminderClientLike,
    options: ReminderRepositoryOptions,
  ) {
    if (!options.reminderTableName) {
      throw new Error(
        'ReminderRepository: reminderTableName is required (env REMINDER_TABLE_NAME)',
      );
    }
    this.reminderTableName = options.reminderTableName;
    this.deviceTokenTableName = options.deviceTokenTableName || undefined;
  }

  private deviceTable(): string {
    if (!this.deviceTokenTableName) {
      throw new Error(
        'ReminderRepository: deviceTokenTableName is required (env DEVICE_TOKEN_TABLE_NAME)',
      );
    }
    return this.deviceTokenTableName;
  }

  /** Every page of a Query, in index order. */
  private async queryAll<T>(input: ConstructorParameters<typeof QueryCommand>[0]): Promise<T[]> {
    const rows: T[] = [];
    let exclusiveStartKey: Record<string, unknown> | undefined;
    do {
      const page = await this.client.send(
        new QueryCommand({ ...input, ExclusiveStartKey: exclusiveStartKey }),
      );
      rows.push(...((page.Items ?? []) as T[]));
      exclusiveStartKey = page.LastEvaluatedKey;
    } while (exclusiveStartKey);
    return rows;
  }

  // --- Reminder ----------------------------------------------------------------

  /** BR7.1 backfill: one `PutItem`, conditioned on the id being new. */
  async createReminder(reminder: NewReminder): Promise<ReminderRecord> {
    const record: ReminderRecord = { ...reminder, updatedAt: reminder.createdAt };
    await this.client.send(
      new PutCommand({
        TableName: this.reminderTableName,
        Item: { ...record, __typename: 'Reminder' },
        ConditionExpression: 'attribute_not_exists(id)',
      }),
    );
    return record;
  }

  async getReminderById(id: string): Promise<ReminderRecord | undefined> {
    const result = await this.client.send(
      new GetCommand({ TableName: this.reminderTableName, Key: { id } }),
    );
    return result.Item as ReminderRecord | undefined;
  }

  /** `myReminders`: Query on `ownerIndex` (R-04), every page, by `initialFireAt`. */
  async listRemindersByOwner(ownerIdentityId: string): Promise<ReminderRecord[]> {
    return this.queryAll<ReminderRecord>({
      TableName: this.reminderTableName,
      IndexName: REMINDER_OWNER_INDEX,
      KeyConditionExpression: '#owner = :owner',
      ExpressionAttributeNames: { '#owner': 'ownerIdentityId' },
      ExpressionAttributeValues: { ':owner': ownerIdentityId },
    });
  }

  /** Contract 8 cascade (BR7.9): Query on `postIdIndex`, every page. */
  async listRemindersByPost(postId: string): Promise<ReminderRecord[]> {
    return this.queryAll<ReminderRecord>({
      TableName: this.reminderTableName,
      IndexName: REMINDER_POST_INDEX,
      KeyConditionExpression: '#postId = :postId',
      ExpressionAttributeNames: { '#postId': 'postId' },
      ExpressionAttributeValues: { ':postId': postId },
    });
  }

  /**
   * The atomic status transition described in the file header. `extra.snoozeFireAt`
   * is written on the SNOOZED transition (BR7.3); on every other transition
   * `snoozeFireAt` is REMOVED so it is set iff the status is SNOOZED (entities.md).
   */
  async transitionReminder(
    id: string,
    from: readonly ReminderStatus[],
    to: ReminderStatus,
    now: string,
    extra?: { snoozeFireAt?: string },
  ): Promise<TransitionResult> {
    if (from.length === 0) throw new Error('transitionReminder: `from` must not be empty');
    const fromNames = from.map((_, i) => `:from${i}`);
    const values: Record<string, unknown> = { ':to': to, ':now': now };
    from.forEach((status, i) => (values[`:from${i}`] = status));
    let update = 'SET #status = :to, #updatedAt = :now';
    const names: Record<string, string> = {
      '#status': 'status',
      '#updatedAt': 'updatedAt',
      '#snoozeFireAt': 'snoozeFireAt',
    };
    if (extra?.snoozeFireAt) {
      update += ', #snoozeFireAt = :snoozeFireAt';
      values[':snoozeFireAt'] = extra.snoozeFireAt;
    } else {
      update += ' REMOVE #snoozeFireAt';
    }
    try {
      const result = await this.client.send(
        new UpdateCommand({
          TableName: this.reminderTableName,
          Key: { id },
          UpdateExpression: update,
          ConditionExpression: `attribute_exists(id) AND #status IN (${fromNames.join(', ')})`,
          ExpressionAttributeNames: names,
          ExpressionAttributeValues: values,
          ReturnValues: 'ALL_NEW',
        }),
      );
      return { applied: true, reminder: result.Attributes as ReminderRecord | undefined };
    } catch (error) {
      if (isConditionalCheckFailure(error)) return { applied: false };
      throw error;
    }
  }

  // --- DeviceToken --------------------------------------------------------------

  /** Query on `DeviceToken.ownerIndex` (R-04); the most recently registered row wins. */
  async getDeviceTokenByOwner(ownerIdentityId: string): Promise<DeviceTokenRecord | undefined> {
    const rows = await this.queryAll<DeviceTokenRecord>({
      TableName: this.deviceTable(),
      IndexName: DEVICE_TOKEN_OWNER_INDEX,
      KeyConditionExpression: '#owner = :owner',
      ExpressionAttributeNames: { '#owner': 'ownerIdentityId' },
      ExpressionAttributeValues: { ':owner': ownerIdentityId },
    });
    if (rows.length === 0) return undefined;
    return [...rows].sort((a, b) => b.registeredAt.localeCompare(a.registeredAt))[0];
  }

  /** Register Device Token steps 3–4 (see the file header). */
  async upsertDeviceToken(
    ownerIdentityId: string,
    pushToken: string,
    platform: DevicePlatform,
    now: string,
    newId: () => string,
  ): Promise<DeviceTokenRecord> {
    const existing = await this.getDeviceTokenByOwner(ownerIdentityId);
    if (existing) {
      const result = await this.client.send(
        new UpdateCommand({
          TableName: this.deviceTable(),
          Key: { id: existing.id },
          UpdateExpression:
            'SET #pushToken = :pushToken, #platform = :platform, #registeredAt = :now, #updatedAt = :now',
          ConditionExpression: 'attribute_exists(id)',
          ExpressionAttributeNames: {
            '#pushToken': 'pushToken',
            '#platform': 'platform',
            '#registeredAt': 'registeredAt',
            '#updatedAt': 'updatedAt',
          },
          ExpressionAttributeValues: {
            ':pushToken': pushToken,
            ':platform': platform,
            ':now': now,
          },
          ReturnValues: 'ALL_NEW',
        }),
      );
      return (
        (result.Attributes as DeviceTokenRecord | undefined) ?? {
          ...existing,
          pushToken,
          platform,
          registeredAt: now,
          updatedAt: now,
        }
      );
    }
    const record: DeviceTokenRecord = {
      id: newId(),
      ownerIdentityId,
      pushToken,
      platform,
      remindersEnabled: true, // BR7.1: on by default
      registeredAt: now,
      createdAt: now,
      updatedAt: now,
    };
    await this.client.send(
      new PutCommand({
        TableName: this.deviceTable(),
        Item: { ...record, __typename: 'DeviceToken' },
        ConditionExpression: 'attribute_not_exists(id)',
      }),
    );
    return record;
  }

  /** BR7.7: writes ONLY the toggle (and `updatedAt`); touches no Reminder. */
  async setRemindersEnabled(id: string, enabled: boolean, now: string): Promise<DeviceTokenRecord> {
    const result = await this.client.send(
      new UpdateCommand({
        TableName: this.deviceTable(),
        Key: { id },
        UpdateExpression: 'SET #remindersEnabled = :enabled, #updatedAt = :now',
        ConditionExpression: 'attribute_exists(id)',
        ExpressionAttributeNames: {
          '#remindersEnabled': 'remindersEnabled',
          '#updatedAt': 'updatedAt',
        },
        ExpressionAttributeValues: { ':enabled': enabled, ':now': now },
        ReturnValues: 'ALL_NEW',
      }),
    );
    return result.Attributes as DeviceTokenRecord;
  }
}
