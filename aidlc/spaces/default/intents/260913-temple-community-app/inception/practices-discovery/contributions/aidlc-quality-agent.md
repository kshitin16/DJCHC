**Collaborator:** aidlc-quality-agent

## Contribution

**Testing methodology.** Test-after fits this project better than TDD/BDD, for
the reason the lead draft already gives: the builder is new to both Flutter
and Amplify Gen2, so writing a failing test first requires confidence about an
API/widget shape the builder doesn't have yet. I'd add one refinement: for the
walking-skeleton Bolt specifically, "implement then test" should still cover
the admin allowlist gate with a real assertion, not just a smoke check —
that gate is the one piece of the skeleton that's a security boundary
(sign-in works vs. sign-in-and-is-admin are different claims), and a
skeleton that only proves "the feed post round-trips" without a test proving
non-admins are actually rejected leaves the highest-risk control in the
whole slice unverified. Everything else in the skeleton (does a post render,
does auth return a token) can stay at smoke level as the lead proposes.

**CI quality gates realistic at this scale.** No CI/CD platform has been
chosen yet (evidence.md confirms this explicitly), which is a gap this stage
should close, not defer — Code Generation and Build-and-Test both need
somewhere to run tests before this project's first Bolt lands. For a solo
volunteer with no reviewers, I'd size the gate to what one person can
maintain alone: a single GitHub Actions workflow (free at this project's
scale) running on every push/PR to `main` — `flutter analyze` + `flutter
test --coverage` on the app side, `eslint`/`tsc --noEmit` + the backend test
runner on the Amplify side — blocking merge on failure. That's a realistic,
low-maintenance gate for one person; a multi-stage pipeline with manual
approval steps (the org default's "tech lead + product owner sign-off"
language) doesn't map onto a solo builder and the draft already flags this
under Deployment, but it also matters for testing: there's no second
reviewer to catch a skipped or weakened test, so the CI gate is the *only*
enforcement mechanism here and should not be made optional or advisory.
Note also that Amplify Hosting's own build pipeline does not run app-level
tests unless a test step is explicitly added to `amplify.yml` — if the
builder deploys via Amplify Hosting's built-in CI rather than (or alongside)
GitHub Actions, that step needs to be added deliberately or tests silently
never run in CI at all.

**Test-type mix given the standard test strategy.** Two ecosystems, two test
stacks:
- **Flutter app**: unit tests for business logic, `flutter_test` widget
  tests for UI components, and `integration_test` (Flutter's own package)
  for the critical end-to-end flows — sign-in via Cognito/Google
  federation, the admin allowlist gate, and (later release) the donation
  flow. These integration tests matter more than usual here because the
  builder is learning Amplify's client SDK at the same time as writing
  business logic, so a unit test that mocks the Amplify client can pass
  while the real integration is still broken — the walking-skeleton Bolt
  is exactly where that gap would otherwise go unnoticed.
- **Amplify Gen2 backend** (Lambda, AppSync resolvers): unit tests for
  Lambda handlers, schema/contract checks against the AppSync GraphQL
  schema, and tests run against Amplify Gen2's local sandbox
  (`ampx sandbox`) rather than a live deployed environment — this is new
  tooling for a builder who's new to Amplify, so the interview should
  confirm the builder knows this local-sandbox testing path exists rather
  than discovering it mid-Bolt. Test framework (Jest vs. Vitest) is unstated
  and should be picked now, not left implicit.

**Coverage tooling**: `flutter test --coverage` produces `lcov.info`
(pairs with `genhtml` or a hosted coverage viewer); the backend side needs
whichever of Jest/Vitest is chosen, run with `--coverage`. Neither is
configured yet — flagging as a gap, not assuming a choice.

## Positions
- AGREE: test-after over TDD/BDD for this builder — rationale: TDD requires API/shape confidence the builder doesn't have yet on either Flutter or Amplify Gen2, exactly the risk Feasibility already named.
- AGREE: a lighter test bar for the walking-skeleton Bolt overall — rationale: the skeleton's job is proving architecture, not exercising full coverage floors.
- OBJECT: the skeleton Bolt's test bar should not be uniformly "smoke-level" — the admin allowlist gate needs a real pass/fail assertion even in the skeleton, because it's a security boundary, not a plumbing check.
- OBJECT: the 80% line-coverage floor's applicability is unresolved — `org.md`'s coverage floor is scoped to a named list (`mvp`, `enterprise`, `feature`, `infra`, `classic`, etc.) and the workflow-selected scope signal recorded in evidence.md is `temple-mobile-app`, which isn't in that list; the interview needs to confirm which floor (if any) actually applies before Build-and-Test can enforce one.
- OBJECT: no CI platform or backend test framework has been chosen — this blocks an enforceable quality gate from day one and should be resolved in this interview rather than deferred to a later stage, since it's foundational to every Bolt's test-then-verify loop, not just an infrastructure-design detail.
- OBJECT: integration-level testing for the Cognito/Google-federation sign-in flow isn't mentioned in the draft — given this is new territory for the builder and the skeleton Bolt exercises it first, the interview should confirm the builder plans to test this flow beyond manual click-through (e.g. `integration_test` or Amplify's auth test utilities).
