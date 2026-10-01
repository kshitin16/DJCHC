/**
 * donation-unit (U4) — data access for the `Donation` table.
 *
 * A thin class over `DynamoDBDocumentClient` (injected, so tests pass a fake
 * that records each command). Every state transition is a CONDITIONAL write so
 * the table itself enforces the state machine in functional-spec.md, even when
 * two Lambdas race:
 *
 * - `markPending`     INITIATED → PENDING (aggregator checkout created)
 * - `applySettlement` INITIATED | PENDING → SUCCEEDED | FAILED, idempotent on
 *                     `payment_id` AND guarded on the row still being
 *                     non-terminal (security-design.md "Idempotent write
 *                     design", BR5.5, NFR5.2 — one atomic `UpdateItem`, never
 *                     read-then-write)
 * - `markCancelled`   SUCCEEDED + RECURRING → CANCELLED (BR5.6's state guard)
 *
 * `status` is a DynamoDB reserved word, so every expression addresses it
 * through the `#status` name alias — the same expression the security design
 * writes as `status`, spelled the way DynamoDB accepts it.
 *
 * Error handling (integration boundary): a `ConditionalCheckFailedException`
 * is the ONE expected failure and is mapped to a typed result/error; anything
 * else (throttling, IAM, network) is rethrown unchanged so the Lambda fails
 * loudly rather than guessing. No raw `ConditionalCheckFailedException` ever
 * escapes this class (revision 1, review F-5).
 *
 * Every Query paginates to exhaustion (revision 1, review F-4): DynamoDB caps
 * a page at 1 MB, so a single `Query` call silently returns a prefix of the
 * matching rows. `myDonations` would drop a long donation history and the
 * reconciler would leave stale PENDING rows unreconciled indefinitely.
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

/**
 * Statuses a settlement may still be written onto. FAILED, CANCELLED and
 * SUCCEEDED are terminal in functional-spec.md's state machine and must never
 * be rewritten (revision 1, review F-1).
 *
 * INITIATED is included deliberately: the aggregator's checkout page can be
 * paid — and its webhook delivered — before `markPending` has committed, and
 * the webhook looks the row up by `order_id` (= `Donation.id`), not by the
 * aggregator reference. Guarding on PENDING alone would drop a real payment.
 */
export const SETTLEABLE_STATUSES = ['INITIATED', 'PENDING'] as const;

export interface SettlementResult {
  /**
   * `false` when the conditional write was rejected — either this `paymentId`
   * was already processed for the donation (BR5.5 duplicate) or the row had
   * already reached a terminal status (F-1). A clean, logged no-op, never an
   * exception.
   */
  applied: boolean;
  /**
   * The row's `status` at the moment the write was rejected, when DynamoDB
   * returned the old item with the failed condition. Logging only.
   */
  currentStatus?: string;
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

/**
 * `ReturnValuesOnConditionCheckFailure: 'ALL_OLD'` makes DynamoDB attach the
 * row it refused to overwrite to the exception. The document client does not
 * unmarshall that item, so accept either the plain or the AttributeValue shape
 * and never let a surprise there turn a clean no-op into a crash.
 */
function rejectedStatus(error: unknown): string | undefined {
  const item = (error as { Item?: Record<string, unknown> } | null)?.Item;
  const value = item?.status;
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value !== null) {
    const wrapped = (value as { S?: unknown }).S;
    if (typeof wrapped === 'string') return wrapped;
  }
  return undefined;
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
    try {
      await this.client.send(
        new PutCommand({
          TableName: this.tableName,
          Item: { ...record, __typename: 'Donation' },
          ConditionExpression: 'attribute_not_exists(id)',
        }),
      );
    } catch (error) {
      // An id collision is the only way this condition fails; surface it as a
      // typed state error rather than a raw DynamoDB exception (F-5).
      if (isConditionalCheckFailure(error)) {
        throw new DonationStateError(`Donation ${record.id} already exists; not overwritten`);
      }
      throw error;
    }
    return record;
  }

  async getById(id: string): Promise<DonationRecord | undefined> {
    const result = await this.client.send(
      new GetCommand({ TableName: this.tableName, Key: { id } }),
    );
    return result.Item as DonationRecord | undefined;
  }

  /**
   * Run a Query to exhaustion, following `LastEvaluatedKey` (F-4). `build`
   * receives the key to resume from (`undefined` for the first page).
   */
  private async queryAllPages(
    build: (exclusiveStartKey?: Record<string, unknown>) => QueryCommand,
  ): Promise<DonationRecord[]> {
    const items: DonationRecord[] = [];
    let startKey: Record<string, unknown> | undefined;
    do {
      const result = await this.client.send(build(startKey));
      items.push(...((result.Items ?? []) as DonationRecord[]));
      startKey = result.LastEvaluatedKey as Record<string, unknown> | undefined;
    } while (startKey);
    return items;
  }

  /** `myDonations`: the caller's own rows via `donorIndex`, newest first, all pages. */
  async queryByDonor(donorGoogleId: string): Promise<DonationRecord[]> {
    return this.queryAllPages(
      (exclusiveStartKey) =>
        new QueryCommand({
          TableName: this.tableName,
          IndexName: DONATION_DONOR_INDEX,
          KeyConditionExpression: 'donorGoogleId = :donor',
          ExpressionAttributeValues: { ':donor': donorGoogleId },
          ScanIndexForward: false,
          ...(exclusiveStartKey ? { ExclusiveStartKey: exclusiveStartKey } : {}),
        }),
    );
  }

  /**
   * Reconciler (NFR5.1): rows in `status` created before `cutoffIso`, via
   * `statusIndex`, all pages. Kept generic over the status so the reconciler
   * can sweep stale INITIATED rows as well as PENDING ones (F-3).
   */
  async queryByStatusOlderThan(
    status: DonationStatus,
    cutoffIso: string,
  ): Promise<DonationRecord[]> {
    return this.queryAllPages(
      (exclusiveStartKey) =>
        new QueryCommand({
          TableName: this.tableName,
          IndexName: DONATION_STATUS_INDEX,
          KeyConditionExpression: '#status = :status AND createdAt < :cutoff',
          ExpressionAttributeNames: { '#status': 'status' },
          ExpressionAttributeValues: { ':status': status, ':cutoff': cutoffIso },
          ...(exclusiveStartKey ? { ExclusiveStartKey: exclusiveStartKey } : {}),
        }),
    );
  }

  /** Reconciler's main sweep: PENDING donations created before `cutoffIso`. */
  async queryPendingOlderThan(cutoffIso: string): Promise<DonationRecord[]> {
    return this.queryByStatusOlderThan('PENDING', cutoffIso);
  }

  /**
   * Reconciler's orphan sweep (F-3): rows still INITIATED long after checkout,
   * which `markPending` never managed to advance.
   */
  async queryInitiatedOlderThan(cutoffIso: string): Promise<DonationRecord[]> {
    return this.queryByStatusOlderThan('INITIATED', cutoffIso);
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
   * security-design.md "Idempotent write design" (BR5.5, NFR5.2): ONE atomic
   * conditional `UpdateItem` — SET status + processedPaymentId — never a
   * read-then-write.
   *
   * The condition has two halves:
   *
   * 1. **Idempotency** (security-design.md as approved): this `payment_id` has
   *    not already been processed for this donation, so a redelivered webhook
   *    is a no-op.
   * 2. **Terminal-state guard** (revision 1, review F-1): the row is still
   *    INITIATED or PENDING. Without it, any settlement carrying a *different*
   *    idempotency key could rewrite a terminal row — a reconciler tick whose
   *    synthetic `reconciled:<txn>` key never collides with the webhook's real
   *    `payment_id` could overwrite a SUCCEEDED webhook result with FAILED, and
   *    a late `payment.failed` for an earlier attempt could do the same. Both
   *    contradict functional-spec.md's state machine, in which SUCCEEDED,
   *    FAILED and CANCELLED are terminal, and project.md's firm rule that the
   *    aggregator's own record — not a stale read — decides the outcome.
   *
   * A rejected write is a clean, logged no-op: `{ applied: false }`, with the
   * refused row's status attached for the log when DynamoDB returns it. No
   * exception escapes (F-5). `aggregatorTransactionId` is deliberately NOT
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
            '(#status = :initiated OR #status = :pending) AND (attribute_not_exists(processedPaymentId) OR processedPaymentId <> :p)',
          ExpressionAttributeNames: { '#status': 'status' },
          ExpressionAttributeValues: {
            ':s': status,
            ':p': paymentId,
            ':now': this.now(),
            ':initiated': 'INITIATED',
            ':pending': 'PENDING',
          },
          ReturnValues: 'ALL_NEW',
          ReturnValuesOnConditionCheckFailure: 'ALL_OLD',
        }),
      );
      return { applied: true, donation: result.Attributes as DonationRecord };
    } catch (error) {
      if (isConditionalCheckFailure(error)) {
        const currentStatus = rejectedStatus(error);
        return { applied: false, ...(currentStatus ? { currentStatus } : {}) };
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
