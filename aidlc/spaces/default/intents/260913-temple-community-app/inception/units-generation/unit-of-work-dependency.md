# Unit of Work Dependency — Digamber Jain Temple Community App

This describes topology only — what depends on what. It does not recommend a build order or identify a critical path; that is Delivery Planning's (2.9) job.

> **Amended** — `U7 (ReminderUnit)` added via a redo pass (backward jump from `nfr-requirements`) after the builder requested a new first-release Calendar & Reminders capability mid-Construction. See `unit-of-work.md`'s U7 entry and `units-generation-questions.md` (Calendar & Reminders addition).

## Dependency DAG (prose)

- **U1 (AuthUnit)** depends on nothing.
- **U2 (FeedUnit)** depends on U1 — verifies admin allowlist membership before a post mutation.
- **U3 (SuggestionUnit)** depends on U1 — resolves the signed-in user's identity to attribute a suggestion.
- **U4 (DonationUnit)** depends on U1 — resolves the signed-in user's identity to attribute a donation.
- **U5 (PdfLibraryUnit)** depends on U1 — verifies admin allowlist membership before a document upload.
- **U7 (ReminderUnit)** depends on U2 — reads Event-type post data (type, dateTime) to schedule reminders, and receives notice when a post's dateTime changes so a scheduled reminder can be rescheduled. It does NOT depend on U1 — reminder ownership uses a Cognito guest identity, not a signed-in Google identity.
- **U6 (FlutterAppUnit)** depends on U1, U2, U3, U4, U5, and U7 — consumes every backend Unit's generated Amplify client API through its `services/` layer.

U2, U3, U4, and U5 have no edges between them — each depends only on U1, and none of the four depend on each other. Per the confirmed decision (Q3), this map shows that real independence rather than collapsing it into one strict chain. U7 is the one Unit with a dependency on another non-Auth Unit (U2), reflecting its own component-level dependency on FeedComponent rather than AuthComponent.

## Integration Points

| From | To | What crosses the boundary |
|---|---|---|
| U2, U3, U4, U5 | U1 | Shared identity/authorization state — a Cognito group-membership check, not a runtime API call between separately deployed services, since all five backend Units live in one Amplify Gen2 app and one Cognito user pool. |
| U7 | U2 | Read access to Event-type `Post` data (type, dateTime) plus a dateTime-change notice for rescheduling — not a Cognito identity check, since U7 uses its own guest-identity model. |
| U6 | U1, U2, U3, U4, U5, U7 | Amplify's generated GraphQL API (AppSync) for data, and the Amplify Auth client SDK for sign-in — called only from U6's `services/` layer, per the firm layer-boundary rule affirmed in Practices Discovery. |

## Parallel Development Opportunities

U2 (FeedUnit), U3 (SuggestionUnit), U4 (DonationUnit), and U5 (PdfLibraryUnit) form one independent set — none depends on any of the others, only on U1. Multiple valid topological orderings exist among them once U1 exists. U7 (ReminderUnit) can be built in parallel with U3, U4, and U5 once U2 exists — it has no dependency on U1, U3, U4, or U5. U6 (FlutterAppUnit) is the sink of the graph and depends on all six backend/logic Units.

## Machine-Readable Edge Block

```yaml
units:
  - name: auth-unit
    kind: service
    depends_on: []
  - name: feed-unit
    kind: service
    depends_on: [auth-unit]
  - name: suggestion-unit
    kind: service
    depends_on: [auth-unit]
  - name: donation-unit
    kind: service
    depends_on: [auth-unit]
  - name: pdf-library-unit
    kind: service
    depends_on: [auth-unit]
  - name: reminder-unit
    kind: service
    depends_on: [feed-unit]
  - name: flutter-app-unit
    kind: ui
    depends_on: [auth-unit, feed-unit, suggestion-unit, donation-unit, pdf-library-unit, reminder-unit]
```

## Assumptions & Open Questions

None.
