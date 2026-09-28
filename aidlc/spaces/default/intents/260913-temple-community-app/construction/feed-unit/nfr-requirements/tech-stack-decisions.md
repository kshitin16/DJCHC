# Tech Stack Decisions — feed-unit

| Choice | Selection | Rationale |
|---|---|---|
| Data store | Amplify Data (DynamoDB), one `Post` table with DynamoDB Streams enabled | Fixed from Domain/Contract Design; Streams is required for Contract 8's event feed to ReminderUnit |
| Client SDK | `amplify_api` (GraphQL) via `services/feed_service.dart` | Matches team.md's firm layer-boundary rule |
| Age-out filter (BR2.4) | Server-side resolver logic (compares `dateTime` to current time at read), not a stored/computed attribute | Keeps the filter dynamic — an edit to `dateTime` (BR2.5) is picked up immediately on the next read with no separate recompute step |

No new technology beyond what Domain Design/Contract Design already fixed — this stage sets concrete NFR targets against that already-chosen stack.
