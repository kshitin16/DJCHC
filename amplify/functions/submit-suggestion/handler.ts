/**
 * suggestion-unit (U3) — AppSync Lambda resolver for Contract 4's
 * `submitSuggestion(text: String!): Suggestion!`.
 *
 * Rules realized: BR3.1 (300 words), BR3.2 (identity from the verified JWT
 * only — no anonymous submission), BR3.5 (5 per IST day, atomic),
 * NFR-RATE.1 (counter TTL), NFR-OBS.1 (`suggestion-count` metric),
 * NFR-OBS.2 (structured log lines for submits, cap hits and word-limit
 * refusals — never including the text).
 *
 * ## Who enforces what (project.md Correction: never leave implicit)
 *
 * - AppSync (declarative, server-side — THE enforcing layer for BR3.2): the
 *   operation carries `allow.authenticated()` in `amplify/data/resource.ts`,
 *   so a caller without a Cognito User Pool JWT never reaches this code.
 * - This handler (BACKSTOP for BR3.2; ENFORCING layer for BR3.1 and BR3.5):
 *   the caller's `sub` is read ONLY from `event.identity`, which AppSync
 *   fills from the verified JWT — never from arguments or headers — and an
 *   event without one is refused. The word limit and the daily cap have no
 *   declarative equivalent, so this code is where they are enforced.
 * - Flutter screens (flutter-app-unit): UX convenience only.
 *
 * ## Ordering (functional-spec.md, Submit Suggestion) and the accepted trade-off
 *
 * validate (BR3.1) → atomic counter increment (BR3.5) → create → metric.
 * A submission whose `Suggestion` write fails AFTER the counter incremented
 * still consumes one of the day's five; the reverse (a saved suggestion that
 * was never counted) is impossible. Accepted and recorded in the plan's known
 * deviations. The metric is best-effort and runs after the record is saved.
 */
import type { AppSyncResolverEvent } from 'aws-lambda';
import { CloudWatchClient } from '@aws-sdk/client-cloudwatch';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { createLogger, describeError, silentLogger, type Logger } from '../donation-shared/logging';
import { DailyLimitExceededError, SuggestionAuthorizationError } from '../suggestion-shared/errors';
import { SuggestionMetrics, type SuggestionMetricsLike } from '../suggestion-shared/metrics';
import {
  istDateOf,
  istMidnightPlus48hEpochSeconds,
  validateText,
} from '../suggestion-shared/rules';
import {
  SuggestionRepository,
  type SuggestionRepositoryLike,
} from '../suggestion-shared/suggestion-repository';
import {
  SUGGESTION_DAILY_COUNT_TABLE_ENV,
  SUGGESTION_TABLE_ENV,
  type SuggestionRecord,
} from '../suggestion-shared/types';

export interface SubmitSuggestionDeps {
  repository: SuggestionRepositoryLike;
  metrics: SuggestionMetricsLike;
  /** Injected clock so tests use fixed timestamps. */
  now?: () => string;
  /** Injected id generator so tests use fixed ids. */
  newId?: () => string;
  logger?: Logger;
}

export interface SubmitSuggestionArguments {
  text?: unknown;
}

export type SubmitSuggestionEvent = AppSyncResolverEvent<SubmitSuggestionArguments>;

/** BR3.2: the caller's `sub` from AppSync's verified identity, or undefined. */
export function callerSub(event: SubmitSuggestionEvent): string | undefined {
  const identity = event.identity as { sub?: unknown } | null | undefined;
  if (!identity || typeof identity.sub !== 'string' || identity.sub.length === 0) {
    return undefined;
  }
  return identity.sub;
}

/**
 * Builds the resolver from injected dependencies (real clients in
 * `handler`, fakes in tests).
 */
export function createHandler(deps: SubmitSuggestionDeps) {
  const now = deps.now ?? (() => new Date().toISOString());
  const newId = deps.newId ?? (() => crypto.randomUUID());
  const logger = deps.logger ?? silentLogger;

  return async (event: SubmitSuggestionEvent): Promise<SuggestionRecord> => {
    if (event.info.fieldName !== 'submitSuggestion') {
      throw new Error(`submit-suggestion: unsupported operation ${event.info.fieldName}`);
    }

    // BR3.2 (backstop): no verified identity, no submission.
    const sub = callerSub(event);
    if (!sub) throw new SuggestionAuthorizationError();

    // BR3.1: rejected before anything is written; the text is never logged.
    let text: string;
    try {
      text = validateText(event.arguments?.text);
    } catch (error) {
      logger.info('suggestion refused: text validation', { reason: (error as Error).message });
      throw error;
    }

    // BR3.5: ONE atomic conditional increment — the check and the count in a single request.
    const submittedAt = now();
    const istDate = istDateOf(submittedAt);
    const { allowed } = await deps.repository.tryIncrementDailyCount(
      sub,
      istDate,
      istMidnightPlus48hEpochSeconds(submittedAt),
    );
    if (!allowed) {
      logger.info('suggestion refused: daily cap reached', { istDate });
      throw new DailyLimitExceededError();
    }

    // Step 4: the record. `submittedByGoogleId` = `sub` exactly (owner rule, BR3.3).
    const suggestion = await deps.repository.create({
      id: newId(),
      submittedByGoogleId: sub,
      text,
      submittedAt,
    });
    logger.info('suggestion submitted', { id: suggestion.id, submittedAt });

    // NFR-OBS.1: best-effort. `SuggestionMetrics` already swallows its own
    // failures; this guard makes the record's success independent of ANY
    // emitter implementation — a saved suggestion is never reported as failed.
    try {
      await deps.metrics.emitSuggestionCount();
    } catch (error) {
      logger.warn('suggestion-count metric emission failed; submission unaffected', {
        error: describeError(error),
      });
    }
    return suggestion;
  };
}

// --- Lambda entry point: real clients, built lazily on first use ----------
let realDeps: SubmitSuggestionDeps | undefined;

function realDependencies(): SubmitSuggestionDeps {
  realDeps ??= {
    repository: new SuggestionRepository(DynamoDBDocumentClient.from(new DynamoDBClient({})), {
      tableName: process.env[SUGGESTION_TABLE_ENV] ?? '',
      dailyCountTableName: process.env[SUGGESTION_DAILY_COUNT_TABLE_ENV] ?? '',
    }),
    metrics: new SuggestionMetrics(new CloudWatchClient({})),
    logger: createLogger('submit-suggestion'),
  };
  return realDeps;
}

export const handler = async (event: SubmitSuggestionEvent): Promise<SuggestionRecord> =>
  createHandler(realDependencies())(event);
