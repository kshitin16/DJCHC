# Tech Stack Decisions — suggestion-unit

| Choice | Selection | Rationale |
|---|---|---|
| Authorization mechanism | Declarative AppSync/Amplify Data auth rules (`allow: owner`, `allow: groups`) on the Contract 4 schema, rather than resolver-level checks | Fixed from Functional Design (BR3.3); a stronger guarantee than the server-side-check pattern other Units use — no resolver code path exists that could get the check wrong |
| Rate-limit enforcement | Single atomic DynamoDB conditional UpdateItem (BR3.5) | Matches this project's own established atomic-write practice for hard per-user caps, avoiding a read-then-write race |
| Client SDK | `amplify_api` (GraphQL) via `services/suggestion_service.dart` | Matches team.md's firm layer-boundary rule |

No new technology beyond what Domain Design/Contract Design already fixed — this stage sets concrete NFR targets against that already-chosen stack.
