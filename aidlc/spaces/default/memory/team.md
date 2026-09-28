# Team-Level Rules

> This team's affirmed practices and corrections. Loaded after `org.md` as
> strict-additive guidance; contradictions with broader policy are rejected.
> Populated by the practices-discovery affirmation gate. Edit at the gate,
> not directly.

## Way of Working

- **Repository host**: GitHub (affirmed, Q1). Chosen first because several
  other affirmed practices — pre-commit secret scanning, GitHub's built-in
  secret scanning and push protection, Dependabot alerts, and free GitHub
  Actions CI — all assume GitHub.
- **Branching**: trunk-based development with short-lived feature branches
  (typically resolved within 1-2 days), squash-merged into `main` — the
  org default, kept as-is for this project (Q2). Each Bolt becomes one
  commit on the trunk, named by the Bolt slug; full Bolt commit history is
  preserved on the source branch until the worktree is discarded.
  Construction worktrees: base branch `main`, merge target `main`. One
  trunk even as more environments are added later — gate releases via tags
  or environment-specific deployment configs, not long-lived release
  branches.
- Even though this is a solo project, the builder chose to keep
  branch-per-change discipline rather than commit straight to `main` — this
  was offered as an option and explicitly declined in favor of the org
  default.

## Walking Skeleton

- The active scope declares `skeleton: on`, carrying forward the
  already-confirmed Scope Definition decision: the first Bolt builds one
  thin end-to-end slice — sign-in through Cognito (Google federation), one
  feed post, and the admin allowlist gate — proving every architectural
  layer works before the rest of the first release is built. Bolt 1 is
  solo and gated; the builder explicitly approves it before remaining
  Bolts run.
- **Construction Autonomy Mode: gate every Bolt** (affirmed, Q3). The
  builder wants to review and approve every build increment, at least
  while still learning the Flutter/Amplify Gen2 stack — not just the
  skeleton checkpoint. This choice can be revisited once the builder is
  more comfortable with the stack.

## Testing Posture

- **Methodology**: test-after
- **Ordering**: implement each applicable testable layer, then write and
  run that layer's tests, with the walking-skeleton Bolt held to a lighter
  smoke-level bar across the board — including the admin allowlist gate —
  and the standard 80% line-coverage floor applying from the second Bolt
  onward.

Affirmed specifics (Q4-Q7):

- **Test-after, not TDD/BDD** (Q4): writing code first, then its tests,
  fits a builder who doesn't yet have confidence in the API/widget shapes
  of either Flutter or Amplify Gen2 — test-first would compound that
  learning-curve risk.
- **Walking-skeleton Bolt test rigor: light smoke-level check everywhere in
  the skeleton, including the admin allowlist gate** (Q5 — Answer A). The
  quality agent's review recommended a stricter option for the admin gate
  specifically (a real pass/fail assertion proving non-admins are
  rejected, since it's a security boundary), but the human deliberately
  chose the lighter, uniform smoke-level bar for the entire skeleton
  instead. This is recorded as the builder's considered choice, not an
  oversight — a proper test for the admin gate's server-side enforcement
  is expected to land with the fuller coverage floor from the second Bolt
  onward, once the architecture is proven end-to-end.
- **Coverage target beyond the skeleton: the org default's 80%
  line-coverage floor, adopted as-is** (Q6). The quality agent flagged
  that the 80% floor's applicability was ambiguous under the custom
  `temple-mobile-app` scope signal (it isn't in the org default's named
  scope list); the builder resolved this directly by choosing to adopt the
  80% target rather than a looser or undefined bar.
- **CI + backend test framework: GitHub Actions with Jest** (Q7). A single
  GitHub Actions workflow runs on every push/PR to `main`: `flutter
  analyze` + `flutter test --coverage` on the Flutter app side, and
  ESLint/`tsc --noEmit` + Jest on the Amplify Gen2/TypeScript backend
  side (Lambda handlers, AppSync resolver logic) — blocking merge on
  failure. This is the project's only enforcement mechanism for test
  quality, since there is no second reviewer to catch a skipped or
  weakened test. If Amplify Hosting's own build pipeline is used for
  deploys, a test step must be added to `amplify.yml` deliberately —
  Amplify Hosting does not run app-level tests by default.
- Test-type mix (carried forward from the quality agent's contribution,
  not separately re-asked, since it elaborates rather than contradicts the
  affirmed methodology): Flutter unit tests for business logic,
  `flutter_test` widget tests for UI, and `integration_test` for
  higher-risk end-to-end flows (Cognito/Google-federation sign-in, the
  admin allowlist gate, and later the donation flow) — integration-level
  coverage matters more than usual here because a unit test that mocks the
  Amplify client can pass while the real integration is still broken. On
  the backend, Jest unit tests for Lambda handlers and schema/contract
  checks against the AppSync GraphQL schema, exercised against Amplify
  Gen2's local sandbox (`ampx sandbox`) rather than a live deployed
  environment.

## Change Control

<!-- Affirmed by the team. Mode: strict or relaxed. Strict here holds for every intent and cannot be changed from chat. -->

## Deployment

- **Production deploy gate: a short concrete checklist** (affirmed, Q8),
  replacing the org default's "tech lead + product owner sign-off"
  language, which doesn't map to a solo builder with no second reviewer.
  Before each release:
  - No secrets committed (verified by the pre-commit hook and GitHub's
    scanning — see Code Style).
  - No open dependency warnings (Dependabot alerts clear, or explicitly
    triaged).
  - Any AWS permissions/auth changes double-checked before merge.
- Deploy on merge to staging remains the org default (unchanged from
  `org.md`). Continuous deployment straight to production is not adopted
  yet — appropriate once test coverage and observability are more
  established, per the org default's own framing; this is not a hard
  boundary, just not the current posture.
- AWS region choice (Feasibility suggested `ap-south-1`/Mumbai for
  proximity to the user base) remains deferred to infrastructure design,
  not decided at this stage — see `evidence.md`.
- *Suggested, not affirmed*: server-side-only enforcement of the admin
  allowlist gate (Cognito group / AppSync authorization rule, never a
  client-side-only check) was offered in Q14 as a candidate firm rule and
  was **not** selected by the builder in that batch. It remains good
  practice worth keeping in mind when the walking-skeleton Bolt implements
  that gate, but it is not a Mandated/Forbidden rule in this project's
  `discovered-rules.md`.

## Code Style

- **Formatter/linter**: `dart format` + `flutter_lints` for the Flutter
  app, Prettier + ESLint for the Amplify Gen2/TypeScript backend
  (Lambda, AppSync resolvers). `flutter_lints` was affirmed over the
  stricter `very_good_analysis` alternative (Q9) — the lighter, standard
  starting point that ships with new Flutter projects, chosen deliberately
  to reduce noise while the builder is still learning the framework;
  `very_good_analysis` was considered and explicitly not chosen, but may
  be worth revisiting once the builder is more comfortable with Flutter.
- **State management: plain `ValueNotifier`/`ChangeNotifier`** (affirmed,
  Q10) — built into Flutter, no extra package. `Provider`, `Riverpod`, and
  `Bloc` were all offered and not chosen; the builder picked the simplest
  option that still scales to the app's four capabilities (feed,
  donations, PDF library, suggestion box).
- **File organization: layer-first** (affirmed, Q11):
  ```
  lib/
    models/       # plain Dart data classes (Post, Donation, Document, ...)
    screens/      # one file per screen/route
    widgets/      # shared/reusable widgets
    services/     # Amplify API wrappers (auth, data, storage)
    utils/        # formatting, validation helpers
  ```
  Feature-first folders (`lib/feed/`, `lib/donations/`, …) were considered
  and not chosen — layer-first is what most beginner-oriented Flutter
  tutorials use and avoids a directory-per-concept decision on every new
  file, which doesn't pay off for a single builder.
  For the Amplify Gen2 backend, the framework's own prescriptive layout is
  adopted as-is: `amplify/auth/resource.ts`, `amplify/data/resource.ts`,
  `amplify/storage/resource.ts`, `amplify/functions/<name>/resource.ts`.
- **Layer-boundary rule (firm)**: only `services/` may import
  `package:amplify_*` or call generated AppSync/GraphQL operations
  directly — screens and widgets never call Amplify directly (affirmed,
  Q12; also recorded in `discovered-rules.md` § Mandated since it is a
  firm rule, not a loose guideline). This isn't enforced by
  `flutter_lints` (import-boundary checks aren't a stock lint rule), so it
  depends on the builder holding to it deliberately. The payoff: if
  Amplify Gen2's API shape changes, or a storage detail (e.g. how PDFs
  are fetched from S3) needs to change, the blast radius is one file per
  capability instead of every screen that touched Amplify directly.
- **Naming conventions** (language-idiomatic, per org default, made
  concrete):
  - Dart: `UpperCamelCase` for classes/enums/typedefs, `lowerCamelCase`
    for variables/functions/parameters, `lowercase_with_underscores` for
    file and directory names (`effective_dart` convention; partially
    enforced by `flutter_lints`' `file_names` rule).
  - TypeScript: `camelCase` for variables/functions, `PascalCase` for
    types/interfaces/classes, filenames following the Amplify Gen2
    generated convention (`resource.ts` per construct directory).
  - No project-wide rename/abbreviation rules beyond the above.
- **Security-relevant tooling (affirmed, Q13)**: both a pre-commit
  secret-scanning hook (`gitleaks` or `detect-secrets`) scanning staged
  diffs before every commit, AND GitHub's built-in secret scanning + push
  protection + Dependabot alerts (on both `pubspec.yaml` and
  `package.json` dependency graphs) as a second layer. `flutter_lints`
  and ESLint are style linters and do not catch secrets or
  security-specific issues on their own. *Suggested, not separately
  affirmed as a rule*: `eslint-plugin-security` alongside the existing
  ESLint setup on the TypeScript/Lambda side, as a low-friction addition
  once ESLint is already in the toolchain.
## Forbidden

<!-- Team-specific forbidden patterns -->

## Mandated

<!-- Team-specific mandates -->

## Corrections

<!-- Self-learning loop appends here. -->
