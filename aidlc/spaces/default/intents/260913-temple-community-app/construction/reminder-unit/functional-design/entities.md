# Entity Model — reminder-unit

```yaml
entities:
  - name: Reminder
    description: >
      A day-before push reminder for one Event-type Post, owned by one
      device's guest (unauthenticated) identity. Created lazily on that
      device's first sync after the Post exists (Q1) — never eagerly at
      Post-creation time.
    identifier: id
    attributes:
      - name: id
        type: UUID
        required: true
        unique: true
        description: Matches Contract 9's `id: ID!` field exactly (Amplify Data's default primary-key name).
      - name: postId
        type: UUID
        required: true
        description: References FeedUnit's Post.id (Contract 3) — a plain ID reference, not a cross-component entity ownership.
      - name: ownerIdentityId
        type: string
        required: true
        description: The caller's Cognito guest (unauthenticated) Identity Pool id — NOT a Google-federated identity; no sign-in is ever involved (FR7.8, Domain Design ADR-005).
      - name: status
        type: enum
        required: true
        allowed_values: [SCHEDULED, SNOOZED, FIRED, CLEARED, CANCELLED]
        default: SCHEDULED
      - name: initialFireAt
        type: datetime
        required: true
        description: 9:00 AM IST the day before the Post's dateTime (FR7.4).
      - name: snoozeFireAt
        type: datetime
        required: false
        description: Set only when snoozed — a fixed 9:00 PM IST the same day (FR7.5); absent otherwise.
      - name: createdAt
        type: datetime
        required: true
    entity_constraints:
      - snoozeFireAt is set if and only if status is currently SNOOZED (not a historical "has ever been snoozed" predicate)
      - Ordinarily one Reminder per (postId, ownerIdentityId) pair, but NOT a hard uniqueness constraint (simplified at NFR Design review, per the builder's explicit choice to favor a simple, flexible module over a 100%-complete one): if an Event Post's dateTime DATE changes after a device already has a Reminder for it, BR7.8 leaves that Reminder untouched (still pointing at the stale date) and BR7.1's backfill creates an ADDITIONAL Reminder for the same (postId, ownerIdentityId) pair pointing at the new date on that device's next sync — so a device can transiently hold two Reminders for the same Post. This supersedes the prior in-place-revival design (BR7.8 no longer reschedules or revives a CLEARED Reminder; see BR7.8's current text).
      - PostDeleted's cascade (Contract 8) and cancelReminder (Contract 9) are both idempotent no-ops against a Reminder already in FIRED, CLEARED, or CANCELLED status — only SCHEDULED/SNOOZED actually transitions (Functional Design Q2)
      - A Reminder auto-clears (BR7.4) from SCHEDULED, SNOOZED, or FIRED once its Post's dateTime has passed — CLEARED is reachable from all three of those, not only from a pending Reminder (Functional Design redo-pass confirmation)
    relationships: []

  - name: DeviceToken
    description: A registered push-notification token for one device's guest identity, plus that device's app-wide reminders toggle.
    identifier: id
    attributes:
      - name: id
        type: UUID
        required: true
        unique: true
        description: Matches Contract 9's `id: ID!` field exactly.
      - name: ownerIdentityId
        type: string
        required: true
        description: The same guest Identity Pool id used on Reminder.ownerIdentityId — one DeviceToken per device identity.
      - name: pushToken
        type: string
        required: true
        description: The platform push token (APNs/FCM), registered via registerDeviceToken (Contract 9).
      - name: platform
        type: enum
        required: true
        allowed_values: [IOS, ANDROID]
      - name: remindersEnabled
        type: boolean
        required: true
        default: true
        description: The app-wide reminders toggle (FR7.2). Setting this false only suppresses future auto-creation of new Reminders for this device — it does NOT cancel or delete any already-scheduled/snoozed Reminder (Functional Design Q2 in Contract Design's redo, carried forward here).
      - name: registeredAt
        type: datetime
        required: true
        description: Updated (not duplicated) on re-registration of the same pushToken for the same ownerIdentityId — registerDeviceToken is idempotent per (ownerIdentityId, pushToken).
    entity_constraints:
      - One DeviceToken per (ownerIdentityId, pushToken) pair — re-registering updates registeredAt rather than creating a duplicate
    relationships: []
```

## Summary

ReminderUnit owns two entities, `Reminder` and `DeviceToken`, both scoped to a Cognito guest (unauthenticated) identity per device — never a signed-in Google identity (FR7.8, Domain Design ADR-005). Both identifiers are `id`, matching Contract 9 exactly.

`Reminder.postId` is a plain ID reference to FeedUnit's `Post` (Contract 3) — the one legitimate cross-component reference in this domain, already established at Domain Design. No other cross-component reference exists.

Per Q1, a `Reminder` is created lazily: the client calls `myReminders` (Contract 9) on sync, and the server backfills any missing Reminder for that device across every Event-type Post that doesn't already have one — respecting `DeviceToken.remindersEnabled`. This means `Reminder` rows do not exist for every Event post at all times; they exist only for (post, device) pairs where that device has actually synced since the post existed. This is a deliberate design choice (Q1), not an oversight: it keeps reminder creation tied to a real device identity rather than requiring ReminderUnit to guess which devices care about a newly-created post.
