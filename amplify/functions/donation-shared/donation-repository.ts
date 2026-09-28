/**
 * donation-unit (U4) — data access for the `Donation` table.
 *
 * A thin class over `DynamoDBDocumentClient` (injected, so tests pass a fake
 * that records each command). Every state transition is a CONDITIONAL write so
 * the table itself enforces the state machine in functional-spec.md, even when
 * two Lambdas race:
 *
 * - `markPending`     INITIATED → PENDING (aggregator checkout created)
 * - `applySettlement` PENDING → SUCCEEDED | FAILED, idempotent on `payment_id`
 *                     (security-design.md "Idempotent write design", BR5.5,
 *                     NFR5.2 — one atomic `UpdateItem`, never read-then-write)
 * - `markCancelled`   SUCCEEDED + RECURRING → CANCELLED (BR5.6's state guard)
 *
 * `status` is a DynamoDB reserved word, so every expression addresses it
 * through the `#status` name alias — the same expression the security design
 * writes as `status`, spelled the way DynamoDB accepts it.
 *
 * Error handling (integration boundary): a `ConditionalCheckFailedException`
 * is the ONE expected failure and is mapped to a typed result/error; anything
 * else (throttling, IAM, network) is rethrown unchanged so the Lambda fails
 * loudly rather than guessing.
 */
import {
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
  type DynamoDBDocumentClient,
} from '@aws-sdk/lib-dynamodb';
import { DonationStateError } from './errors';
import {
  DONATION_DONOR_INDEX,
  DONATION_STATUS_INDEX,
  type DonationFrequency,
  type DonationRecord,
  type DonationStatus,
  type DonationType,
} from './types';

/** The one method the repository needs — satisfied by a real `DynamoDBDocumentClient` or a test fake. */
export type DocumentClientLike = Pick<DynamoDBDocumentClient, 'send'>;

export interface CreateDonationInput {
  donorGoogleId: string;
  amount: number;
  donationType: DonationType;
  frequency?: DonationFrequency;
}

/** Terminal settlement outcomes the webhook / reconciler may apply. */
export type SettlementStatus = Extract<DonationStatus, 'SUCCEEDED' | 'FAILED'>;

export interface SettlementResult {
  /** `false` when this `paymentId` was already processed for the donation (BR5.5 duplicate). */
  applied: boolean;
  donation?: DonationRecord;
}

export interface DonationRepositoryOptions {
  tableName: string;
  /** Injected clock so tests use fixed timestamps. */
  now?: () => string;
  /** Injected id generator so tests use fixed ids. */
  newId?: () => string;
}

function isConditionalCheckFailure(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { name?: unknown }).name === 'ConditionalCheckFailedException'
  );
}

export class DonationRepository {
  private readonly tableName: string;
  private readonly now: () => string;
  private readonly newId: () => string;

  constructor(
    private readonly client: DocumentClientLike,
    options: DonationRepositoryOptions,
  ) {
    if (!options.tableName) {
      throw new Error('DonationRepository: tableName is required (env DONATION_TABLE_NAME)');
    }
    this.tableName = options.tableName;
    this.now = options.now ?? (() => new Date().toISOString());
    this.newId = options.newId ?? (() => crypto.randomUUID());
  }

  /** Functional-spec step 3: a new Donation is born INITIATED, never overwriting an existing id. */
  async create(input: CreateDonationInput): Promise<DonationRecord> {
    const timestamp = this.now();
    const record: DonationRecord = {
      id: this.newId(),
      donorGoogleId: input.donorGoogleId,
      amount: input.amount,
      donationType: input.donationType,
      ...(input.frequency ? { frequency: input.frequency } : {}),
      status: 'INITIATED',
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await this.client.send(
      new PutCommand({
        TableName: this.tableName,
        Item: { ...record, __typename: 'Donation' },
        ConditionExpression: 'attribute_not_exists(id)',
      }),
    );
    return record;
  }

  async getById(id: string): Promise<DonationRecord | undefined> {
    const result = await this.client.send(
      new GetCommand({ TableName: this.tableName, Key: { id } }),
    );
    return result.Item as DonationRecord | undefined;
  }

  /** `myDonations`: the caller's own rows via `donorIndex`, newest first. */
  async queryByDonor(donorGoogleId: string): Promise<DonationRecord[]> {
    const result = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: DONATION_DONOR_INDEX,
        KeyConditionExpression: 'donorGoogleId = :donor',
        ExpressionAttributeValues: { ':donor': donorGoogleId },
        ScanIndexForward: false,
      }),
    );
    return (result.Items ?? []) as DonationRecord[];
  }

  /** Reconciler (NFR5.1): PENDING donations created before `cutoffIso`, via `statusIndex`. */
  async queryPendingOlderThan(cutoffIso: string): Promise<DonationRecord[]> {
    const result = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: DONATION_STATUS_INDEX,
        KeyConditionExpression: '#status = :pending AND createdAt < :cutoff',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: { ':pending': 'PENDING', ':cutoff': cutoffIso },
      }),
    );
    return (result.Items ?? []) as DonationRecord[];
  }

  /** Functional-spec step 5: INITIATED → PENDING once the aggregator has issued a checkout reference. */
  async markPending(id: string, aggregatorTransactionId: string): Promise<DonationRecord> {
    try {
      const result = await this.client.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: { id },
          UpdateExpression:
            'SET #status = :pending, aggregatorTransactionId = :txn, updatedAt = :now',
          ConditionExpression: '#status = :initiated',
          ExpressionAttributeNames: { '#status': 'status' },
          ExpressionAttributeValues: {
            ':pending': 'PENDING',
            ':initiated': 'INITIATED',
            ':txn': aggregatorTransactionId,
            ':now': this.now(),
          },
          ReturnValues: 'ALL_NEW',
        }),
      );
      return result.Attributes as DonationRecord;
    } catch (error) {
      if (isConditionalCheckFailure(error)) {
        throw new DonationStateError(`Donation ${id} is not INITIATED; cannot move it to PENDING`);
      }
      throw error;
    }
  }

  /**
   * security-design.md "Idempotent write design" (BR5.5, NFR5.2), verbatim in
   * intent: SET status + processedPaymentId, conditioned on this payment_id not
   * having been processed before. A duplicate delivery makes DynamoDB itself
   * fail the condition, which is returned as `{ applied: false }` — no second
   * state change, no error. `aggregatorTransactionId` is deliberately NOT
   * touched (review R-04: it is populated once, at checkout time).
   */
  async applySettlement(
    id: string,
    status: SettlementStatus,
    paymentId: string,
  ): Promise<SettlementResult> {
    try {
      const result = await this.client.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: { id },
          UpdateExpression: 'SET #status = :s, processedPaymentId = :p, updatedAt = :now',
          ConditionExpression:
            'attribute_not_exists(processedPaymentId) OR processedPaymentId <> :p',
          ExpressionAttributeNames: { '#status': 'status' },
          ExpressionAttributeValues: { ':s': status, ':p': paymentId, ':now': this.now() },
          ReturnValues: 'ALL_NEW',
        }),
      );
      return { applied: true, donation: result.Attributes as DonationRecord };
    } catch (error) {
      if (isConditionalCheckFailure(error)) {
        return { applied: false };
      }
      throw error;
    }
  }

  /**
   * Cancel Recurring Donation step 3 (BR5.6 state guard): only a SUCCEEDED
   * RECURRING mandate may become CANCELLED. The donor-identity half of BR5.6
   * is enforced by the `donation-api` handler against the verified JWT `sub`
   * BEFORE this is called; this condition is the atomic backstop.
   */
  async markCancelled(id: string, cancelledAt: string): Promise<DonationRecord> {
    try {
      const result = await this.client.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: { id },
          UpdateExpression: 'SET #status = :cancelled, cancelledAt = :at, updatedAt = :now',
          ConditionExpression: '#status = :succeeded AND donationType = :recurring',
          ExpressionAttributeNames: { '#status': 'status' },
          ExpressionAttributeValues: {
            ':cancelled': 'CANCELLED',
            ':succeeded': 'SUCCEEDED',
            ':recurring': 'RECURRING',
            ':at': cancelledAt,
            ':now': this.now(),
          },
          ReturnValues: 'ALL_NEW',
        }),
      );
      return result.Attributes as DonationRecord;
    } catch (error) {
      if (isConditionalCheckFailure(error)) {
        throw new DonationStateError(
          `Donation ${id} is not an active recurring donation; only a SUCCEEDED RECURRING donation can be cancelled`,
        );
      }
      throw error;
    }
  }
}
