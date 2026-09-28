# Entity Model — suggestion-unit

```yaml
entities:
  - name: Suggestion
    description: A free-text suggestion submitted by a signed-in user, visible only to its submitter and to admins.
    identifier: id
    attributes:
      - name: id
        type: UUID
        required: true
        unique: true
        description: Matches Contract 4's `id: ID!` field exactly (Amplify Data's default primary-key name); this entity's identifier is named `id`, not `suggestionId`, to avoid a silent rename against the shared GraphQL contract.
      - name: submittedByGoogleId
        type: string
        required: true
        description: The Cognito identity (sub) of the submitting user, from Contract 1
      - name: text
        type: string
        required: true
        max_word_count: 300
        description: >
          Free text, up to 300 WORDS — not characters (FR3.1, BR3.1). Word
          count is computed by trimming the text and splitting on
          whitespace; the resulting token count must be <= 300. Enforced
          server-side at submission time.
      - name: submittedAt
        type: datetime
        required: true
        description: Also used to compute the submitter's daily submission count for the rate limit (BR3.5)
    entity_constraints:
      - No delete capability in this release — a Suggestion is permanent once created (Q1)
      - No admin read/resolved-tracking fields — admins can list all suggestions (FR3.3) but there is no mechanism to mark one read or resolved (FR3.5)
    relationships: []
```

## Internal rate-limit tracking (not part of Contract 4)

The 5-per-day submission cap (BR3.5) is enforced with a per-user-per-day
counter, tracked internally by this Unit and never exposed through Contract
4's GraphQL surface:

```yaml
internal_tracking:
  - name: SuggestionDailyCount
    description: >
      Internal-only counter, not a GraphQL-visible entity and not part of
      Contract 4. One item per (submittedByGoogleId, calendar day in IST).
    key: "{submittedByGoogleId}#{YYYY-MM-DD in Asia/Kolkata}"
    attributes:
      - name: count
        type: integer
        description: Number of suggestions submitted by this user on this IST calendar day
    write_pattern: >
      A single atomic conditional update (DynamoDB UpdateItem with
      `ADD count :one` and a condition expression `count < :five OR
      attribute_not_exists(count)`) both checks and increments in one
      request. If the condition fails, the submission is rejected as
      over the daily limit; if it succeeds, the Suggestion record is then
      created. This closes the race BR3.5 flagged: two near-simultaneous
      submissions cannot both pass, because the conditional increment is
      atomic at the data layer, not a separate read-then-write.
```

## Summary

SuggestionUnit owns exactly one Contract-visible entity, `Suggestion`. There is no `deletedAt` or status field — suggestions are permanent once submitted (Q1) and carry no admin-workflow state, matching FR3.5. Its identifier is `id`, matching Contract 4's `id: ID!` exactly.

The confirmed 5-per-day submission limit (Q2/Q2a) is enforced via the internal `SuggestionDailyCount` counter above (atomic conditional increment), not by counting existing `Suggestion` records at request time — the two would be equivalent in isolation but only the atomic-counter approach is race-free under concurrent submissions. This needs no amendment to Contract 4: the limit is server-side resolver logic on `submitSuggestion`, invisible to the GraphQL client, so it stays internal to this Unit.
