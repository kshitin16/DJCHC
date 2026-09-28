/**
 * suggestion-unit — `submit-suggestion` Lambda tests (BR3.1, BR3.2, BR3.5,
 * NFR-OBS.1) against fakes that record every call, so the
 * increment → create → metric ordering is assertable. No AWS.
 */
import type { AppSyncResolverEvent } from 'aws-lambda';
import { DailyLimitExceededError, SuggestionAuthorizationError } from '../suggestion-shared/errors';
import { SuggestionValidationError } from '../suggestion-shared/errors';
import type { SuggestionMetricsLike } from '../suggestion-shared/metrics';
import type { SuggestionRepositoryLike } from '../suggestion-shared/suggestion-repository';
import type { NewSuggestion, SuggestionRecord } from '../suggestion-shared/types';
import { createHandler, type SubmitSuggestionEvent } from './handler';

const NOW = '2026-09-19T18:29:59.000Z'; // still 2026-09-19 in IST (midnight is 18:30Z)
const ID = '11111111-1111-4111-8111-111111111111';
const NEXT_IST_MIDNIGHT = Date.parse('2026-09-19T18:30:00.000Z') / 1000;

function wordsOf(n: number): string {
  return Array.from({ length: n }, (_, i) => `w${i + 1}`).join(' ');
}

type Call = { op: string; args: unknown[] };

class FakeSuggestionRepository implements SuggestionRepositoryLike {
  calls: Call[] = [];
  allowed = true;
  createError: Error | undefined;
  async create(suggestion: NewSuggestion): Promise<SuggestionRecord> {
    this.calls.push({ op: 'create', args: [suggestion] });
    if (this.createError) throw this.createError;
    return { ...suggestion, createdAt: suggestion.submittedAt, updatedAt: suggestion.submittedAt };
  }
  async listAll(): Promise<SuggestionRecord[]> {
    this.calls.push({ op: 'listAll', args: [] });
    return [];
  }
  async tryIncrementDailyCount(sub: string, istDate: string, ttl: number) {
    this.calls.push({ op: 'increment', args: [sub, istDate, ttl] });
    return { allowed: this.allowed };
  }
}

class FakeMetrics implements SuggestionMetricsLike {
  constructor(private readonly calls: Call[]) {}
  shouldFail = false;
  async emitSuggestionCount(): Promise<void> {
    this.calls.push({ op: 'metric', args: [] });
    if (this.shouldFail) throw new Error('metric down');
  }
}

function event(
  text: unknown,
  identity: unknown = { sub: 'user-sub', groups: null },
  fieldName = 'submitSuggestion',
): SubmitSuggestionEvent {
  return {
    arguments: { text },
    identity,
    source: null,
    request: { headers: {}, domainName: null },
    info: {
      fieldName,
      parentTypeName: 'Mutation',
      variables: {},
      selectionSetList: [],
      selectionSetGraphQL: '',
    },
    prev: null,
    stash: {},
  } as unknown as AppSyncResolverEvent<{ text?: unknown }>;
}

function setup() {
  const repository = new FakeSuggestionRepository();
  const metrics = new FakeMetrics(repository.calls);
  const handler = createHandler({ repository, metrics, now: () => NOW, newId: () => ID });
  return { repository, metrics, handler, calls: repository.calls };
}

describe('suggestion-unit: submit-suggestion Lambda', () => {
  it('rejects text over 300 words BEFORE any write — no increment, no create, no metric (BR3.1)', async () => {
    const { handler, calls } = setup();
    await expect(handler(event(wordsOf(301)))).rejects.toBeInstanceOf(SuggestionValidationError);
    await expect(handler(event('   '))).rejects.toBeInstanceOf(SuggestionValidationError);
    expect(calls).toEqual([]);
  });

  it('refuses an event with no verified identity, and never reads the submitter from arguments (BR3.2 backstop)', async () => {
    const { handler, calls } = setup();
    await expect(handler(event('hello', null))).rejects.toBeInstanceOf(
      SuggestionAuthorizationError,
    );
    await expect(handler(event('hello', { sub: '' }))).rejects.toBeInstanceOf(
      SuggestionAuthorizationError,
    );
    await expect(
      handler(event('hello', { sub: 'a', groups: null }, 'somethingElse')),
    ).rejects.toThrow('unsupported operation');
    expect(calls).toEqual([]);
  });

  it('when the daily cap is reached: throws the plain-language DailyLimitExceededError and creates NO record (BR3.5)', async () => {
    const { handler, repository, calls } = setup();
    repository.allowed = false;

    const rejected = handler(event('Sixth idea of the day'));
    await expect(rejected).rejects.toBeInstanceOf(DailyLimitExceededError);
    await expect(rejected).rejects.toThrow(
      'You can submit up to 5 suggestions a day; try again after midnight IST',
    );
    expect(calls.map((c) => c.op)).toEqual(['increment']);
  });

  it('happy path: increments THEN creates, with submittedByGoogleId = identity.sub exactly and submittedAt = now, returning the Suggestion', async () => {
    const { handler, calls } = setup();

    const result = await handler(event('  Please add a shoe rack near the entrance.  '));

    expect(calls.map((c) => c.op)).toEqual(['increment', 'create', 'metric']);
    expect(calls[1].args[0]).toEqual({
      id: ID,
      submittedByGoogleId: 'user-sub', // no `::username` suffix — the owner rule matches on `sub`
      text: 'Please add a shoe rack near the entrance.',
      submittedAt: NOW,
    });
    expect(result).toEqual({
      id: ID,
      submittedByGoogleId: 'user-sub',
      text: 'Please add a shoe rack near the entrance.',
      submittedAt: NOW,
      createdAt: NOW,
      updatedAt: NOW,
    });
  });

  it('keys the counter on the IST date of now (not the UTC date) and passes the IST-midnight + 48h TTL (BR3.5, NFR-RATE.1)', async () => {
    const { handler, calls } = setup();
    await handler(event('An idea'));
    expect(calls[0]).toEqual({
      op: 'increment',
      args: ['user-sub', '2026-09-19', NEXT_IST_MIDNIGHT + 48 * 3600],
    });

    // One second later it is a new IST day: the key rolls over even though the UTC date has not.
    const later = createHandler({
      repository: new FakeSuggestionRepository(),
      metrics: new FakeMetrics([]),
      now: () => '2026-09-19T18:30:00.000Z',
      newId: () => ID,
    });
    const laterRepository = new FakeSuggestionRepository();
    const laterHandler = createHandler({
      repository: laterRepository,
      metrics: new FakeMetrics(laterRepository.calls),
      now: () => '2026-09-19T18:30:00.000Z',
      newId: () => ID,
    });
    await laterHandler(event('Another idea'));
    expect(laterRepository.calls[0].args[1]).toBe('2026-09-20');
    expect(later).toBeInstanceOf(Function);
  });

  it('emits the suggestion-count metric AFTER the record is created, and a metric failure does not fail the submission (NFR-OBS.1)', async () => {
    const { handler, metrics, calls } = setup();
    metrics.shouldFail = true;

    const result = await handler(event('Metric outage should not matter'));

    expect(result.id).toBe(ID);
    expect(calls.map((c) => c.op)).toEqual(['increment', 'create', 'metric']);
  });

  it('surfaces a repository error on create (the counter was already incremented — the accepted ordering) and emits no metric', async () => {
    const { handler, repository, calls } = setup();
    repository.createError = new Error('ProvisionedThroughputExceededException');

    await expect(handler(event('Will fail to save'))).rejects.toThrow(
      'ProvisionedThroughputExceededException',
    );
    expect(calls.map((c) => c.op)).toEqual(['increment', 'create']);
  });
});
