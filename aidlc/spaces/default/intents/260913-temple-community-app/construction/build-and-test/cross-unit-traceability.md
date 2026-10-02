# Cross-Unit Final Coverage Gate

## Sources

- [scope] Workflow-selected scope: `temple-mobile-app`. User Stories (2.4) was SKIP, so there are no three-segment `AC` IDs to enumerate; traceability runs to requirements directly.
- Enumerated from: `inception/requirements-analysis/requirements.md`.
- Checked against: all seven `construction/*/code-generation/traceability.json` files. No stage-level `construction/code-generation/traceability.json` exists (this is a multi-unit scope).

## Verdict: **FAIL** — 3 findings

Two are substantive. One is an organisational precondition that cannot be covered
by code and is recorded as `N/A` rather than a defect.

## Functional requirements — 29 enumerated

| Range | Covered `OK` | Owning unit(s) |
|---|---|---|
| FR1.1–FR1.3 | Yes | auth-unit, flutter-app-unit |
| FR2.1–FR2.6 | Yes | feed-unit, flutter-app-unit |
| FR3.1–FR3.5 | Yes | suggestion-unit, flutter-app-unit |
| FR4.1 | Yes | reminder-unit |
| FR5.1–FR5.3 | Yes | donation-unit (built, flag-gated off) |
| **FR5.4** | **No** | — see finding X-1 |
| FR6.1–FR6.2 | Yes | pdf-library-unit, flutter-app-unit |
| FR7.1–FR7.8 | Yes | reminder-unit, flutter-app-unit |

28 of 29 covered. Every `OK` target names a file that exists.

## Non-functional requirements — 8 enumerated

| ID | Subject | Exact-ID citation | Substantive coverage |
|---|---|---|---|
| NFR1 | Performance | No | Yes, via per-unit `NFR1.x` / `NFR-PERF.x` children — but all Unverified, see summary |
| NFR2 | Scalability | No | Yes, via per-unit `NFR2.x` / `NFR-SC.x` children |
| NFR3 | Security | No | Yes, via per-unit `NFR3.x` children; verified in source |
| NFR4 | Data protection | No | Yes — encryption at rest and in transit, per-unit |
| NFR5 | Reliability | No | Yes, via per-unit `NFR5.x` children |
| NFR6 | Change review | No | Process control, no code artefact; recorded in README |
| **NFR7** | **Accessibility (WCAG AA)** | No | **No — see finding X-2** |
| NFR8 | Testability | No | Yes — test-after, smoke bar for the skeleton, 80% floor past it, all met |

## Findings

### X-1 — FR5.4 uncovered (`N/A`, not a defect)

> **FR5.4** — This release is blocked on the temple's tax-exemption status being
> confirmed with the aggregator, and depends on donations remaining domestic-only
> (no FCRA registration exists).

This is an organisational precondition, not an implementable requirement. No code
artefact can satisfy it, so no unit could have claimed it. It is correctly absent
from every `traceability.json`.

**Status: `N/A`.** It should be tracked as a release blocker for the donations
feature, not as a coverage gap. Donations are already flag-gated off, so nothing
ships against it.

### X-2 — NFR7 (accessibility) is not addressed anywhere

> **NFR7** — **Accessibility**: standard WCAG AA baseline — no special large-text
> or simplified-navigation treatment beyond that baseline.

No unit claims NFR7, and nothing in the app implements toward it. A grep over all
of `lib/` finds **zero** uses of `Semantics(` or `semanticLabel`, and there is no
accessibility test of any kind — no automated WCAG check, no screen-reader pass,
no contrast assertion.

This is a real gap and it is the kind only a cross-unit gate can catch: each unit
reviewed its own slice, and accessibility belongs to no single slice. The per-unit
reviews all returned READY without it ever surfacing.

What WCAG AA would need at minimum for this app: semantic labels on the icon-only
controls (bottom navigation, admin floating action button, calendar day cells,
reminder status badges), a contrast check on the temple-theme palette, text that
scales with the OS font-size setting, and a keyboard/screen-reader traversal of
the twelve screens.

**Status: `GAP`.** It needs an owner — either a follow-up pass in this workflow or
a recorded, deliberate decision to defer it.

### X-3 — `FR6.3` is an orphan

A `traceability.json` `upstream_ids` array cites `FR6.3`, but
`requirements-analysis/requirements.md` defines only FR6.1 and FR6.2. The ID does
not exist upstream.

Harmless in effect — nothing depends on it and no coverage claim rests on it — but
it means one unit's upstream list was not checked against the requirements
document. **Status: `ORPHAN`.** Remove the ID or add the missing requirement.

## What passed

- 28 of 29 functional requirements covered `OK` with existing target files.
- Six of eight NFRs substantively covered through their per-unit detailed children.
- No contradictions found between units' claims.
- No `OK` status pointing at a missing file.

## Note on the NFR chain

No unit cites an inception NFR ID exactly; each uses detailed per-unit IDs whose
numbering mirrors the parent by convention (`NFR3.2` under inception `NFR3`). The
mapping is legible to a human but not machine-verifiable, so a tool cannot prove
the top-level IDs are covered. That is a traceability-convention weakness rather
than a coverage gap, and it is why X-2 went unnoticed until this gate: an
automated check could not have caught it either.
