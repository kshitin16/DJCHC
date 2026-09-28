<!-- INVARIANT: examples are single-line HTML comments so a fresh template parses to total=0 (MEMORY_EMPTY). Do NOT un-comment or split across lines. t100 guards this. -->
> This file is kept up to date automatically while the stage runs. Add observations at the review step, not by editing here directly.

## Interpretations
- 2026-09-14T06:10:00Z — The confirmed 5-per-day submission limit (Q2/Q2a) is implemented as server-side resolver logic that counts the caller's existing same-day Suggestion records, rather than as a new counter field or a Contract 4 amendment — Contract 4's submitSuggestion mutation already carries everything the resolver needs (submittedByGoogleId, submittedAt on existing records), so unlike donation-unit/feed-unit/pdf-library-unit this Unit needed no proactive contract change.
<!-- example: 2026-05-29T10:14:32Z — chose REST over GraphQL; the consuming team only needs CRUD, revisit if subscriptions land -->

## Deviations
- 2026-09-14T06:10:00Z — None — followed the standard 2-question interview (plus one confirmation follow-up).
- 2026-09-14T06:30:00Z — Iteration 1 review (NOT-READY, 4 Major + 2 Minor) found: (1) the entity identifier was named `suggestionId` throughout while Contract 4 names it `id` — fixed by renaming to `id` and noting the alignment explicitly; (2) `max_length: 300` on `text` read as a character cap when the actual rule is a 300-word cap — fixed by renaming to `max_word_count` and specifying whitespace-tokenized counting; (3) BR3.5's "count then create" rate-limit check was a non-atomic read-then-write, vulnerable to two near-simultaneous submissions both passing — fixed by introducing an internal (non-Contract-4) `SuggestionDailyCount` counter enforced via a single atomic DynamoDB conditional UpdateItem; (4) the admin-only `allSuggestions` / owner-only `myPastSuggestions` queries never stated their enforcement layer — fixed by specifying AppSync/Amplify Data declarative `@auth` rules (group auth for admin, owner auth for self) in BR3.3 and both workflows. Also addressed two Minor findings: (5) "calendar day" now explicitly means IST (Asia/Kolkata), matching the temple community's timezone; (6) the admin all-suggestions list now states "newest first" ordering, matching the submitter's own list.
<!-- example: 2026-05-29T10:14:32Z — skipped the optional caching layer the stage prose suggested; the dataset is small enough that it adds risk -->

## Tradeoffs
- 2026-09-14T06:10:00Z — Kept `Suggestion` with no status/lifecycle field at all (unlike Post's soft-delete or Donation's state machine) — BR3.4 (no delete) and BR3.6 (no read/resolved tracking) are both stated as capability-boundary rules with no runtime check, since the entity has nothing to check against.
<!-- example: 2026-05-29T10:14:32Z — picked TDD over BDD this run; the team is unit-first and the domain is well-understood -->

## Open questions
- 2026-09-14T06:10:00Z — None — both questions were answered without residual ambiguity.
- 2026-09-14T10:55:00Z — Redo pass (Calendar & Reminders): this Unit needed no content changes at all — already used `id` correctly from its own iteration-2 fix earlier in the project. Reconfirmed its unchanged summary and re-saved artifacts as-is to satisfy the backward-jump guard's fresh-receipt requirement.
<!-- example: 2026-05-29T10:14:32Z — confirm the retention window with compliance before the next stage hardens the schema -->
