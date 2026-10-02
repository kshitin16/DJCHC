# Self-review before merging `first-aws-provisioning`

`project.md` Mandated: *"ALWAYS give any change touching sign-in, permissions,
or (later) payment handling a brief self-review before merging, even though the
builder is working solo."* This branch touches sign-in and permissions, so here
it is. Dated 2026-10-02.

## Sign-in surface

**`amplify/auth/resource.ts`** — the only functional change is three additions
to `attributeMapping`: `emailVerified`, `givenName`, `familyName`. Purely
additive. It does not change who may sign in, how they authenticate, the OAuth
flow, token lifetimes, or what `cognito:groups` carries. It causes Cognito to
store three claims Google was already sending and the pool was discarding.

Checked specifically: `givenName`/`familyName` are NOT declared under
`userAttributes`. Declaring them attempts a user-pool schema change, which
Cognito rejects and which wedged the auth stack badly enough on 2026-10-01 to
require deleting and recreating the sandbox. The comment in the file records
this so it is not re-attempted.

**`amplify/auth/token-policy.ts`** — type definitions and a defensive
`isPlainObject` merge helper for `adminCreateUserConfig`. No behavioural change
to the policy itself; the existing tests still assert that Amplify's config is
merged rather than clobbered, and that an unresolved CDK token is never spread.

**Verified against the deployed pool**, not just read: public App Client with no
secret, Authorization Code flow, 60-minute access and ID tokens, 30-day refresh
token, self-sign-up disabled. These match BR1.3 and NFR3.1 and are now confirmed
facts rather than intentions.

## Authorization

**`amplify/data/resource.ts`** carries, from the previous session's
code-generation work:

```
- .handler(a.handler.custom({ dataSource: a.ref('Post'),
-                             entry: './post-resolvers/listAllPostsForAdmin.js' }))
+ .handler(a.handler.function(feedApi))
```

**This is the change that created the AppSync authorization gap.** Amplify Data
emits `@aws_cognito_user_pools(cognito_groups:["Admin"])` for
`a.handler.custom(...)` JS resolvers but NOT for `a.handler.function(...)`
Lambda-backed operations, where `allow.group('Admin')` degrades silently to any
authenticated user. `createPost` and `deletePost` are still JS resolvers and
still carry the directive; `listAllPostsForAdmin` lost it in this move, and the
`allow.group('Admin')` line above it did not change, so nothing in the source
looks different.

There was no warning at synth or deploy time. It was found only by reading the
deployed SDL.

**Risk accepted, with mitigation verified:** `requireAdmin` inside each Lambda
is the enforcing layer for the three affected operations, and all three were
tested against their **deployed** Lambdas on 2026-10-02 — admin permitted,
non-admin refused. `confirmDocumentUpload` gained a unit test for the same.
Comments in `data/resource.ts` and all three handlers were corrected from
"defense-in-depth BACKSTOP" to "THE enforcing layer", because a future
refactor that deleted `requireAdmin` believing AppSync had already filtered
would expose every suggestion-box submission.

**Residual risk:** one layer where the design intended two. Restoring the
directive via a schema override was offered and deliberately not taken.

## IAM

**Budget action deny policy** (`temple-app-spend-cap-strict`) — attaches to the
IAM user and the 11 app Lambda execution roles at a $15 spend cap. Reviewed
before arming per check B-5:

- Written as `Deny` with `NotAction`, permitting `budgets:*`, `ce:*`, `iam:Detach*Policy` and `support:*` — the minimum needed to lift the cap. A blanket deny would have required a root login to undo.
- Amplify/CDK infrastructure roles deliberately excluded; denying them risks wedging CloudFormation mid-operation.
- Takes the app offline when it fires. That reverses `project.md`'s "a guardrail must not break the thing it protects", on the builder's explicit decision that cost certainty outranks availability for a personally-funded app with no users. Recorded in `environment-provisioning/validation-report.md`.

**Lambda execution-role scoping** — unchanged by this branch beyond the
`appsync:GraphQL` narrowing already made at Code Generation.

## Verdict

Merge. The authorization gap is pre-existing to this branch's own work, is now
documented and tested rather than silent, and the sign-in changes are additive.
The one thing a future reader must not do is delete `requireAdmin` from
`feed-api`, `all-suggestions` or `document-api`.
