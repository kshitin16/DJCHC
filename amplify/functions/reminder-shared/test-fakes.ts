/**
 * reminder-unit — in-memory fakes shared by the four handler test files.
 * Every fake records its calls so ORDER is assertable (ownership before any
 * status branch; transition before schedule calls; both deletes). Not part
 * of the deployed bundle (no handler imports it); excluded from nothing —
 * it is exercised by every handler test.
 */
import type { FeedClient } from './feed-client';
import type { ReminderMetricsLike } from './metrics';
import type { PushNotification, PushSender } from './push-sender';
import type { NewReminder, ReminderRepositoryLike } from './reminder-repository';
import type { SchedulesLike } from './schedules-adapter';
import type {
  DevicePlatform,
  DeviceTokenRecord,
  FeedPost,
  ReminderRecord,
  ReminderStatus,
  SchedulePayload,
  TransitionResult,
} from './types';

export const IDENTITY_A = 'ap-south-1:aaaaaaaa-0000-0000-0000-000000000001';
export const IDENTITY_B = 'ap-south-1:bbbbbbbb-0000-0000-0000-000000000002';

/** 2026-10-02 10:00 IST event; fire 2026-10-01 09:00 IST (03:30Z); snooze 21:00 IST (15:30Z). */
export const EVENT_DATE_TIME = '2026-10-02T04:30:00.000Z';
export const FIRE_AT = '2026-10-01T03:30:00.000Z';
export const SNOOZE_AT = '2026-10-01T15:30:00.000Z';
export const BEFORE_CUTOFF = '2026-10-01T10:00:00.000Z';
export const AFTER_CUTOFF = '2026-10-01T16:00:00.000Z';

export function aReminder(overrides: Partial<ReminderRecord> = {}): ReminderRecord {
  return {
    id: 'rem-1',
    postId: 'post-1',
    ownerIdentityId: IDENTITY_A,
    status: 'SCHEDULED',
    initialFireAt: FIRE_AT,
    createdAt: '2026-09-20T00:00:00.000Z',
    updatedAt: '2026-09-20T00:00:00.000Z',
    ...overrides,
  };
}

export function aDeviceToken(overrides: Partial<DeviceTokenRecord> = {}): DeviceTokenRecord {
  return {
    id: 'dev-1',
    ownerIdentityId: IDENTITY_A,
    pushToken: 'push-token-1',
    platform: 'ANDROID',
    remindersEnabled: true,
    registeredAt: '2026-09-20T00:00:00.000Z',
    createdAt: '2026-09-20T00:00:00.000Z',
    updatedAt: '2026-09-20T00:00:00.000Z',
    ...overrides,
  };
}

export function anEventPost(overrides: Partial<FeedPost> = {}): FeedPost {
  return { id: 'post-1', type: 'EVENT', dateTime: EVENT_DATE_TIME, ...overrides };
}

export type Call = { op: string; args: unknown[] };

export class FakeReminderRepository implements ReminderRepositoryLike {
  calls: Call[] = [];
  reminders = new Map<string, ReminderRecord>();
  devices = new Map<string, DeviceTokenRecord>();
  /** When set, the next transition for this id fails its condition. */
  forceConditionFailureFor: string | undefined;
  failOn: Partial<Record<keyof ReminderRepositoryLike, Error>> = {};

  constructor(reminders: ReminderRecord[] = [], devices: DeviceTokenRecord[] = []) {
    reminders.forEach((r) => this.reminders.set(r.id, r));
    devices.forEach((d) => this.devices.set(d.id, d));
  }

  private record(op: keyof ReminderRepositoryLike, args: unknown[]) {
    this.calls.push({ op, args });
    const error = this.failOn[op];
    if (error) throw error;
  }

  async createReminder(reminder: NewReminder): Promise<ReminderRecord> {
    this.record('createReminder', [reminder]);
    const record = { ...reminder, updatedAt: reminder.createdAt };
    this.reminders.set(record.id, record);
    return record;
  }
  async getReminderById(id: string): Promise<ReminderRecord | undefined> {
    this.record('getReminderById', [id]);
    return this.reminders.get(id);
  }
  async listRemindersByOwner(ownerIdentityId: string): Promise<ReminderRecord[]> {
    this.record('listRemindersByOwner', [ownerIdentityId]);
    return [...this.reminders.values()].filter((r) => r.ownerIdentityId === ownerIdentityId);
  }
  async listRemindersByPost(postId: string): Promise<ReminderRecord[]> {
    this.record('listRemindersByPost', [postId]);
    return [...this.reminders.values()].filter((r) => r.postId === postId);
  }
  async transitionReminder(
    id: string,
    from: readonly ReminderStatus[],
    to: ReminderStatus,
    now: string,
    extra?: { snoozeFireAt?: string },
  ): Promise<TransitionResult> {
    this.record('transitionReminder', [id, from, to, now, extra]);
    const current = this.reminders.get(id);
    if (!current || !from.includes(current.status) || this.forceConditionFailureFor === id) {
      return { applied: false };
    }
    const next: ReminderRecord = { ...current, status: to, updatedAt: now };
    if (extra?.snoozeFireAt) next.snoozeFireAt = extra.snoozeFireAt;
    else delete next.snoozeFireAt;
    this.reminders.set(id, next);
    return { applied: true, reminder: next };
  }
  async getDeviceTokenByOwner(ownerIdentityId: string): Promise<DeviceTokenRecord | undefined> {
    this.record('getDeviceTokenByOwner', [ownerIdentityId]);
    return [...this.devices.values()].find((d) => d.ownerIdentityId === ownerIdentityId);
  }
  async upsertDeviceToken(
    ownerIdentityId: string,
    pushToken: string,
    platform: DevicePlatform,
    now: string,
    newId: () => string,
  ): Promise<DeviceTokenRecord> {
    this.record('upsertDeviceToken', [ownerIdentityId, pushToken, platform, now]);
    const existing = await this.getDeviceTokenByOwner(ownerIdentityId);
    if (existing) {
      const next = { ...existing, pushToken, platform, registeredAt: now, updatedAt: now };
      this.devices.set(next.id, next);
      return next;
    }
    const created: DeviceTokenRecord = {
      id: newId(),
      ownerIdentityId,
      pushToken,
      platform,
      remindersEnabled: true,
      registeredAt: now,
      createdAt: now,
      updatedAt: now,
    };
    this.devices.set(created.id, created);
    return created;
  }
  async setRemindersEnabled(id: string, enabled: boolean, now: string): Promise<DeviceTokenRecord> {
    this.record('setRemindersEnabled', [id, enabled, now]);
    const current = this.devices.get(id);
    if (!current) throw new Error('device missing');
    const next = { ...current, remindersEnabled: enabled, updatedAt: now };
    this.devices.set(id, next);
    return next;
  }

  ops(): string[] {
    return this.calls.map((c) => c.op);
  }
}

export class FakeSchedules implements SchedulesLike {
  calls: Call[] = [];
  failOn: Partial<Record<'createOneTime' | 'updateTime' | 'delete', Error>> = {};

  private record(op: 'createOneTime' | 'updateTime' | 'delete', args: unknown[]) {
    this.calls.push({ op, args });
    const error = this.failOn[op];
    if (error) throw error;
  }
  async createOneTime(name: string, atIso: string, targetArn: string, payload: SchedulePayload) {
    this.record('createOneTime', [name, atIso, targetArn, payload]);
  }
  async updateTime(name: string, atIso: string, targetArn: string, payload: SchedulePayload) {
    this.record('updateTime', [name, atIso, targetArn, payload]);
  }
  async delete(name: string, payload: SchedulePayload) {
    this.record('delete', [name, payload]);
  }
  ops(): string[] {
    return this.calls.map((c) => c.op);
  }
}

export class FakeFeedClient implements FeedClient {
  calls = 0;
  constructor(
    private readonly posts: FeedPost[] = [],
    private readonly error?: Error,
  ) {}
  async listPosts(): Promise<FeedPost[]> {
    this.calls += 1;
    if (this.error) throw this.error;
    return this.posts;
  }
}

export class FakePushSender implements PushSender {
  sent: Array<{ pushToken: string; platform: DevicePlatform; notification: PushNotification }> = [];
  constructor(private readonly error?: Error) {}
  async send(pushToken: string, platform: DevicePlatform, notification: PushNotification) {
    this.sent.push({ pushToken, platform, notification });
    if (this.error) throw this.error;
  }
}

export class FakeMetrics implements ReminderMetricsLike {
  deltas: number[] = [];
  async emitDeliveryDelta(deltaSeconds: number) {
    this.deltas.push(deltaSeconds);
  }
}
