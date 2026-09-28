<!-- INVARIANT: examples are single-line HTML comments so a fresh template parses to total=0 (MEMORY_EMPTY). Do NOT un-comment or split across lines. t100 guards this. -->
> This file is kept up to date automatically while the stage runs. Add observations at the review step, not by editing here directly.

## Interpretations
<!-- example: 2026-05-29T10:14:32Z — chose REST over GraphQL; the consuming team only needs CRUD, revisit if subscriptions land -->

## Deviations
- 2026-09-14T16:39:00Z — after the stage-level gate flagged R-01/R-02: corrected security-design.md's Threat model realization section — Spoofing's real mitigation is short-lived tokens + TLS (not PKCE, which protects the auth-code exchange, a different threat), and the section now walks all 5 STRIDE categories security-requirements.md's own table lists instead of 4.
- 2026-09-14T16:52:00Z — the re-review caught that "5" was itself wrong: security-requirements.md's NFR3.4 table actually has 6 rows (Elevation of Privilege was missed). Added it to both security-design.md and traceability.json.

## Tradeoffs
<!-- example: 2026-05-29T10:14:32Z — picked TDD over BDD this run; the team is unit-first and the domain is well-understood -->

## Open questions
<!-- example: 2026-05-29T10:14:32Z — confirm the retention window with compliance before the next stage hardens the schema -->
