# Entity Model — feed-unit

```yaml
entities:
  - name: Post
    description: >
      A single feed item — an event announcement, a visiting-dignitary
      announcement, or (once DonationUnit ships) a donation call-out. One
      shared shape across all three types, per Domain Design ADR-003.
    identifier: id
    attributes:
      - name: id
        type: UUID
        required: true
        unique: true
        description: Matches Contract 3's `id: ID!` field exactly (Amplify Data's default primary-key name); named `id`, not `postId`, to avoid a silent rename against the shared GraphQL contract.
      - name: type
        type: enum
        required: true
        allowed_values: [EVENT, VISITING_DIGNITARY, DONATION_CALL_OUT]
        description: DONATION_CALL_OUT is reserved for when DonationUnit ships (FR5.3); not used until then
      - name: title
        type: string
        required: true
        max_length: 100
      - name: description
        type: string
        required: true
        max_length: 1000
      - name: dateTime
        type: datetime
        required: true
        description: The event's date/time; editable by an admin after creation (Q2)
      - name: createdByGoogleId
        type: string
        required: true
        description: The Cognito identity (sub) of the admin who created the post, from Contract 1
      - name: createdAt
        type: datetime
        required: true
      - name: updatedAt
        type: datetime
        required: true
      - name: deletedAt
        type: datetime
        required: false
        description: >
          Set when an admin deletes the post (soft delete, Q3). A post with
          deletedAt set is excluded from every view — public reads and the
          admin's own post-management list alike.
    entity_constraints:
      - deletedAt is set if and only if the post has been deleted
      - A post with deletedAt set is never returned by any query this Unit exposes
    relationships: []
```

## Summary

FeedUnit owns exactly one entity, `Post`, shared across all three post types via a `type` discriminator, per Domain Design ADR-003. Its identifier is `id`, matching Contract 3's `id: ID!` exactly. Soft-delete (`deletedAt`) is new detail introduced at Functional Design (Q3) — Domain Design's entity list did not specify delete semantics at that level of detail, since entity capture there stayed at ownership+shape.

**Why the title/description length limits (Q1) did not require a Contract 3 amendment**: GraphQL's type system has no native max-length constraint — `title: String!` already expresses "a required string" at the schema level, and a length cap is enforced by the resolver, not declared in the schema. The limit is therefore correctly a `rules.md` entry (BR2.2) rather than a schema change, unlike `deletedAt` or the age-out-bypass queries, which are actual API-surface additions.
