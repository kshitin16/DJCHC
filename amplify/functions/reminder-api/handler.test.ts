/**
 * reminder-unit — tests for the `reminder-api` resolver with recording fakes
 * (repository, schedules, feed client). Identity comes from
 * `event.identity.cognitoIdentityId` only; ordering (ownership first,
 * transition then schedule, both deletes) is asserted on the recorded calls.
 */
import {
  AFTER_CUTOFF,
  BEFORE_CUTOFF,
  EVENT_DATE_TIME,
  FIRE_AT,
  FakeFeedClient,
  FakeReminderRepository,
  FakeSchedules,
  IDENTITY_A,
  IDENTITY_B,
  SNOOZE_AT,
  aDeviceToken,
  aReminder,
  anEventPost,
} from '../reminder-shared/test-fakes';
import type { ReminderRecord } from '../reminder-shared/types';
import { callerIdentityId, createHandler, type ReminderApiEvent } from './handler';

const targets = { deliverPushArn: 'arn:deliver-push', autoClearArn: 'arn:auto-clear' };
const NOW = '2026-09-25T06:00:00.000Z';

function guestCtx(
  fieldName: string,
  identityId: string | undefined,
  args: Record<string, unknown> = {},
): ReminderApiEvent {
  return {
    arguments: args,
    identity: identityId
      ? {
          accountId: '1',
          cognitoIdentityPoolId: 'pool',
          cognitoIdentityId: identityId,
          sourceIp: [],
          username: 'unauth',
          userArn: 'arn',
          cognitoIdentityAuthType: 'unauthenticated',
          cognitoIdentityAuthProvider: 'cognito-identity.amazonaws.com',
        }
      : null,
    info: { fieldName },
  } as unknown as ReminderApiEvent;
}

function build(
  reminders: ReminderRecord[] = [],
  devices = [aDeviceToken()],
  posts = [anEventPost()],
  now = NOW,
) {
  const repository = new FakeReminderRepository(reminders, devices);
  const schedules = new FakeSchedules();
  const feed = new FakeFeedClient(posts);
  let counter = 0;
  const handler = createHandler({
    repository,
    schedules,
    feed,
    targets,
    now: () => now,
    newId: () => `new-${++counter}`,
  });
  return { repository, schedules, feed, handler };
}

describe('reminder-unit: reminder-api handler', () => {
  it('reads the caller ONLY from event.identity.cognitoIdentityId and refuses an event without one (BR7.6)', async () => {
    const { handler } = build();
    await expect(handler(guestCtx('myReminders', undefined))).rejects.toMatchObject({
      name: 'ReminderAuthorizationError',
    });
    // A User-Pool-shaped identity (sub only) is not a guest identity; an argument never is.
    const userPoolOnly = {
      ...guestCtx('myReminders', undefined),
      identity: { sub: 'user-sub', groups: [] },
      arguments: { ownerIdentityId: IDENTITY_A },
    } as unknown as ReminderApiEvent;
    expect(callerIdentityId(userPoolOnly)).toBeUndefined();
    await expect(handler(userPoolOnly)).rejects.toMatchObject({
      name: 'ReminderAuthorizationError',
    });
    expect(callerIdentityId(guestCtx('myReminders', IDENTITY_A))).toBe(IDENTITY_A);
    await expect(handler(guestCtx('nope', IDENTITY_A))).rejects.toThrow('unsupported operation');
  });

  it('registerDeviceToken upserts idempotently per identity: a second call updates registeredAt instead of creating a row', async () => {
    const { handler, repository } = build([], []);
    const first = await handler(
      guestCtx('registerDeviceToken', IDENTITY_A, { pushToken: 'tok', platform: 'IOS' }),
    );
    expect(first).toMatchObject({
      id: 'new-1',
      pushToken: 'tok',
      platform: 'IOS',
      remindersEnabled: true,
    });
    const second = await handler(
      guestCtx('registerDeviceToken', IDENTITY_A, { pushToken: 'tok', platform: 'IOS' }),
    );
    expect(second).toMatchObject({ id: 'new-1', registeredAt: NOW });
    expect(repository.devices.size).toBe(1);
    await expect(
      handler(guestCtx('registerDeviceToken', IDENTITY_A, { pushToken: '', platform: 'IOS' })),
    ).rejects.toMatchObject({ name: 'ReminderValidationError' });
    await expect(
      handler(guestCtx('registerDeviceToken', IDENTITY_A, { pushToken: 'tok', platform: 'WEB' })),
    ).rejects.toMatchObject({ name: 'ReminderValidationError' });
  });

  it('setRemindersEnabled writes the toggle and touches NO Reminder (BR7.7); refuses a never-registered device', async () => {
    const { handler, repository } = build([aReminder()]);
    const result = await handler(guestCtx('setRemindersEnabled', IDENTITY_A, { enabled: false }));
    expect(result).toMatchObject({ id: 'dev-1', remindersEnabled: false });
    expect(repository.ops()).toEqual(['getDeviceTokenByOwner', 'setRemindersEnabled']);
    expect(repository.reminders.get('rem-1')?.status).toBe('SCHEDULED');
    await expect(
      handler(guestCtx('setRemindersEnabled', IDENTITY_B, { enabled: true })),
    ).rejects.toMatchObject({ name: 'ReminderNotFoundError' });
    await expect(
      handler(guestCtx('setRemindersEnabled', IDENTITY_A, { enabled: 'yes' })),
    ).rejects.toMatchObject({ name: 'ReminderValidationError' });
  });

  it('myReminders backfills only EVENT posts that have not passed, creating BOTH schedules with the right times and targets', async () => {
    const posts = [
      anEventPost({ id: 'post-1' }),
      anEventPost({ id: 'post-vip', type: 'VISITING_DIGNITARY' }),
      anEventPost({ id: 'post-past', dateTime: '2026-09-01T04:30:00.000Z' }),
    ];
    const { handler, repository, schedules } = build([], [aDeviceToken()], posts);
    const result = (await handler(guestCtx('myReminders', IDENTITY_A))) as ReminderRecord[];
    expect(result.map((r) => r.postId)).toEqual(['post-1']);
    expect(result[0]).toMatchObject({
      id: 'new-1',
      ownerIdentityId: IDENTITY_A,
      status: 'SCHEDULED',
      initialFireAt: FIRE_AT,
      createdAt: NOW,
    });
    expect(repository.ops()).toEqual([
      'listRemindersByOwner',
      'getDeviceTokenByOwner',
      'createReminder',
    ]);
    expect(schedules.calls).toEqual([
      {
        op: 'createOneTime',
        args: [
          'fire-new-1',
          FIRE_AT,
          'arn:deliver-push',
          { reminderId: 'new-1', postId: 'post-1' },
        ],
      },
      {
        op: 'createOneTime',
        args: [
          'clear-new-1',
          EVENT_DATE_TIME,
          'arn:auto-clear',
          { reminderId: 'new-1', postId: 'post-1' },
        ],
      },
    ]);
  });

  it('myReminders backfills only when needsBackfill (BR7.1 widened): an exact match is skipped, a stale-date Reminder gets an ADDITIONAL one', async () => {
    const exact = aReminder({ id: 'rem-exact', postId: 'post-1', initialFireAt: FIRE_AT });
    const stale = aReminder({
      id: 'rem-stale',
      postId: 'post-2',
      initialFireAt: '2026-09-28T03:30:00.000Z',
      status: 'CLEARED',
    });
    const posts = [anEventPost({ id: 'post-1' }), anEventPost({ id: 'post-2' })];
    const { handler, repository } = build([exact, stale], [aDeviceToken()], posts);
    const result = (await handler(guestCtx('myReminders', IDENTITY_A))) as ReminderRecord[];
    expect(result.map((r) => r.id).sort()).toEqual(['new-1', 'rem-exact', 'rem-stale']);
    expect(repository.reminders.get('rem-stale')?.status).toBe('CLEARED'); // untouched (BR7.8)
    expect(repository.calls.filter((c) => c.op === 'createReminder')).toHaveLength(1);
    expect(repository.reminders.get('new-1')).toMatchObject({
      postId: 'post-2',
      initialFireAt: FIRE_AT,
    });
  });

  it('myReminders creates nothing when remindersEnabled is false or no DeviceToken exists, and returns existing rows only', async () => {
    const existing = aReminder({
      id: 'rem-old',
      postId: 'post-9',
      status: 'SNOOZED',
      snoozeFireAt: SNOOZE_AT,
    });
    const off = build([existing], [aDeviceToken({ remindersEnabled: false })]);
    expect(await off.handler(guestCtx('myReminders', IDENTITY_A))).toEqual([existing]);
    expect(off.schedules.calls).toEqual([]);
    const unregistered = build([existing], []);
    expect(await unregistered.handler(guestCtx('myReminders', IDENTITY_A))).toEqual([existing]);
    expect(unregistered.repository.ops()).not.toContain('createReminder');
    // Another identity's rows are never returned.
    expect(
      await build([aReminder({ ownerIdentityId: IDENTITY_B })], []).handler(
        guestCtx('myReminders', IDENTITY_A),
      ),
    ).toEqual([]);
  });

  it('myReminders returns the existing rows without backfill when listPosts fails; a schedule failure after the write is surfaced', async () => {
    const existing = aReminder();
    const repository = new FakeReminderRepository([existing], [aDeviceToken()]);
    const schedules = new FakeSchedules();
    const handler = createHandler({
      repository,
      schedules,
      feed: new FakeFeedClient([], new Error('appsync down')),
      targets,
      now: () => NOW,
    });
    expect(await handler(guestCtx('myReminders', IDENTITY_A))).toEqual([existing]);
    expect(repository.ops()).toEqual(['listRemindersByOwner']);

    const failing = build();
    failing.schedules.failOn.createOneTime = new Error('scheduler down');
    await expect(failing.handler(guestCtx('myReminders', IDENTITY_A))).rejects.toThrow(
      'scheduler down',
    );
    expect(failing.repository.reminders.size).toBe(1); // the row stays; next sync will not duplicate it
  });

  it('snoozeReminder refuses a non-owner BEFORE anything else — even for an already-SNOOZED Reminder (BR7.3 R-01)', async () => {
    const { handler, repository, schedules } = build([
      aReminder({ status: 'SNOOZED', snoozeFireAt: SNOOZE_AT }),
    ]);
    await expect(
      handler(guestCtx('snoozeReminder', IDENTITY_B, { id: 'rem-1' })),
    ).rejects.toMatchObject({
      name: 'ReminderOwnershipError',
    });
    expect(repository.ops()).toEqual(['getReminderById']);
    expect(schedules.calls).toEqual([]);
    await expect(
      handler(guestCtx('snoozeReminder', IDENTITY_A, { id: 'missing' })),
    ).rejects.toMatchObject({
      name: 'ReminderNotFoundError',
    });
    await expect(handler(guestCtx('snoozeReminder', IDENTITY_A, {}))).rejects.toMatchObject({
      name: 'ReminderValidationError',
    });
  });

  it('snoozeReminder on an already-SNOOZED Reminder re-issues updateTime and returns it unchanged (BR7.3 R-04)', async () => {
    const snoozed = aReminder({ status: 'SNOOZED', snoozeFireAt: SNOOZE_AT });
    const { handler, repository, schedules } = build(
      [snoozed],
      [aDeviceToken()],
      [],
      BEFORE_CUTOFF,
    );
    expect(await handler(guestCtx('snoozeReminder', IDENTITY_A, { id: 'rem-1' }))).toEqual(snoozed);
    expect(repository.ops()).toEqual(['getReminderById']);
    expect(schedules.calls).toEqual([
      {
        op: 'updateTime',
        args: [
          'fire-rem-1',
          SNOOZE_AT,
          'arn:deliver-push',
          { reminderId: 'rem-1', postId: 'post-1' },
        ],
      },
    ]);
  });

  it('snoozeReminder on a SCHEDULED Reminder before 21:00 IST transitions to SNOOZED with snoozeFireAt, THEN updates the fire schedule', async () => {
    const { handler, repository, schedules } = build(
      [aReminder()],
      [aDeviceToken()],
      [],
      BEFORE_CUTOFF,
    );
    const result = await handler(guestCtx('snoozeReminder', IDENTITY_A, { id: 'rem-1' }));
    expect(result).toMatchObject({
      id: 'rem-1',
      status: 'SNOOZED',
      snoozeFireAt: SNOOZE_AT,
      updatedAt: BEFORE_CUTOFF,
    });
    expect(repository.calls[1]).toEqual({
      op: 'transitionReminder',
      args: ['rem-1', ['SCHEDULED'], 'SNOOZED', BEFORE_CUTOFF, { snoozeFireAt: SNOOZE_AT }],
    });
    expect(schedules.calls).toEqual([
      {
        op: 'updateTime',
        args: [
          'fire-rem-1',
          SNOOZE_AT,
          'arn:deliver-push',
          { reminderId: 'rem-1', postId: 'post-1' },
        ],
      },
    ]);
    // A concurrent status change between read and write: no schedule call, current row returned.
    const raced = build([aReminder({ id: 'rem-2' })], [aDeviceToken()], [], BEFORE_CUTOFF);
    raced.repository.forceConditionFailureFor = 'rem-2';
    expect(
      await raced.handler(guestCtx('snoozeReminder', IDENTITY_A, { id: 'rem-2' })),
    ).toMatchObject({ status: 'SCHEDULED' });
    expect(raced.schedules.calls).toEqual([]);
  });

  it('snoozeReminder on a SCHEDULED Reminder past 21:00 IST is refused with a plain-language message and no writes', async () => {
    const { handler, repository, schedules } = build(
      [aReminder()],
      [aDeviceToken()],
      [],
      AFTER_CUTOFF,
    );
    await expect(
      handler(guestCtx('snoozeReminder', IDENTITY_A, { id: 'rem-1' })),
    ).rejects.toMatchObject({
      name: 'SnoozeCutoffPassedError',
      message: expect.stringMatching(/9 PM/),
    });
    expect(repository.ops()).toEqual(['getReminderById']);
    expect(schedules.calls).toEqual([]);
  });

  it('snoozeReminder on a terminal Reminder returns it unchanged with NO Scheduler call (BR7.3 R-02/R-03)', async () => {
    for (const status of ['FIRED', 'CLEARED', 'CANCELLED'] as const) {
      const terminal = aReminder({ status });
      const { handler, repository, schedules } = build(
        [terminal],
        [aDeviceToken()],
        [],
        BEFORE_CUTOFF,
      );
      expect(await handler(guestCtx('snoozeReminder', IDENTITY_A, { id: 'rem-1' }))).toEqual(
        terminal,
      );
      expect(repository.ops()).toEqual(['getReminderById']);
      expect(schedules.calls).toEqual([]);
    }
  });

  it('cancelReminder refuses a non-owner first (BR7.5); SCHEDULED → CANCELLED then BOTH schedules deleted', async () => {
    const { handler, repository, schedules } = build([
      aReminder({ status: 'SNOOZED', snoozeFireAt: SNOOZE_AT }),
    ]);
    await expect(
      handler(guestCtx('cancelReminder', IDENTITY_B, { id: 'rem-1' })),
    ).rejects.toMatchObject({
      name: 'ReminderOwnershipError',
    });
    expect(schedules.calls).toEqual([]);

    const result = await handler(guestCtx('cancelReminder', IDENTITY_A, { id: 'rem-1' }));
    expect(result).toMatchObject({ id: 'rem-1', status: 'CANCELLED', updatedAt: NOW });
    expect(result).not.toHaveProperty('snoozeFireAt');
    expect(repository.calls.slice(-1)[0]).toEqual({
      op: 'transitionReminder',
      args: ['rem-1', ['SCHEDULED', 'SNOOZED'], 'CANCELLED', NOW, undefined],
    });
    expect(schedules.calls).toEqual([
      { op: 'delete', args: ['fire-rem-1', { reminderId: 'rem-1', postId: 'post-1' }] },
      { op: 'delete', args: ['clear-rem-1', { reminderId: 'rem-1', postId: 'post-1' }] },
    ]);
  });

  it('cancelReminder on an already-terminal Reminder performs no transition but STILL issues both deletes (BR7.10)', async () => {
    const fired = aReminder({ status: 'FIRED' });
    const { handler, repository, schedules } = build([fired]);
    expect(await handler(guestCtx('cancelReminder', IDENTITY_A, { id: 'rem-1' }))).toEqual(fired);
    expect(repository.ops()).toEqual(['getReminderById']);
    expect(schedules.ops()).toEqual(['delete', 'delete']);
    // Raced: read SCHEDULED, condition fails → current row returned, deletes still issued.
    const raced = build([aReminder({ id: 'rem-2' })]);
    raced.repository.forceConditionFailureFor = 'rem-2';
    await raced.handler(guestCtx('cancelReminder', IDENTITY_A, { id: 'rem-2' }));
    expect(raced.schedules.ops()).toEqual(['delete', 'delete']);
    await expect(
      handler(guestCtx('cancelReminder', IDENTITY_A, { id: 'nope' })),
    ).rejects.toMatchObject({
      name: 'ReminderNotFoundError',
    });
  });
});
