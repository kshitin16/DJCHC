# Business Rules — suggestion-unit

```yaml
rules:
  - id: BR3.1
    statement: >
      A suggestion's text must be free text, up to 300 WORDS — not
      characters. Word count is computed by trimming the text and
      splitting on whitespace; the resulting token count must be <= 300.
    category: validation
    applies_to: Submit Suggestion workflow
    trigger: A suggestion is submitted
    logic: IF the whitespace-tokenized word count of text exceeds 300 THEN reject.
    violation_behaviour: A submission over the 300-word limit is rejected before it is saved.
    source: FR3.1

  - id: BR3.2
    statement: Every suggestion is tied to the submitting user's identity; there is no anonymous submission option.
    category: authorization
    applies_to: Submit Suggestion workflow
    trigger: A suggestion is submitted
    logic: submittedByGoogleId is set to the caller's identity (Contract 1); an unauthenticated caller cannot submit.
    violation_behaviour: An unauthenticated submission attempt is refused.
    source: FR3.2

  - id: BR3.3
    statement: >
      A suggestion is visible only to its submitter and to admins — never
      to other non-admin users. This is enforced DECLARATIVELY at the
      AppSync/Amplify Data authorization layer, not only in application
      code: `myPastSuggestions` carries an owner-field auth rule
      (`allow: owner`, keyed on submittedByGoogleId) and `allSuggestions`
      carries a group auth rule (`allow: groups, groups: ["Admin"]`). A
      non-admin cannot reach `allSuggestions`, and no caller can read
      another user's suggestions via `myPastSuggestions`, regardless of
      client-side behaviour — the GraphQL endpoint itself refuses the
      request before any resolver logic runs.
    category: authorization
    applies_to: View Suggestions workflow
    trigger: A user requests suggestions
    logic: IF the caller is the submitter (submittedByGoogleId = caller's identity, enforced via owner auth) OR the caller is in the Admin group (Contract 2, enforced via group auth) THEN allow visibility; ELSE the AppSync authorization layer refuses the request.
    violation_behaviour: A non-admin, non-submitter cannot read another user's suggestion; the refusal happens at the authorization layer, before any query executes.
    source: FR3.3, FR3.4

  - id: BR3.4
    statement: Suggestions are permanent once submitted — there is no delete capability in this release, for either the submitter or an admin.
    category: policy
    applies_to: Submit/View Suggestion workflow
    trigger: N/A — this rule states the absence of a delete operation
    logic: N/A — no delete mutation exists in Contract 4 or this Unit.
    violation_behaviour: N/A — this rule defines a capability boundary, not a runtime check.
    source: Functional Design Q1

  - id: BR3.5
    statement: >
      A user may submit at most 5 suggestions per calendar day, where
      "calendar day" means the IST (Asia/Kolkata) day, matching the
      temple community's own timezone. Enforcement is atomic: a single
      conditional DynamoDB update against an internal per-user-per-day
      counter (SuggestionDailyCount, see entities.md) both checks and
      increments the count in one request, so two near-simultaneous
      submissions cannot both pass — there is no separate read-then-write
      that could race.
    category: validation
    applies_to: Submit Suggestion workflow
    trigger: A suggestion is submitted
    logic: >
      ATOMICALLY (via a conditional UpdateItem with `ADD count :one` and
      condition `count < 5 OR attribute_not_exists(count)` on the
      SuggestionDailyCount item keyed by submittedByGoogleId + today's
      IST date): IF the conditional increment succeeds THEN create the
      Suggestion record; ELSE reject the submission.
    violation_behaviour: The 6th same-day (IST) submission attempt is rejected at the atomic-counter step, before a Suggestion record is created; the user can submit again after IST midnight.
    source: Functional Design Q2, Q2a

  - id: BR3.6
    statement: Admins have no read/resolved-tracking mechanism for suggestions — reading the full list (BR3.3) is the only admin capability; there is no way to mark a suggestion as read, actioned, or resolved.
    category: policy
    applies_to: View Suggestions workflow (admin)
    trigger: N/A — this rule states the absence of a tracking mechanism
    logic: N/A — no such mutation exists in Contract 4 or this Unit.
    violation_behaviour: N/A — this rule defines a capability boundary, not a runtime check.
    source: FR3.5
```

## Summary

| Rule | Category | What it governs |
|---|---|---|
| BR3.1 | Validation | Suggestion text up to 300 words (not characters) |
| BR3.2 | Authorization | No anonymous submission; tied to caller identity |
| BR3.3 | Authorization | Visible only to submitter (self) or admin (all), enforced via AppSync owner/group auth |
| BR3.4 | Policy | No delete capability — suggestions are permanent |
| BR3.5 | Validation | Max 5 submissions per person per IST calendar day, atomically enforced |
| BR3.6 | Policy | No admin read/resolved-tracking mechanism |
