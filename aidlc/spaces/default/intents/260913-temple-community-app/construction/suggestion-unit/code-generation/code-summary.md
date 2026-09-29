# Code Summary — suggestion-unit

Full build of the suggestion box (first release). Two Lambdas, one direct resolver, two tables, one custom metric.

## Files created / modified

25 entries in `source-manifest.json`; workspace-relative.

| Path | Kind | Purpose |
|---|---|---|
| `package.json`, `package-lock.json` | modified | Runtime dep `@aws-sdk/client-cloudwatch`; script `test:suggestion`. |
| `tsconfig.json` | modified | `amplify/data/suggestion-resolvers/*.js` added to `include` so `checkJs` covers the resolver. |
| `jest.config.ts` | modified | `amplify/data/suggestion-resolvers/**/*.js` added to `collectCoverageFrom`. `coverageThreshold` untouched (80% lines). |
| `amplify/data/resource.ts` | modified | Appended: `Suggestion` model (`submittedByGoogleId`, `text`, `submittedAt`; `submitterIndex` on `submittedByGoogleId` sorted by `submittedAt`; owner-READ via `ownerDefinedIn('submittedByGoogleId').identityClaim('sub')` + Admin-READ; all generated ops disabled), `SuggestionDailyCount` (`count`, `ttl`; Admin-READ only; no client operation), and Contract 4's `submitSuggestion` (authenticated, Lambda), `myPastSuggestions` (authenticated, JS resolver), `allSuggestions` (Admin, Lambda). Existing blocks untouched. |
| `amplify/backend.ts` | modified | Registers both functions; TTL on `SuggestionDailyCount` (`timeToLiveAttribute: { attributeName: 'ttl', enabled: true }`); PITR on `Suggestion`; least-privilege IAM — `submit-suggestion`: `dynamodb:UpdateItem` on the counter table only, `dynamodb:PutItem` on `Suggestion` only, `cloudwatch:PutMetricData` conditioned on `cloudwatch:namespace = SarovarJinalaya/Suggestions`; `all-suggestions`: `dynamodb:Scan` on `Suggestion` only. Env names injected. |
| `amplify/data/suggestion-resolvers/myPastSuggestions.js` (+ test) | created | APPSYNC_JS: Query on `submitterIndex` keyed on `ctx.identity.sub`, newest first; `util.unauthorized()` without an identity. 4 tests. |
| `amplify/functions/suggestion-shared/rules.ts` (+ test) | created | `MAX_WORDS = 300`, `DAILY_LIMIT = 5`, whitespace-run word count (BR3.1), `validateText`, `istDateOf` (`Intl.DateTimeFormat` `Asia/Kolkata`), TTL = next IST midnight + 48 h. 8 tests. |
| `amplify/functions/suggestion-shared/suggestion-repository.ts` (+ test) | created | `create` (conditional on new id), `listAll` (paginated Scan), `tryIncrementDailyCount` — the single atomic `UpdateItem` (`ADD #count :one SET #ttl = if_not_exists(#ttl, :ttl)`, condition `attribute_not_exists(#count) OR #count < :five`); `ConditionalCheckFailedException` → `{ allowed: false }`, other errors rethrown (BR3.5, project.md correction: never read-then-write). 6 tests. |
| `amplify/functions/suggestion-shared/metrics.ts` (+ test) | created | `suggestion-count` in namespace `SarovarJinalaya/Suggestions`; CloudWatch failures logged and swallowed. 3 tests. |
| `amplify/functions/suggestion-shared/types.ts`, `errors.ts` | created | Record shapes, index/env names (the schema imports the index name from here so Lambda code never imports the schema); typed errors incl. `DailyLimitExceededError`. |
| `amplify/functions/submit-suggestion/resource.ts`, `handler.ts` (+ test) | created | 128MB/5s, `resourceGroupName: 'data'`. Identity `sub` from `event.identity` only (BR3.2) → validate (BR3.1) → atomic increment (BR3.5; refused → plain-language error, no record) → `create` with `submittedByGoogleId = sub` (bare, so the owner rule matches) → best-effort metric. Logs carry id/date/reason only — never the suggestion text. 7 tests. |
| `amplify/functions/all-suggestions/resource.ts`, `handler.ts` (+ test) | created | 256MB/30s; Admin backstop behind the declarative rule; paginated Scan; newest first. 4 tests. |
| `amplify/data/suggestion-schema.test.ts` | created | 6 SDL/definition tests. |
| `amplify/data/post-schema.test.ts` | modified (feed-unit's) | One shared-file assertion sharpened, not weakened: it asserted the schema's ENTIRE JS-resolver list equals feed-unit's five, which any later Unit adding a JS resolver would break; it now filters to resolvers whose data source is the Post table and still asserts the same five names. |
| `README.md` | modified | "Suggestion Box" section: operations and callers, enforcing layer vs. backstop, 300-word and 5-per-IST-day limits and the atomic counter, permanence (no delete, no read/resolved state), TTL, metric, permissions self-review list. |

## Key implementation decisions

1. **Authorization layering stated explicitly** (schema comments, handler headers, README): the declarative AppSync rules enforce BR3.2/BR3.3; the Lambda/resolver checks are backstops. `submittedByGoogleId` is written as the bare `sub` so the model's owner rule matches — asserted in tests.
2. **Atomic cap** — one conditional `UpdateItem` checks and increments; a limit hit is a `ConditionalCheckFailedException`, never a separate read.
3. **Metric doubly best-effort** — the emitter swallows CloudWatch failures AND the handler guards the call; a saved suggestion is never reported as failed.
4. **Personal data never logged** — log lines carry id / IST date / reason only.
5. **IST arithmetic** without a library: `Intl.DateTimeFormat` for the date key; fixed +05:30 offset for the TTL (IST has no DST).
6. **Two small extra files** (`types.ts`, `errors.ts`) beyond the plan's list, following the other Units' pattern; 100% covered.

## Test coverage summary

- `npm run test:suggestion` → **7 suites, 38 tests, 38 passed** (exactly the approved instructions' table).
- `npm test -- --coverage` → **35 suites, 193 tests, 193 passed; 93.5% statements / 85.3% branches / 88.0% functions / 94.9% lines** (80% floor enforced, unchanged) — re-run and confirmed by the conductor. This Unit: `suggestion-shared` 100% lines, `suggestion-resolvers` 100%, `submit-suggestion` 90.6%, `all-suggestions` 80% (uncovered: the lazy real-client bootstraps).
- `npm run lint`, `npm run typecheck`, `prettier --check` → clean.
- No integration test yet; flutter-app-unit's `integration_test` will exercise the atomic counter against a real DynamoDB in `ampx sandbox`.

## Deviations from the design and plan

| Deviation | Why | Effect |
|---|---|---|
| Counter TTL = **next IST midnight + 48 h** (the approved plan) rather than `security-design.md`'s literal "IST start-of-day + 48 h" | Plan text governed; the plan's form is 24 h more conservative | Rows live one day longer; still after the day they count; negligible cost. A one-line change if the design's literal formula is preferred. |
| `post-schema.test.ts` (feed-unit) amended | A whole-schema assertion could not survive any later JS resolver; filtered by data source, same five names asserted | No assertion removed or weakened |
| `ttl` set with `if_not_exists` inside the atomic update; counter-then-create ordering | Declared in the plan | A failed `Suggestion` write after the increment costs one of the day's five; the reverse is impossible |
| `types.ts` / `errors.ts` added | Shared helpers per the other Units' pattern | None on behaviour |

## Open items (not defects)

- Confirm the TTL formula preference above (plan vs. security design literal) — cosmetic.
- The permission block added to `amplify/backend.ts` is on the builder's self-review checklist (project.md Mandated).
- Full-suite Jest runs now take ~5 minutes on this machine (ESM + ts-jest); CI should allow for it.

## Re-verification (2026-09-28)

Same stage-attempt reset as auth-unit (see that Unit's code-summary.md). Re-ran Plan Approval under the current attempt and verified the existing implementation directly:

- `npm run test:suggestion`: 7/7 suites, 38/38 tests passing.
- `npm run typecheck` / `npm run lint`: clean (verified once during this session's re-verification pass; unaffected by this Unit).
- Repository content is unchanged: no `amplify/data/suggestion*/**` or `amplify/functions/{suggestion-shared,submit-suggestion,all-suggestions}/**` file was touched.
