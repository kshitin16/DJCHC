# Business Rules — reminder-unit

```yaml
rules:
  - id: BR7.1
    statement: >
      A Reminder is created for a device's guest identity, for a given
      Event-type Post, the first time that device syncs (calls
      myReminders) after the Post exists and that device does not already
      have a Reminder for it whose initialFireAt matches the currently-
      correct value BR7.2 computes from the Post's current dateTime —
      on by default, not requiring the user to opt in. A device whose
      remindersEnabled is false does not get new Reminders auto-created
      on sync (BR7.7). ReminderUnit enumerates current Event-type Posts
      by calling FeedUnit's listPosts query (Contract 3, amended at this
      stage to add ReminderUnit as a second consumer) — the same public,
      unauthenticated query FlutterAppUnit already uses; no separate
      contract was needed since listPosts already returns every field
      this Unit requires (id, type, dateTime).

      Widened at this stage's review (builder's explicit simplicity
      choice, made when BR7.8 was simplified to a no-op below): the
      backfill condition changed from "no existing Reminder for this
      postId" to "no existing Reminder for this postId whose
      initialFireAt matches the Post's current dateTime" — so if an
      admin changes an Event Post's DATE after a device already has a
      Reminder for it, that device's next sync creates a SECOND Reminder
      for the same Post, pointing at the new date, while the original
      Reminder is left untouched pointing at the stale date (see BR7.8).
      A same-date time-only edit never triggers this, since BR7.2's
      initialFireAt is computed from the date component only.
    category: policy
    applies_to: View My Reminders (sync) workflow
    trigger: A device calls myReminders
    logic: >
      Call listPosts (Contract 3); FOR EACH returned Post with type =
      EVENT: compute the currently-correct initialFireAt per BR7.2; IF no
      existing Reminder for this device's ownerIdentityId and this postId
      has that exact initialFireAt value THEN, IF DeviceToken.remindersEnabled
      is true, create a new Reminder (status SCHEDULED, that initialFireAt);
      ELSE skip.
    violation_behaviour: N/A — this rule defines the lazy auto-creation mechanism itself.
    source: FR7.2, Functional Design Q1

  - id: BR7.2
    statement: The initial (non-snoozed) reminder fires at 9:00 AM IST the day before the Post's dateTime.
    category: policy
    applies_to: Reminder creation (BR7.1)
    trigger: A Reminder is created
    logic: initialFireAt = (Post.dateTime's date - 1 day) at 09:00 IST.
    violation_behaviour: N/A — this rule defines the computed fire time.
    source: FR7.4

  - id: BR7.3
    statement: >
      Snoozing a Reminder re-triggers it at a fixed 9:00 PM IST the same
      day (the day before the event) — a fixed clock time, not a relative
      offset from when snooze was tapped — and does not re-trigger at all
      if 9:00 PM IST has already passed when snooze is tapped. Only the
      Reminder's own owner may snooze it (added at NFR Requirements
      review, R-01: this ownership check was already stated in
      functional-spec.md's Snooze Reminder workflow and in Contract 9's
      schema comment, but was missing from this rule's own logic — the
      same ownerIdentityId-equality check BR7.5 already states for
      cancel). Snoozing a Reminder that is already SNOOZED is an
      idempotent no-op (clarified at NFR Design review, disclosed at NFR
      Requirements as R-05): since snoozeFireAt is always the same fixed
      9:00 PM IST clock time regardless of when snooze is tapped, a
      second snooze call produces no actual change — there is no
      behavioral difference to design a refusal around, so it succeeds
      and returns the Reminder unchanged, consistent with BR7.10's
      existing idempotent-no-op treatment of other redundant calls. The
      no-op DOES still re-verify/re-issue the EventBridge schedule call
      for snoozeFireAt (added at NFR Design review, R-04): a prior
      snooze call may have written the DynamoDB status/snoozeFireAt
      update but failed on its own EventBridge UpdateSchedule call (a
      partial failure, not double-application of BR7.10's idempotency
      key); without re-issuing the schedule call on the no-op path, that
      retry would return success while leaving the schedule silently
      pointing at the wrong (or no) fire time. Re-issuing
      UpdateSchedule with the same target time on every no-op call is
      itself idempotent from EventBridge's own API semantics, so this
      adds no new failure mode.
    category: validation
    applies_to: Snooze Reminder workflow
    trigger: A user snoozes a Reminder (snoozeReminder, Contract 9)
    logic: >
      IF NOT (caller's ownerIdentityId matches the Reminder's
      ownerIdentityId) THEN refuse (checked first, unconditionally,
      before any status/time branching — corrected at NFR Design review,
      R-01, after a prior draft let a non-owner reach the already-SNOOZED
      no-op branch below without this check); ELSE IF Reminder.status is
      already SNOOZED THEN no-op on the DynamoDB write, but re-issue the
      EventBridge UpdateSchedule call for snoozeFireAt = 21:00 IST same
      day before returning unchanged (corrected at NFR Design review,
      R-04, so a retry after a prior partial DynamoDB-succeeded/
      EventBridge-failed call re-syncs the schedule); ELSE IF
      Reminder.status is SCHEDULED AND current time (IST) < 21:00 the
      same day THEN set snoozeFireAt = 21:00 IST same day, status =
      SNOOZED, and issue the EventBridge UpdateSchedule call; ELSE refuse
      (already past 9 PM IST) or no-op on the DynamoDB write with NO
      EventBridge action (already terminal — FIRED, CLEARED, or
      CANCELLED — corrected at NFR Design review, R-02/R-03: this branch
      previously cross-referenced BR7.10 for an EventBridge obligation,
      but BR7.10 does not govern snoozeReminder at all, only
      cancelReminder and the Contract 8 handler; snooze is never the
      operation responsible for a terminal Reminder's own schedule
      cleanup — FIRED means the fire-schedule already self-consumed by
      firing, CLEARED means BR7.4's auto-clear path already owns any
      schedule cleanup, and CANCELLED means cancelReminder/BR7.10 already
      owns it — so this no-op genuinely needs no EventBridge call of its
      own, unlike the already-SNOOZED no-op above, where snooze itself is
      the operation whose own prior call may have partially failed).
    violation_behaviour: A snooze attempted by a caller who does not own the Reminder is refused unconditionally, before any other check — including before the already-SNOOZED no-op case, so a non-owner never receives a successful "unchanged" response for a Reminder they don't own. A snooze attempted after 9:00 PM IST by the actual owner, against a still-SCHEDULED Reminder, is refused with a plain-language message. A no-op response for an already-SNOOZED Reminder that skips re-issuing the EventBridge UpdateSchedule call is a defect (R-04) — that no-op must still re-sync the schedule; the already-terminal no-op needs no such call (see logic).
    source: FR7.5; ownership check corrected at NFR Requirements review (R-01); EventBridge re-sync on already-SNOOZED no-op corrected at NFR Design review (R-04); already-terminal no-op's incorrect BR7.10 cross-reference corrected at NFR Design review (R-02/R-03)

  - id: BR7.4
    statement: >
      A Reminder auto-clears once its Post's own dateTime has passed,
      regardless of its current status (SCHEDULED, SNOOZED, or FIRED) —
      confirmed explicitly (redo pass, Functional Design review): a
      delivered-but-unopened FIRED reminder also clears, not just a
      pending one, matching FR7.6's literal "whether or not the user ever
      acted on it." CANCELLED is the one status excluded — a user's
      explicit cancellation is already final and is not further modified.
      This is an EXPLICIT WRITE, not a computed read-time status: it is
      performed by the same scheduled-compute mechanism that delivers
      push notifications (deferred to Infrastructure Design — see
      contract-summary.md Open Questions for Contract 9), which already
      runs per-Reminder at its fire time and is therefore the natural
      place to also check "has this Reminder's Post now passed, whether
      fired or not" and write CLEARED. This resolves the ambiguity
      Contract 9's own Open Questions table explicitly deferred to this
      stage.
    category: policy
    applies_to: Reminder lifecycle (all statuses except CANCELLED)
    trigger: The scheduled-compute mechanism observes that the Post's dateTime has passed for a Reminder not already CLEARED or CANCELLED
    logic: IF Post.dateTime has passed AND Reminder.status is SCHEDULED, SNOOZED, or FIRED THEN set status = CLEARED.
    violation_behaviour: N/A — this rule defines the auto-clear transition and its explicit-write mechanism.
    source: FR7.6, Functional Design redo-pass confirmation

  - id: BR7.5
    statement: A user can cancel a Reminder for any individual event, at any time, via cancelReminder (Contract 9).
    category: authorization
    applies_to: Cancel Reminder workflow
    trigger: A user cancels a Reminder
    logic: IF the caller's ownerIdentityId matches the Reminder's ownerIdentityId THEN set status = CANCELLED; ELSE refuse.
    violation_behaviour: A cancel request from a different device identity than the Reminder's owner is refused.
    source: FR7.7

  - id: BR7.6
    statement: No Google sign-in is ever required for any Reminder action — every operation in this Unit is scoped to a Cognito guest (unauthenticated) identity per device.
    category: authorization
    applies_to: Every workflow in this Unit
    trigger: Any Reminder/DeviceToken operation
    logic: Authorization uses the caller's Cognito Identity Pool guest identity id (IAM auth mode, Amplify Data allow.guest()), never a Cognito User Pool token.
    violation_behaviour: N/A — this rule states the authorization model itself.
    source: FR7.8, Domain Design ADR-005

  - id: BR7.7
    statement: >
      Turning a device's app-wide reminders toggle off (setRemindersEnabled,
      Contract 9) only suppresses future auto-creation of new Reminders for
      that device (BR7.1) — it does not cancel, clear, or otherwise affect
      any Reminder already scheduled or snoozed for that device.
    category: policy
    applies_to: Set Reminders Enabled workflow
    trigger: A device toggles remindersEnabled
    logic: Set DeviceToken.remindersEnabled; do not modify any existing Reminder record.
    violation_behaviour: N/A — this rule defines the toggle's scope explicitly, closing an ambiguity flagged during Domain Design and Units Generation review.
    source: FR7.2, Contract Design Q2 (redo pass)

  - id: BR7.8
    statement: >
      Simplified to a no-op at NFR Design review, by the builder's
      explicit choice (favoring a simple, flexible reminder module over
      a 100%-complete one): when FeedUnit reports (Contract 8,
      PostDateTimeChanged) that an Event Post's dateTime changed, NO
      existing Reminder for that Post is modified, regardless of status.
      A same-DATE time-only edit needs no reschedule anyway — BR7.2's
      initialFireAt is computed from the date component only, so
      recomputing it would yield the identical value. A DATE change is
      handled instead by BR7.1's widened backfill condition: the
      existing Reminder is left exactly as-is (still pointing at the
      stale date), and the device's next sync creates an ADDITIONAL
      Reminder pointing at the new date — a deliberate accepted trade-off
      (a device may end up with a stale, un-cancelled Reminder for a
      moved event) over the added design/implementation complexity of an
      in-place reschedule. This also means feed-unit's BR2.5 revival
      scenario (an aged-out Post's dateTime edited back into the future)
      no longer revives an existing CLEARED Reminder in place — the
      device instead gets a fresh one on next sync, via the same BR7.1
      path, once the revived Post's new date differs from the CLEARED
      Reminder's stale initialFireAt.
    category: policy
    applies_to: Post Change Notification (Contract 8) handling
    trigger: A PostDateTimeChanged event arrives
    logic: No-op — this event requires no action of any kind on any existing Reminder. Retained as a named rule only so Contract 8's event taxonomy and this Unit's Functional Design remain traceable to something; the Contract 8 handler does not need to look up or touch any Reminder for this event type at all.
    violation_behaviour: N/A — there is no behavior to violate; the rule is that nothing happens.
    source: Domain Design Q3, Contract Design Q1, Functional Design redo-pass fix (feed-unit BR2.5 consistency); simplified to a no-op at NFR Design review per the builder's explicit simplicity-over-completeness choice

  - id: BR7.9
    statement: >
      When FeedUnit reports (Contract 8, PostDeleted) that a Post was
      deleted, any SCHEDULED or SNOOZED Reminder for that Post is
      automatically cancelled — the same outcome as a user-initiated
      cancel (BR7.5), just system-triggered. A Reminder already FIRED,
      CLEARED, or CANCELLED is left unchanged (idempotent no-op).
    category: policy
    applies_to: Post Change Notification (Contract 8) handling
    trigger: A PostDeleted event arrives for a Post with an existing Reminder
    logic: IF a Reminder exists for postId AND status is SCHEDULED or SNOOZED THEN set status = CANCELLED; ELSE no-op.
    violation_behaviour: N/A — this rule defines the cascade-cancel behavior, closing the gap disclosed at Domain Design and Units Generation review.
    source: Contract Design Q2 (redo pass)

  - id: BR7.10
    statement: >
      Contract 8's event handler is idempotent — redelivery of the same
      stream record (keyed on postId plus that record's own
      updatedAt/sequence position) is a no-op, never double-applying a
      cascade-cancel (BR7.9). (BR7.8's own PostDateTimeChanged handling
      is itself always a no-op now — see BR7.8 — so redelivery of that
      event type was never at risk of double-applying anything to begin
      with; this idempotency guarantee is now substantively about BR7.9
      alone.) Contract 9's cancelReminder is likewise idempotent against
      an already-terminal Reminder (FIRED/CLEARED/CANCELLED).
    category: constraint
    applies_to: Post Change Notification handling; Cancel Reminder workflow
    trigger: A stream record is redelivered, or cancelReminder is called on an already-terminal Reminder
    logic: >
      IF this exact (postId, updatedAt) has already been processed, OR
      the target Reminder is already FIRED/CLEARED/CANCELLED, THEN
      return success with no further DynamoDB state change; a
      cancelReminder no-op additionally re-issues BOTH corresponding
      EventBridge DeleteSchedule calls — the fire schedule
      ("fire-<Reminder.id>") AND the auto-clear schedule (corrected at
      NFR Design review, R-04, then widened at R-02 from a single
      DeleteSchedule call to both: performance-design.md's own NFR-PERF.2
      design already documents cancelReminder as deleting both schedules
      on its non-no-op path, so the no-op re-sync path must cover the
      same two schedules, not just one) — before returning, so a client
      retry after a prior partial DynamoDB-succeeded/EventBridge-failed
      cancel re-syncs both schedules rather than leaving either stale.
      DeleteSchedule on an already-deleted schedule succeeds as a no-op
      from EventBridge's own API semantics, so this adds no new failure
      mode. The Contract 8 event handler's own no-op path needs no
      equivalent addition: stream redelivery already re-runs its
      EventBridge call unconditionally (reliability-design.md),
      independent of this rule's DynamoDB no-op.
    violation_behaviour: A duplicate stream delivery or a redundant cancel that changes state a second time (e.g. re-cancelling an already-fired Reminder) is a defect. A cancelReminder no-op that skips re-issuing either EventBridge DeleteSchedule call (fire or auto-clear) is also a defect (R-04/R-02) — the no-op must still re-sync both schedules.
    source: Contract Design Q2 (redo pass); EventBridge re-sync on cancelReminder no-op corrected at NFR Design review (R-04)

  - id: BR7.11
    statement: >
      A reminder is delivered as a server-triggered push notification to
      a registered DeviceToken, not a local, on-device-scheduled
      notification — this explicitly supersedes the project's earlier
      "no push notifications this release" decision.
    category: constraint
    applies_to: Reminder delivery (all fire events)
    trigger: A Reminder's initialFireAt or snoozeFireAt is reached
    logic: Delivery requires an existing DeviceToken for the Reminder's ownerIdentityId; the scheduled-compute mechanism that triggers delivery is deferred to Infrastructure Design (contract-summary.md Open Questions).
    violation_behaviour: N/A — this rule states the delivery mechanism itself.
    source: FR7.3
```

## Summary

| Rule | Category | What it governs |
|---|---|---|
| BR7.1 | Policy | Reminders created lazily per device on sync, on by default |
| BR7.2 | Policy | Initial fire time: 9:00 AM IST day before |
| BR7.3 | Validation | Snooze fires at fixed 9:00 PM IST same day, or refused if already passed |
| BR7.4 | Policy | Auto-clear once the event's dateTime has passed |
| BR7.5 | Authorization | User can cancel their own Reminder anytime |
| BR7.6 | Authorization | No sign-in — guest identity only |
| BR7.7 | Policy | App-wide toggle only suppresses future auto-creation |
| BR7.8 | Policy | Reschedule on Post dateTime change (Contract 8) |
| BR7.9 | Policy | Auto-cancel on Post delete (Contract 8) |
| BR7.10 | Constraint | Idempotent event handling and cancel |
| BR7.11 | Constraint | Delivery is server-triggered push, not local notifications |
