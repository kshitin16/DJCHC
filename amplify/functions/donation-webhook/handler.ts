/**
 * donation-unit (U4) — Contract 7 webhook receiver (Payment Status
 * Reconciliation workflow, webhook path), invoked through a Lambda Function URL.
 *
 * Order of operations is the security design, verbatim:
 *   1. flag off → 404 (the endpoint does not exist yet as far as anyone knows)
 *   2. signature check FIRST (NFR3.1 / Contract 7 `aggregatorSignature`):
 *      an invalid or missing signature → 401 with NO table access
 *   3. shape validation of the JSON body (`parseWebhook`) → 400
 *   4. direct GetItem on `payload.order_id` (= `Donation.id`; review R-02 —
 *      never a lookup by `payment_id`) → 404 + log when absent, never guessed
 *   5. one atomic conditional UpdateItem (`applySettlement`, BR5.5/NFR5.2):
 *      200 whether the settlement was applied or this `payment_id` was a
 *      duplicate delivery
 *
 * Authentication note (project.md Correction — say which layer enforces it):
 * the Function URL itself is public (auth NONE, attached in `backend.ts`);
 * THIS HANDLER's HMAC check is the enforcing layer, exactly as every UPI
 * aggregator webhook integration works. Flagged deliberately: this endpoint
 * bypasses Cognito by design and is compensated by the signature check.
 *
 * Unexpected repository failures are returned as 500 so the aggregator
 * retries (its retries are safe because the write is idempotent).
 */
import type { APIGatewayProxyStructuredResultV2, LambdaFunctionURLEvent } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import {
  PlaceholderAggregatorAdapter,
  type AggregatorAdapter,
} from '../donation-shared/aggregator-adapter';
import { DonationRepository } from '../donation-shared/donation-repository';
import { isDonationsEnabled, type DonationEnv } from '../donation-shared/flag';
import { createLogger, describeError, type Logger } from '../donation-shared/logging';
import { parseWebhook, settlementForEvent } from '../donation-shared/reconciliation';

export const DEFAULT_SIGNATURE_HEADER = 'x-razorpay-signature';

export type DonationWebhookRepository = Pick<DonationRepository, 'getById' | 'applySettlement'>;

export interface DonationWebhookDeps {
  repository: DonationWebhookRepository;
  adapter: Pick<AggregatorAdapter, 'verifyWebhookSignature'>;
  env: DonationEnv;
  logger?: Logger;
}

/** Function URL responses share API Gateway v2's structured shape. */
export type WebhookResponse = APIGatewayProxyStructuredResultV2;

function respond(statusCode: number, body: Record<string, unknown>): WebhookResponse {
  return {
    statusCode,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  };
}

/** Function URL headers arrive lower-cased, but never rely on it. */
function header(event: LambdaFunctionURLEvent, name: string): string | undefined {
  const wanted = name.toLowerCase();
  for (const [key, value] of Object.entries(event.headers ?? {})) {
    if (key.toLowerCase() === wanted) return value;
  }
  return undefined;
}

/** The exact bytes the aggregator signed — decode base64 if the URL encoded them. */
function rawBody(event: LambdaFunctionURLEvent): string {
  const body = event.body ?? '';
  return event.isBase64Encoded ? Buffer.from(body, 'base64').toString('utf8') : body;
}

export function createHandler(deps: DonationWebhookDeps) {
  const logger = deps.logger ?? createLogger('donation-webhook');

  return async function handler(event: LambdaFunctionURLEvent): Promise<WebhookResponse> {
    if (!isDonationsEnabled(deps.env)) {
      return respond(404, { error: 'Not found' });
    }
    const method = event.requestContext?.http?.method?.toUpperCase();
    if (method && method !== 'POST') {
      return respond(405, { error: 'Method not allowed' });
    }

    // 2. Signature first — before parsing, before any table access.
    const secret = deps.env.DONATION_AGGREGATOR_WEBHOOK_SECRET;
    if (!secret) {
      // Configuration error, not the caller's fault: fail closed and say so in the log.
      logger.error('DONATION_AGGREGATOR_WEBHOOK_SECRET is not set; refusing webhook');
      return respond(500, { error: 'Webhook is not configured' });
    }
    const signatureHeader = deps.env.DONATION_WEBHOOK_SIGNATURE_HEADER || DEFAULT_SIGNATURE_HEADER;
    const body = rawBody(event);
    if (!deps.adapter.verifyWebhookSignature(body, header(event, signatureHeader) ?? '', secret)) {
      logger.warn('Webhook signature verification failed');
      return respond(401, { error: 'Invalid signature' });
    }

    // 3. Shape validation at the boundary.
    let parsed;
    try {
      parsed = parseWebhook(JSON.parse(body));
    } catch (error) {
      logger.warn('Webhook body rejected', describeError(error));
      return respond(400, { error: 'Invalid webhook body' });
    }

    try {
      // 4. Direct lookup by order_id = Donation.id.
      const donation = await deps.repository.getById(parsed.orderId);
      if (!donation) {
        logger.error('Webhook for unknown donation; not created, not guessed', {
          orderId: parsed.orderId,
          event: parsed.event,
        });
        return respond(404, { error: 'Unknown donation' });
      }

      // 5. Atomic, idempotent settlement.
      const status = settlementForEvent(parsed.event);
      const result = await deps.repository.applySettlement(donation.id, status, parsed.paymentId);
      logger.info(result.applied ? 'Settlement applied' : 'Duplicate webhook ignored', {
        donationId: donation.id,
        status,
        applied: result.applied,
      });
      return respond(200, { donationId: donation.id, status, applied: result.applied });
    } catch (error) {
      logger.error('Webhook processing failed; aggregator may retry', {
        orderId: parsed.orderId,
        ...describeError(error),
      });
      return respond(500, { error: 'Processing failed' });
    }
  };
}

// --- Lambda entry point ----------------------------------------------------
let realDeps: DonationWebhookDeps | undefined;

function realDependencies(): DonationWebhookDeps {
  realDeps ??= {
    repository: new DonationRepository(DynamoDBDocumentClient.from(new DynamoDBClient({})), {
      tableName: process.env.DONATION_TABLE_NAME ?? '',
    }),
    adapter: new PlaceholderAggregatorAdapter(),
    env: process.env,
  };
  return realDeps;
}

export const handler = async (event: LambdaFunctionURLEvent): Promise<WebhookResponse> => {
  if (!isDonationsEnabled(process.env)) {
    return respond(404, { error: 'Not found' });
  }
  return createHandler(realDependencies())(event);
};
