# Functional Design — Questions (flutter-app-unit)

## Sources

- [scope] Workflow-selected scope: `temple-mobile-app`.

Consumed upstream artifacts:
- `aidlc/spaces/default/intents/260913-temple-community-app/inception/units-generation/unit-of-work.md` (FlutterAppUnit definition)
- `aidlc/spaces/default/intents/260913-temple-community-app/inception/units-generation/unit-of-work-story-map.md` (FR4.1 assigned directly; also consumes every other Unit's FRs indirectly as the presentation layer)
- `aidlc/spaces/default/intents/260913-temple-community-app/inception/requirements-analysis/requirements.md`
- `aidlc/spaces/default/intents/260913-temple-community-app/inception/domain-design/components.md`
- `aidlc/spaces/default/intents/260913-temple-community-app/inception/contract-design/contract-summary.md` (all 6 in-system contracts — this Unit is the sole consumer of Contracts 1-6)
- `aidlc/spaces/default/intents/260913-temple-community-app/ideation/rough-mockups/wireframes.md` (6 first-release screens, IA, states)

## Q1. `allSuggestions` (Contract 4) lets an admin read every submitted suggestion, but no wireframe screen exists for it — `wireframes.md` only designed an Admin Post List (Screen 6), not an admin suggestions view. FR3.3 requires suggestions be admin-visible; how should that happen in this release?

- A. Add an in-app Admin Suggestions screen this release (read-only list, no actions — matching FR3.5's "no read/resolved-tracking")
- B. Defer to a non-app method for now (e.g. an admin queries the data directly via AWS Console/AppSync console), matching the admin-allowlist's backend-only precedent from Domain Design — no in-app screen this release
- C. Not yet defined
- X. Other (please specify)

[Answer]: A. Add an in-app Admin Suggestions screen this release (read-only list, no actions — matching FR3.5's "no read/resolved-tracking")

## Q2. FR4.1 requires English + Hindi support. `wireframes.md` doesn't specify the switching mechanism. How should the app choose/change language?

- A. Auto-detect the device's system locale; no in-app override
- B. Auto-detect the device's system locale, with a manual override toggle on the Account screen
- C. Manual language selection only (no auto-detect); user picks on first launch and can change later
- X. Other (please specify)

[Answer]: B. Auto-detect the device's system locale, with a manual override toggle on the Account screen

## Q3. Donations (FR5) and the PDF Library (FR6) are later-release capabilities. Their backend Units (donation-unit, pdf-library-unit) already completed Functional Design with full GraphQL contracts, but `wireframes.md` only covers the first-release screens — no Donation or PDF Library screens were wireframed. Since Domain Design already chose to map the whole domain now (not just first release), should this Unit's Functional Design also define the Donation and PDF Library screens' workflows now, or stay scoped to the 6 wireframed first-release screens?

- A. Define Donation and PDF Library screen workflows now too, deriving reasonable screen flows from their existing GraphQL contracts and the established wireframe conventions (hub-and-spoke navigation, card-list style, inline confirm/error states) — keeps the whole app's functional design complete together, consistent with the Domain Design decision
- B. Scope this pass to the 6 first-release wireframed screens only; revisit Donation/PDF Library screen design in a future pass once FR5.4's tax-exemption precondition clears and those Units are actually built
- X. Other (please specify)

[Answer]: A. Define Donation and PDF Library screen workflows now too, deriving reasonable screen flows from their existing GraphQL contracts and the established wireframe conventions (hub-and-spoke navigation, card-list style, inline confirm/error states) — keeps the whole app's functional design complete together, consistent with the Domain Design decision

## Consolidated Summary Confirmation

- Add an in-app Admin Suggestions screen this release — read-only, no actions.
- Language: auto-detect the device locale, with a manual override toggle on the Account screen.
- Define Donation and PDF Library screen workflows now too, derived from their existing GraphQL contracts and the established wireframe conventions.

Does this all look correct before I generate the artifact?

- Looks correct
- Request changes

[Answer]: Looks correct
