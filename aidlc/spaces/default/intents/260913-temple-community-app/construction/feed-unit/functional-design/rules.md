# Business Rules — feed-unit

```yaml
rules:
  - id: BR2.1
    statement: >
      A post's type must be one of EVENT, VISITING_DIGNITARY, or (once
      DonationUnit ships) DONATION_CALL_OUT.
    category: validation
    applies_to: Create/edit Post workflow
    trigger: A post is created or edited
    logic: IF type is not one of the declared values THEN reject.
    violation_behaviour: An unrecognized type value is rejected before the post is saved.
    source: FR2.2, FR5.3

  - id: BR2.2
    statement: A post's title must not exceed 100 characters; its description must not exceed 1000 characters.
    category: validation
    applies_to: Create/edit Post workflow
    trigger: A post is created or edited
    logic: IF title length <= 100 AND description length <= 1000 THEN accept; ELSE reject.
    violation_behaviour: A post exceeding either limit is rejected with a specific validation error.
    source: FR2.1, Functional Design Q1

  - id: BR2.3
    statement: Only an identity in the Admin group (Contract 2) may create, edit, or delete a post.
    category: authorization
    applies_to: Create/edit/delete Post workflow
    trigger: A create, edit, or delete operation is attempted
    logic: IF the caller's cognito:groups claim contains "Admin" THEN allow; ELSE refuse.
    violation_behaviour: A non-admin attempting any mutation is refused.
    source: FR2.5

  - id: BR2.4
    statement: >
      The public feed view returns non-deleted posts, most-recent dateTime
      first, excluding any post whose dateTime is more than 1 day in the
      past.
    category: policy
    applies_to: List Posts workflow
    trigger: Any reader (signed in or not) requests the feed
    logic: >
      IF deletedAt is unset AND dateTime is within 1 day (inclusive) of the
      current time or in the future THEN include in the default view;
      ELSE exclude from the default view (but do not delete the record).
    violation_behaviour: N/A — this rule defines the read filter itself.
    source: FR2.3, FR2.4, FR2.6

  - id: BR2.5
    statement: >
      Editing a post's dateTime re-evaluates its inclusion in the default
      feed view against the current time — editing an aged-out post's
      dateTime to the future brings it back into the default view.
    category: policy
    applies_to: Edit Post workflow
    trigger: An admin edits a post's dateTime
    logic: >
      IF a post's dateTime is edited THEN BR2.4's filter is re-applied
      using the new dateTime value, not the original one.
    violation_behaviour: N/A — this rule clarifies that the age-out filter is dynamic, not a one-time decision made at creation.
    source: FR2.4, Functional Design Q2

  - id: BR2.6
    statement: >
      Deleting a post is a soft delete — it sets deletedAt rather than
      removing the record, and a deleted post is excluded from every view
      this Unit exposes, including the admin's own post-management list.
    category: policy
    applies_to: Delete Post workflow
    trigger: An admin deletes a post
    logic: IF an admin deletes a post THEN set deletedAt to the current time; the record is retained but excluded from all reads.
    violation_behaviour: N/A — this rule defines delete semantics; recovering a soft-deleted post is not an app feature (would require direct data access).
    source: FR2.5, Functional Design Q3

  - id: BR2.7
    statement: >
      The admin post-management view returns every non-deleted post
      regardless of the 1-day age-out filter, so an admin can find and edit
      a post that has already aged out of the public feed.
    category: authorization
    applies_to: Admin post-management view (list and get)
    trigger: An admin requests the management view, or a specific post by id, to edit it
    logic: >
      IF the caller's cognito:groups claim contains "Admin" THEN return
      non-deleted posts without applying BR2.4's age-out filter; ELSE
      refuse (only listPosts, the public view, is available to non-admins).
    violation_behaviour: A non-admin calling the admin-only management query is refused.
    source: Functional Design Q2 (surfaced during review — the age-out re-evaluation rule, BR2.5, is unimplementable without this)
```

## Summary

| Rule | Category | What it governs |
|---|---|---|
| BR2.1 | Validation | Post type must be a declared value |
| BR2.2 | Validation | Title/description length limits |
| BR2.3 | Authorization | Only admins can create/edit/delete |
| BR2.4 | Policy | Public read filter: non-deleted, not aged-out, reverse-chronological |
| BR2.5 | Policy | Editing dateTime re-evaluates age-out |
| BR2.6 | Policy | Delete is soft (deletedAt), hidden from every view |
| BR2.7 | Authorization | Admin management view bypasses the age-out filter |
