<!-- INVARIANT: examples are single-line HTML comments so a fresh template parses to total=0 (MEMORY_EMPTY). Do NOT un-comment or split across lines. t100 guards this. -->
> This file is kept up to date automatically while the stage runs. Add observations at the review step, not by editing here directly.

## Interpretations
- 2026-09-14T05:29:54Z — Learning from donation-unit's review: checked whether the new deletedAt field needed to be surfaced in Contract 3 before generating artifacts, rather than waiting for the reviewer to catch a drift. Concluded it does not — a soft-deleted post is never returned by any query, so FlutterAppUnit never needs to represent a 'deleted' state, unlike donation-unit's CANCELLED status which is user-visible. No contract amendment made.
<!-- example: 2026-05-29T10:14:32Z — chose REST over GraphQL; the consuming team only needs CRUD, revisit if subscriptions land -->

## Deviations
- 2026-09-14T05:36:22Z — Iteration 1 review (NOT-READY, 1 Critical + 1 Major + 1 Minor) found that BR2.5's own scenario (editing an aged-out post's date to bring it back) was unimplementable against Contract 3 as written — listPosts filters age-out server-side with no way for anyone, admin included, to retrieve an aged-out post's id. Fixed by amending Contract 3 additively (listAllPostsForAdmin, getPost queries), adding BR2.7 (admin management view bypasses age-out), and a new 'List Posts (admin management view)' workflow. Also added infrastructure-error paths to the Create/Edit/Delete workflows (previously only covered business-rule refusals) and closed the asymmetric-rationale minor finding by documenting why length limits don't need a contract change (GraphQL has no native max-length) directly in entities.md.
- 2026-09-14T05:29:54Z — None — followed the standard 3-question interview and full artifact generation for a service-kind unit.
- 2026-09-14T10:35:00Z — Redo pass (Calendar & Reminders): while reconfirming this Unit's unchanged summary, caught two real pre-existing defects before generating anything: (1) the entity identifier was still `postId` against Contract 3's `id` — the same defect class this project has now caught three times (suggestion-unit, donation-unit, and here), fixed by renaming to `id`; (2) Contract 8's `PostDeleted` event (drafted during Contract Design without direct access to this Unit's own delete semantics) assumed a DynamoDB REMOVE record, but this Unit's own BR2.6 is an explicit soft delete — no REMOVE ever occurs. Fixed by amending Contract 8 to key `PostDeleted` off a MODIFY record where deletedAt transitions to set, not a REMOVE record. Also closed the long-disclosed R-04 gap (BR2.7 missing from the Rules Summary table) now that the file was being touched anyway for a real reason, rather than waiting for a third disclosure.
<!-- example: 2026-05-29T10:14:32Z — skipped the optional caching layer the stage prose suggested; the dataset is small enough that it adds risk -->

## Tradeoffs
- 2026-09-14T05:29:54Z — Modeled the Post lifecycle as a minimal two-state machine (NOT_DELETED -> DELETED) rather than folding age-out visibility into it, since age-out is a computed read-time filter (BR2.4), not a stored state transition — keeping the state machine to what's actually persisted state.
<!-- example: 2026-05-29T10:14:32Z — picked TDD over BDD this run; the team is unit-first and the domain is well-understood -->

## Open questions
- 2026-09-14T05:29:54Z — None — all three questions were answered without residual ambiguity.
<!-- example: 2026-05-29T10:14:32Z — confirm the retention window with compliance before the next stage hardens the schema -->
