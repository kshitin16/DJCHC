<!-- INVARIANT: examples are single-line HTML comments so a fresh template parses to total=0 (MEMORY_EMPTY). Do NOT un-comment or split across lines. t100 guards this. -->
> This file is kept up to date automatically while the stage runs. Add observations at the review step, not by editing here directly.

## Interpretations
<!-- example: 2026-05-29T10:14:32Z — chose REST over GraphQL; the consuming team only needs CRUD, revisit if subscriptions land -->


- 2026-09-14T05:11:23Z — Surfaced and resolved a real inconsistency between Domain Design (AdminAllowlistEntry as a database table) and Contract Design (cognito:groups claim) as an explicit interview question rather than silently picking one — the human chose native Cognito Groups, which also matches Contract Design's actual claim shape, so AuthUnit ends up with zero owned entities.
<!-- aidlc-wave-memory:auth-unit:46a8659054369a60da9a3ca0dc79aa27f85fa62807c56ccd6792abda8be50c18 -->


- 2026-09-14T05:19:31Z — Modeled RECURRING Donation records as the mandate itself rather than one record per periodic charge, since individual charge execution/history is the aggregator's responsibility — flagged explicitly as an assumption to revisit once the real aggregator's recurring-payment API is known, rather than over-designing against an unconfirmed shape.
<!-- aidlc-wave-memory:donation-unit:791126573a9eea40b029eb35746f9b6b2807ed6656d8bdebcc7858d5b933b197 -->


- 2026-09-14T05:29:54Z — Learning from donation-unit's review: checked whether the new deletedAt field needed to be surfaced in Contract 3 before generating artifacts, rather than waiting for the reviewer to catch a drift. Concluded it does not — a soft-deleted post is never returned by any query, so FlutterAppUnit never needs to represent a 'deleted' state, unlike donation-unit's CANCELLED status which is user-visible. No contract amendment made.
<!-- aidlc-wave-memory:feed-unit:6bffdad7e807b77a5b4428134f8d75a3d6cedb46df4821aa02c56da00fcd9a74 -->


- 2026-09-14T05:39:05Z — Applying the lesson from donation-unit and feed-unit's reviews, proactively amended Contract 6 before generating artifacts rather than waiting for a reviewer to catch the gap: refined category from free-text String to a DocumentCategory enum (now that the fixed list is confirmed) and added the deleteDocument mutation that Q3's hard-delete decision requires but the original contract never had.
<!-- aidlc-wave-memory:pdf-library-unit:77a24794fb3f52202a63b51ca51fe92d82ef8021c849f3a21f125b4de823a415 -->


- 2026-09-14T06:10:00Z — The confirmed 5-per-day submission limit (Q2/Q2a) is implemented as server-side resolver logic that counts the caller's existing same-day Suggestion records, rather than as a new counter field or a Contract 4 amendment — Contract 4's submitSuggestion mutation already carries everything the resolver needs (submittedByGoogleId, submittedAt on existing records), so unlike donation-unit/feed-unit/pdf-library-unit this Unit needed no proactive contract change.
<!-- aidlc-wave-memory:suggestion-unit:017bcd4b0e7c981e806df2b005c53ccae0104d27209d43de790b1aeb59b12904 -->


- 2026-09-14T06:45:00Z — Identified a real gap before generating artifacts: Contract 4's `allSuggestions` query has no corresponding wireframed screen, despite FR3.3 requiring admin visibility. Raised it as Q1 rather than silently inventing a screen; the human chose to add an in-app Admin Suggestions screen this release.
<!-- aidlc-wave-memory:flutter-app-unit:ede0be8d0d0514635989565b34487f151eed3d6973f572eef8a785d37fce7d82 -->


- 2026-09-14T06:45:00Z — Since Domain Design's Q1 already chose to map the whole domain (including later-release Donation/PDF Library) now, extended that same whole-picture approach to this Unit's screens too (Q3), deriving Donate/My Donations/PDF Library/Admin PDF Library Management workflows directly from donation-unit's and pdf-library-unit's already-completed Functional Design contracts, rather than leaving this Unit's design incomplete relative to its five backend Units.
<!-- aidlc-wave-memory:flutter-app-unit:fa95268d3a3f6e1d1f2a3b0e312ad5c606197481aa8a1c4b1a295868d321454e -->


- 2026-09-14T11:10:00Z — Identified a real gap in the contracts before generating artifacts: FR7.2's "on by default" can't mean a Reminder is created server-side the instant a Post exists, since Reminder requires a specific device's guest identity. Raised as Q1 rather than silently assuming a mechanism; the human chose lazy per-device creation on sync, which also meant Contract 8 does not need a PostCreated event.
<!-- aidlc-wave-memory:reminder-unit:3ab68de77b90da7da3632c5ae5a6d0185d4c20e890b186c52bd98228ddd87cf3 -->


- 2026-09-14T11:10:00Z — Closed three gaps the Contract Design review had disclosed but left open across two prior reviews (Contract 8 idempotency, PostDeleted/cancelReminder terminal-state behavior, missing AsyncAPI notational note) directly in this pass, per Q2, rather than letting them ride a fourth time.
<!-- aidlc-wave-memory:reminder-unit:d4ad2bb7655015bad0ee3b9c81f0fba7964e89a94ffbf36e6c6aec34422f0c4d -->

## Deviations
<!-- example: 2026-05-29T10:14:32Z — skipped the optional caching layer the stage prose suggested; the dataset is small enough that it adds risk -->


- 2026-09-14T05:11:23Z — entities.md declares an empty entities list rather than omitting the file, since the stage still requires entities.md for a service-kind unit even when the unit genuinely owns no data.
<!-- aidlc-wave-memory:auth-unit:20edd7effac5b1a3becf4c50b5d7ba1f1710c1b3dfa71d721d70e84863d8523f -->


- 2026-09-14T05:25:06Z — Iteration 1 review (NOT-READY, 1 Critical + 1 Major + 1 Minor) found that CANCELLED, frequency, and cancelledAt were introduced in this Unit's own artifacts without amending the shared Contract 5 in contract-summary.md, which FlutterAppUnit actually consumes — an upstream artifact drift, not just a local defect. Fixed by amending Contract 5 additively (new enum value, new optional fields, new cancelDonation mutation), explicitly labeled as a Functional-Design-time amendment, consistent with the project's no-formal-versioning/update-both-sides-together practice. Also fixed the state table's guard condition (explicit donationType=RECURRING + requester-identity check instead of relying on an informal row label) and clarified that amount's 0.01 floor is a technical constraint, not a contradiction of Q1's 'no minimum' business decision.
<!-- aidlc-wave-memory:donation-unit:ea1e697206acc83fae7b2be42d473052d539995a059a05f905a8b9e6c572cd7d -->


- 2026-09-14T05:19:31Z — Added a CANCELLED status value to the Donation entity beyond what Contract Design's Contract 5 enumerated (INITIATED/PENDING/SUCCEEDED/FAILED only) — Q3's in-app-cancellation decision requires it. This is a downstream refinement of an upstream artifact's enum, not a contradiction of it.
<!-- aidlc-wave-memory:donation-unit:4775850505ae79b657632f665462bc5ee5ac30a1430656716a5e7d6b9f797517 -->


- 2026-09-14T05:36:22Z — Iteration 1 review (NOT-READY, 1 Critical + 1 Major + 1 Minor) found that BR2.5's own scenario (editing an aged-out post's date to bring it back) was unimplementable against Contract 3 as written — listPosts filters age-out server-side with no way for anyone, admin included, to retrieve an aged-out post's id. Fixed by amending Contract 3 additively (listAllPostsForAdmin, getPost queries), adding BR2.7 (admin management view bypasses age-out), and a new 'List Posts (admin management view)' workflow. Also added infrastructure-error paths to the Create/Edit/Delete workflows (previously only covered business-rule refusals) and closed the asymmetric-rationale minor finding by documenting why length limits don't need a contract change (GraphQL has no native max-length) directly in entities.md.
<!-- aidlc-wave-memory:feed-unit:267d70cba8ae0cab3f3b7192c206b9482b15945fbb351ce8ad0307dcc29bde33 -->


- 2026-09-14T05:29:54Z — None — followed the standard 3-question interview and full artifact generation for a service-kind unit.
<!-- aidlc-wave-memory:feed-unit:207459c89bf49a69ec149351120a70b08124a3e6d980e28cff42eb0c919e3695 -->


- 2026-09-14T05:44:05Z — Iteration 1 review (NOT-READY, 3 Major + 1 Minor) found: (1) no presigned-upload path existed, so a large PDF transiting a single GraphQL mutation would contradict the 'no file-size limit' decision — fixed by amending Contract 6 with createDocumentUploadUrl + confirmDocumentUpload, a two-step direct-to-S3 upload symmetric to the existing download URL pattern; (2) the delete workflow's partial-failure handling only covered one of two possible orderings — fixed by pinning the order explicitly (S3 file removed first, record removed second) in BR6.4 and the workflow, so the only possible failure state is a retryable record-with-no-file, never a file-with-no-record; (3) traceability.json traced BR6.3 (admin authorization) to FR6.1 (public browsing text) instead of FR6.2 (which actually states admin-only document addition) — fixed the mapping and removed BR6.3's hedged 'implied' source citation now that a real FR grounds it; (4) fixed the uploadDocument comment typo ('category must be PDF' -> corrected by the whole upload redesign, which now checks PDF-ness at confirmDocumentUpload time instead).
<!-- aidlc-wave-memory:pdf-library-unit:1505ea8ef589f183997614dd5f096f0d0ee415f8adf16450aa81c588aae2a025 -->


- 2026-09-14T05:39:05Z — None — followed the standard 3-question interview.
<!-- aidlc-wave-memory:pdf-library-unit:d86711502a7dece3c9c9c0dc870f0f0c89b5abfdcffb583364cfd061e6a1db0a -->


- 2026-09-14T06:10:00Z — None — followed the standard 2-question interview (plus one confirmation follow-up).
<!-- aidlc-wave-memory:suggestion-unit:f8621e2ea47b413e0e0721724a5cb91406a430d4e5bfa181959077f8c7705543 -->


- 2026-09-14T06:30:00Z — Iteration 1 review (NOT-READY, 4 Major + 2 Minor) found: (1) the entity identifier was named `suggestionId` throughout while Contract 4 names it `id` — fixed by renaming to `id` and noting the alignment explicitly; (2) `max_length: 300` on `text` read as a character cap when the actual rule is a 300-word cap — fixed by renaming to `max_word_count` and specifying whitespace-tokenized counting; (3) BR3.5's "count then create" rate-limit check was a non-atomic read-then-write, vulnerable to two near-simultaneous submissions both passing — fixed by introducing an internal (non-Contract-4) `SuggestionDailyCount` counter enforced via a single atomic DynamoDB conditional UpdateItem; (4) the admin-only `allSuggestions` / owner-only `myPastSuggestions` queries never stated their enforcement layer — fixed by specifying AppSync/Amplify Data declarative `@auth` rules (group auth for admin, owner auth for self) in BR3.3 and both workflows. Also addressed two Minor findings: (5) "calendar day" now explicitly means IST (Asia/Kolkata), matching the temple community's timezone; (6) the admin all-suggestions list now states "newest first" ordering, matching the submitter's own list.
<!-- aidlc-wave-memory:suggestion-unit:1be64c1766e0d2b6f35fe540d544c6b9ef18d16f60220334b1a4e2fd7332ce34 -->


- 2026-09-14T06:45:00Z — None — followed the standard 3-question interview.
<!-- aidlc-wave-memory:flutter-app-unit:d51f227d33758061dc7bdffa2c8d4b597a364569105ca3715c82999cc50a273c -->


- 2026-09-14T10:15:00Z — Re-review after the backward-jump guard recovery (NOT-READY, 3 Major) found genuine drift that accumulated while this Unit sat untouched during four other units' redo passes: (1) BR1.2/functional-spec's admin-consumer list never picked up SuggestionUnit's addition to Contract 2 — fixed by adding it to both; (2) Contract 2's own shared description in contract-summary.md still narrated the old database-backed AdminAllowlistEntry story that this Unit's Q1 decision (native Cognito Groups) had already superseded, an upstream-drift bug this reviewer caught — fixed by amending Contract 2's description; (3) FR1.3 was marked OK in traceability.json against BR1.1+BR1.2 even though neither rule actually states the public/signed-in split — re-classified as Deferred (cross-cutting, owned by each consuming Unit) per this project's own persisted convention, closing a finding first raised (but left unfixed) at the original Functional Design pass.
<!-- aidlc-wave-memory:auth-unit:2b8558f6adda6c636d390d3977bf6e5269e1ebadc70c43f3ff9a872b6046ed23 -->


- 2026-09-14T10:20:00Z — Re-review after the backward-jump guard recovery (NOT-READY, 1 Critical + 1 Major) found two real defects that predated the redo: (1) the entity identifier was named `donationId` throughout while Contract 5 names it `id` — the same defect class already caught once at suggestion-unit but missed here — fixed by renaming to `id`; (2) `initiateDonation`'s return type `DonationInitiation` was referenced in Contract 5 but never defined — the same class of gap as pdf-library-unit's `DocumentUploadTarget` — fixed by defining it (donationId, checkoutUrl, checkoutReference) in Contract 5 and describing its shape in the Initiate Donation workflow.
<!-- aidlc-wave-memory:donation-unit:c77307b3f0f3f6bda93542ea49448e08bef0d5272825a3dd373fe551929ef690 -->


- 2026-09-14T10:35:00Z — Redo pass (Calendar & Reminders): while reconfirming this Unit's unchanged summary, caught two real pre-existing defects before generating anything: (1) the entity identifier was still `postId` against Contract 3's `id` — the same defect class this project has now caught three times (suggestion-unit, donation-unit, and here), fixed by renaming to `id`; (2) Contract 8's `PostDeleted` event (drafted during Contract Design without direct access to this Unit's own delete semantics) assumed a DynamoDB REMOVE record, but this Unit's own BR2.6 is an explicit soft delete — no REMOVE ever occurs. Fixed by amending Contract 8 to key `PostDeleted` off a MODIFY record where deletedAt transitions to set, not a REMOVE record. Also closed the long-disclosed R-04 gap (BR2.7 missing from the Rules Summary table) now that the file was being touched anyway for a real reason, rather than waiting for a third disclosure.
<!-- aidlc-wave-memory:feed-unit:d9477a5c4b8cee95c2980df2e8e1249d942de58dacb42bb164b107ea9c176680 -->


- 2026-09-14T10:45:00Z — Redo pass (Calendar & Reminders): while reconfirming this Unit's unchanged summary, caught the same identifier-naming defect already found twice this pass at feed-unit and donation-unit — `documentId` against Contract 6's `id` — fixed by renaming to `id` before dispatching a fresh review, rather than waiting for the reviewer to catch a now-familiar pattern.
<!-- aidlc-wave-memory:pdf-library-unit:94f191ef408b0b7e4b97d57c3899f2e5893ffd745e063705c8dd03375368a8c0 -->


- 2026-09-14T11:10:00Z — Added BR7.11 (push delivery mechanism) beyond the two interview questions, to give FR7.3 a real traceability target — the delivery mechanism was otherwise only implicit in the DeviceToken entity and Register Device Token workflow, not stated as its own rule.
<!-- aidlc-wave-memory:reminder-unit:e41ade0c0bc2366e427d5e1d04c605bb99937a1fa874375e46e88b2b580b5705 -->


- 2026-09-14T12:15:00Z — Redo pass (Calendar & Reminders): added Screen 12 (Calendar) with a single navigation question (separate tab vs. view-toggle within Feed) rather than a full screen re-elicitation, since reminder-unit's already-completed Functional Design (Contract 9) had already pinned every data/interaction decision the screen needed.
<!-- aidlc-wave-memory:flutter-app-unit:cf1b4919ca583e6b00c6e38a7c4b8643906943943b22b0fbd8e1e91ad33260b4 -->

## Tradeoffs
<!-- example: 2026-05-29T10:14:32Z — picked TDD over BDD this run; the team is unit-first and the domain is well-understood -->


- 2026-09-14T05:11:23Z — Two business rules (BR1.3 revocation timing, BR1.4 no-first-sign-in-case) have no upstream FR — they arose from this stage's own clarifying questions. Recorded them as reverse N/A entries in traceability.json rather than forcing an artificial FR reference.
<!-- aidlc-wave-memory:auth-unit:d928025e98caf8a996b8e2f26f7f820a76599b121de09e8b7356f305039e13f7 -->


- 2026-09-14T05:19:31Z — Kept the question set to 3 (amount limits, frequency, cancellation) rather than also asking about donation receipts/confirmations, given this Unit is a later-release, placeholder-level design already flagged for revision once the real aggregator exists.
<!-- aidlc-wave-memory:donation-unit:ce2fa36db7846581b1dd74252f0af1a4c47131762ff2e872dfe407bc98aaf390 -->


- 2026-09-14T05:29:54Z — Modeled the Post lifecycle as a minimal two-state machine (NOT_DELETED -> DELETED) rather than folding age-out visibility into it, since age-out is a computed read-time filter (BR2.4), not a stored state transition — keeping the state machine to what's actually persisted state.
<!-- aidlc-wave-memory:feed-unit:651c50717b56f1afe8190b1bbc6816b7c8f61c1da5792e002b8456eddc22b2e4 -->


- 2026-09-14T05:39:05Z — Chose hard delete for documents (per the human's explicit Q3 answer) even though FeedUnit uses soft delete for posts — recorded as a deliberate per-unit difference, not an inconsistency to resolve, since the two Units have independent business needs (a document is a static file with no editable-and-reappear lifecycle like a post's dateTime).
<!-- aidlc-wave-memory:pdf-library-unit:f0f61ab35b8435d1cebc1cd949e08a0300d2cd77052ea064276a603ae0debc74 -->


- 2026-09-14T06:10:00Z — Kept `Suggestion` with no status/lifecycle field at all (unlike Post's soft-delete or Donation's state machine) — BR3.4 (no delete) and BR3.6 (no read/resolved tracking) are both stated as capability-boundary rules with no runtime check, since the entity has nothing to check against.
<!-- aidlc-wave-memory:suggestion-unit:44726043263a961f2aa7988154297ed7851939c5bef054cf63973275f357da02 -->


- 2026-09-14T06:45:00Z — Kept a single 5-tab bottom nav design (Feed/Suggest/Donate/Library/Account) rather than a separate navigation shell for later-release features, on the reasoning that a config/feature-flag hiding two tabs until their backend Units ship is simpler than redesigning navigation twice.
<!-- aidlc-wave-memory:flutter-app-unit:ca96f9b16daef4f2a1a9ebd24f593cc79321b9e31d428de23eea5d7fc5c3a285 -->


- 2026-09-14T11:10:00Z — Interpreted FR7.6's "auto-clears whether or not acted on" as applying only to SCHEDULED/SNOOZED reminders (never a FIRED one) — a FIRED reminder already delivered its notification and is already terminal, so there's nothing left to "clear." Recorded this as an explicit interpretation note in BR7.4 rather than leaving the state machine ambiguous about whether FIRED also transitions to CLEARED.
<!-- aidlc-wave-memory:reminder-unit:9a5cf266dff23fb90de27adca6b4e3400500e5d05063cb624686f5ba47102894 -->


- 2026-09-14T12:15:00Z — Chose Calendar as a separate bottom-nav tab (human's explicit choice) over folding it into Feed as a view-toggle, even though this pushes the eventual tab count to 6 once Donate/Library ship — exceeding the usual 5-tab guidance. Recorded as a disclosed, deliberate trade-off rather than silently picking the tab-count-friendlier option; the eventual restructuring (e.g. an overflow menu) is deferred to when Donate/Library actually ship.
<!-- aidlc-wave-memory:flutter-app-unit:1d257bdc6e1ed8d450ff70510780cb5c28b898a217fbccaa312798eaf7f2f8fd -->

## Open questions
<!-- example: 2026-05-29T10:14:32Z — confirm the retention window with compliance before the next stage hardens the schema -->

- 2026-09-14T05:11:23Z — None — all three questions were answered without residual ambiguity.
<!-- aidlc-wave-memory:auth-unit:86bb595651b500b17d188c48a35ec03b08ba058d271866719f3028087b2ab24b -->

- 2026-09-14T05:19:31Z — None beyond what's already in entities.md's Assumptions section (recurring-charge modeling) and contract-summary.md's existing Open Questions table (webhook payload shape).
<!-- aidlc-wave-memory:donation-unit:53ca6e7bd91453d819827130a0ca02a85457eb60eded9cea5b8f6368f975dd03 -->

- 2026-09-14T05:29:54Z — None — all three questions were answered without residual ambiguity.
<!-- aidlc-wave-memory:feed-unit:0dfb360a60e1b052123a37f7c1c2f1498f51144b0e41a6c6fb46542049990c0b -->

- 2026-09-14T05:39:05Z — None — all three questions were answered without residual ambiguity.
<!-- aidlc-wave-memory:pdf-library-unit:fe09a4c16f64a835276e066d7e33f4240ff91c3f280f887d049f20a65ee559ce -->

- 2026-09-14T06:10:00Z — None — both questions were answered without residual ambiguity.
<!-- aidlc-wave-memory:suggestion-unit:876a1a41aab3ec345120ccf9f685d8f26f2a9dd4da529d81a1c8b2da54b26b01 -->

- 2026-09-14T06:45:00Z — Mid-session, a new first-release feature request arrived (calendar view of events with day-before reminders, snooze, auto-clear, user-cancel-anytime) that was NOT part of the approved first-release scope this Unit's Functional Design was just confirmed against. The human chose to finish this Unit's current pass first and route the calendar/reminders feature as separate new work afterward — flagging here so the next session picks that up rather than assuming it is already covered.
<!-- aidlc-wave-memory:flutter-app-unit:abe260ab3b1ecbe298b18d0178f3f2f1b2593084d2e1c164d1f78c1e84aec00d -->

- 2026-09-14T10:55:00Z — Redo pass (Calendar & Reminders): this Unit needed no content changes at all — already used `id` correctly from its own iteration-2 fix earlier in the project. Reconfirmed its unchanged summary and re-saved artifacts as-is to satisfy the backward-jump guard's fresh-receipt requirement.
<!-- aidlc-wave-memory:suggestion-unit:fdd465ab64ee7d07c2e18011baf1c06f5c456cc10af332c891c05cd9cec8a69d -->

- 2026-09-14T11:10:00Z — None — both questions were answered without residual ambiguity.
<!-- aidlc-wave-memory:reminder-unit:a280e8adf4f3ebcb13768eee494eaf98687e8c2678443616207e28b3c07329dd -->

- 2026-09-14T12:15:00Z — RESOLVED (this pass): the calendar/reminders feature flagged above has now been fully routed through Requirements Analysis, Domain Design, Units Generation, Contract Design, reminder-unit's Functional Design, and this Unit's own Screen 12 addition. Nothing further deferred on this topic.
<!-- aidlc-wave-memory:flutter-app-unit:c3e196147eb706973f2e23bf10fe6df9b8b97982e32bc3a6606e1ac81df84085 -->
