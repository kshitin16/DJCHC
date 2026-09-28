<!-- INVARIANT: examples are single-line HTML comments so a fresh template parses to total=0 (MEMORY_EMPTY). Do NOT un-comment or split across lines. t100 guards this. -->
> This file is kept up to date automatically while the stage runs. Add observations at the review step, not by editing here directly.

## Interpretations
<!-- example: 2026-05-29T10:14:32Z — chose REST over GraphQL; the consuming team only needs CRUD, revisit if subscriptions land -->


- 2026-09-14T16:10:00Z — resolved frontend-components.md's ambiguous "resolved silently at app start (or lazily on first Calendar visit)" for DeviceIdentityState as: resolution *starts* async right after the first frame, non-blocking, so it doesn't compete with the cold-start budget; it only blocks the caller if Calendar is reached before it settles.
<!-- aidlc-wave-memory:flutter-app-unit:7b377e7750b58e10a7a3bfa46006eec6f1225b7374f8bf0da4bb2ae7e8fc401f -->

## Deviations
<!-- example: 2026-05-29T10:14:32Z — skipped the optional caching layer the stage prose suggested; the dataset is small enough that it adds risk -->


- 2026-09-14T16:20:00Z — corrected security-design.md's Crashlytics wiring claim after iteration-1 review (R-01): the plugin does NOT auto-wire FlutterError.onError/PlatformDispatcher.instance.onError; this is required manual main() setup, now stated as a Code Generation implementation requirement rather than default behavior.
<!-- aidlc-wave-memory:flutter-app-unit:a3262ea7b074e51507b71a99a9a560190d9d016405dc6021b1082c98048e4167 -->


- 2026-09-14T16:39:00Z — after the stage-level gate flagged R-01/R-02: corrected security-design.md's Threat model realization section — Spoofing's real mitigation is short-lived tokens + TLS (not PKCE, which protects the auth-code exchange, a different threat), and the section now walks all 5 STRIDE categories security-requirements.md's own table lists instead of 4.
<!-- aidlc-wave-memory:auth-unit:5553dbbb7c82624bcf040e92b3995141e22709cad44884ae9ca218d77cceaae8 -->


- 2026-09-14T16:52:00Z — the re-review caught that "5" was itself wrong: security-requirements.md's NFR3.4 table actually has 6 rows (Elevation of Privilege was missed). Added it to both security-design.md and traceability.json.
<!-- aidlc-wave-memory:auth-unit:7653a095d49108adc0d886e4919dc514228e9ab4c2e2ab82486baddc6dd9b80b -->


- 2026-09-14T16:36:00Z — after the stage-level gate flagged R-04: removed the webhook UpdateExpression's overwrite of aggregatorTransactionId with the settlement payment_id; that field is populated once at checkout time from order_id, and functional-spec.md never documents a settlement-time rewrite.
<!-- aidlc-wave-memory:donation-unit:700ad10422cb634b6915fe02d2db8d5011a61930139b6a2ab4284b752f49c916 -->


- 2026-09-14T16:37:00Z — after the stage-level gate flagged R-04/R-05: swapped traceability.json's NFR6.1/NFR-AUTHZ target descriptions back to match security-requirements.md's actual ID assignment, and updated the NFR2.3 row's stale "Versioning deferred" text to match reliability-design.md's now-committed "OFF" decision.
<!-- aidlc-wave-memory:pdf-library-unit:9d61d0bb3d24c04614a2c845bbd1eddef0820978b18f6e79a0ad33cdaf5168e0 -->


- 2026-09-14T16:38:00Z — after the stage-level gate flagged R-04: reworded scalability-design.md's "~2 days" TTL claim to distinguish read-visibility bound (~2 days, accurate) from physical/billed storage footprint (~4 days worst case, accounting for AWS's TTL sweep delay), rather than stating one figure for both.
<!-- aidlc-wave-memory:suggestion-unit:bea7830534c634cbbdcf559dcc050240607002a9c2818379f74d22533767a450 -->


- 2026-09-14T16:35:00Z — after the stage-level gate flagged R-04 (Critical, unresolved after 2 review iterations): amended BR7.3/BR7.10's logic fields in functional-design/rules.md so every no-op branch (already-SNOOZED snooze, already-terminal cancel) unconditionally re-issues the corresponding EventBridge Update/DeleteSchedule call before returning, closing the gap where a retry after a partial DynamoDB-succeeded/EventBridge-failed failure never re-synced the schedule.
<!-- aidlc-wave-memory:reminder-unit:b0e405f39810b82d83b6ca8c60d44460bbf2851b9389c777dfb39b1efc32bc51 -->


- 2026-09-14T16:45:00Z — the READY re-review of the above fix surfaced 2 new Major gaps in the fix's own wording: cancelReminder's no-op only re-issued one of its two owned schedules (fire + auto-clear), and snooze-on-already-terminal's no-op incorrectly cross-referenced BR7.10 (which doesn't govern snoozeReminder) for an obligation it doesn't actually have. Fixed both directly rather than letting them ride to the gate as open findings, per this project's own learned practice of closing a review-disclosed gap in the next pass that has enough information to do so.
<!-- aidlc-wave-memory:reminder-unit:4d9ada5c8027dfa4185427c3a3598b4ee87e18d1594f25379a622c920c48b0a6 -->

## Tradeoffs
<!-- example: 2026-05-29T10:14:32Z — picked TDD over BDD this run; the team is unit-first and the domain is well-understood -->


- 2026-09-14T16:10:00Z — no scalability/reliability/observability-design artifacts produced for this Unit; it is `kind: ui` and produces_kinds scopes those three to `service` only. This Unit's only observability surface (crash reporting) is covered under security-design.md's NFR-CRASH.1 instead.
<!-- aidlc-wave-memory:flutter-app-unit:940f5b5059d110325fb4d252c536bc4694fcce0140bf1fa8a615a451d2c655bd -->


- 2026-09-14T17:15:00Z — builder's explicit choice, mid-recovery from a redo-jump: simplified BR7.8 (reschedule on Post dateTime change) to a no-op, favoring a simple/flexible reminder module over a 100%-complete one. A date change now surfaces as an additional Reminder on the device's next sync (BR7.1, widened) rather than an in-place reschedule; the old Reminder is left pointing at the stale date. Accepted consequence: a device can transiently hold two Reminders for the same Post, and feed-unit's BR2.5 revival scenario no longer revives a CLEARED Reminder in place.
<!-- aidlc-wave-memory:reminder-unit:b0c5dcb62c04c7b75ab0777ccad7cb880120e1955b7f07497df437889c664555 -->

## Open questions
<!-- example: 2026-05-29T10:14:32Z — confirm the retention window with compliance before the next stage hardens the schema -->
