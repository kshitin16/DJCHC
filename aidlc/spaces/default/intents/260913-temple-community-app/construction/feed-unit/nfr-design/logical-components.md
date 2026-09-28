# Logical Components — feed-unit

## Component inventory

| Component | Nature | Failure domain |
|---|---|---|
| `Post` DynamoDB table | Data store, shared Amplify Data backend, with DynamoDB Streams enabled (Q2) | Shared AWS region/account failure domain, same as every other Unit's tables |
| AppSync resolvers (listPosts, listAllPostsForAdmin, getPost, createPost, updatePost, deletePost) | Part of the shared AppSync API | Same as above |
| DynamoDB Streams event source | AWS-managed, attached to the `Post` table with `StreamViewType: NEW_AND_OLD_IMAGES` (security-design.md, corrected at R-02 — required so `PostDeleted`'s old/new-image diff is even possible) | Belongs to FeedUnit's table but is CONSUMED by ReminderUnit's Lambda (Q2) — the event-source-mapping/trigger configuration itself lives in ReminderUnit's infrastructure, not this Unit's |

## Blast radius

FeedUnit's own resolvers and table are isolated in the same way every AppSync/DynamoDB-backed Unit in this project is (shared backend, no dedicated compute of its own beyond auth-unit's pattern). The one cross-Unit coupling is Contract 8: enabling/disabling Streams on this table, or a schema change to `Post`, has a downstream effect on ReminderUnit's Lambda — a dependency this Unit's design must not silently break (e.g. removing a field ReminderUnit's Lambda reads from stream records).

## Shared resources

None shared with another Unit's own components in the write direction — `Post` is FeedUnit's own table. In the read direction, ReminderUnit reads `Post` via `listPosts` (Contract 3) and via the Streams event source, both established boundaries, not ad-hoc coupling.
