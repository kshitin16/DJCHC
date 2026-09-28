# Evidence — Practices Discovery (Final, Step 5 Lead Integration)

## What was inspected

**Codebase / repository history — none exists.** This is confirmed
greenfield: `/Users/kshitin/DJCHCApp` is not a git repository (no `.git`,
no commit history), and there is no existing application code, CI
configuration (no `.github/workflows`, no `buildspec.yml`, no pipeline
definitions of any kind), linter config, or formatter config to inspect.
There is therefore no re-run baseline to infer team practices from by
observation — every practice suggested in `team-practices.md` is either an
explicit framework default or a tailoring of that default to this
project's stated context, never an inference from existing artifacts.

**`aidlc/spaces/default/memory/org.md`** — read in full. Its five
practice sections (`## Way of Working`, `## Walking Skeleton`,
`## Testing Posture`, `## Deployment`, `## Code Style`) were treated as
the framework's default suggestions, not established facts for this
project, per this stage's brief. Each is carried into `team-practices.md`
as a labeled DRAFT default.

**`aidlc/spaces/default/memory/team.md`** — read; not directly used as a
source since its five corresponding sections are empty templates (no
re-run baseline for this space/team yet).

**`aidlc/spaces/default/memory/project.md`** — read in full, including
its `## Corrections` entries. Confirmed that none of the seven existing
corrections bear on team practices (branching, testing methodology,
deployment, or code style) — they are all process-conduct corrections
about how the conductor should run interviews, handle multi-option
answers, and integrate reference material, and are out of scope for this
stage's deliverables. The project.md practice sections (Way of Working,
Walking Skeleton, Testing Posture, Deployment, Code Style) are also empty
templates, confirming there is no project-level specialisation already on
record for this project's team practices.

**Ideation-phase context, read for project-specific tailoring only (not
as inputs this stage must directly satisfy):**

- `.../ideation/intent-capture/intent-statement.md` — establishes the
  stack (Flutter on iOS/Android, AWS Amplify Gen2: Cognito w/ Google
  federation, AppSync/DynamoDB, S3, Lambda), the four capabilities
  (content feed, UPI donations, PDF library, suggestion box), the
  public/sign-in access split, and that the initiative is a single
  community volunteer's personal contribution project (no external
  deadline or mandate).
- `.../ideation/feasibility/feasibility-assessment.md` — establishes,
  critically for this stage, that **the builder is new to both Flutter
  and AWS Amplify Gen2**, and explicitly recommends the design/build
  stages "favor well-documented, conventional patterns over anything
  clever or non-standard, so the builder isn't fighting the framework and
  the stack at the same time." This directly informed the Testing Posture
  and Code Style tailoring notes in `team-practices.md` (test-after over
  TDD/BDD; conventional Dart/TS tooling). It also flags the payment
  aggregator's tokenized-flow requirement (informing a candidate Forbidden
  rule) and the domestic-only/FCRA-out-of-scope note (informing another
  candidate Forbidden rule), both recorded in `discovered-rules.md` as
  candidates rather than affirmed constraints.
- `.../ideation/scope-definition/scope-document.md` — establishes the
  first-release/later-release boundary and, in its "Sequencing Approach"
  section, an already-confirmed decision to build walking-skeleton-first
  (one thin end-to-end slice through Cognito sign-in, one feed post, and
  the admin allowlist gate) before the rest of the first release. This is
  a solid, already-decided project fact (not a suggestion), carried into
  `team-practices.md` § Walking Skeleton as a note that the active scope
  should declare `skeleton: on`.

## What the support reviewers inspected and flagged

**Quality agent** (`contributions/aidlc-quality-agent.md`) — reviewed the
lead draft, evidence, and the ideation artifacts. Flagged five gaps as
OBJECT positions: (1) the skeleton Bolt's test bar should not be uniformly
smoke-level — the admin allowlist gate is a security boundary and deserves
a real pass/fail assertion even in the skeleton; (2) the 80% coverage
floor's applicability was ambiguous because the workflow-selected scope
(`temple-mobile-app`) isn't in `org.md`'s named scope list that the floor
is scoped to; (3) no CI platform or backend test framework had been chosen,
blocking an enforceable quality gate from day one; (4) integration-level
testing for the Cognito/Google-federation sign-in flow wasn't addressed;
(5) Amplify Hosting's own build pipeline does not run app-level tests
unless a step is explicitly added to `amplify.yml`. Also contributed a
concrete test-type mix (unit/widget/`integration_test` for Flutter; Jest +
`ampx sandbox` for the backend) — carried into `team-practices.md`.

**Developer agent** (`contributions/aidlc-developer-agent.md`) — endorsed
the lead's formatter/linter mapping and flagged three OBJECT-level gaps the
draft's Code Style section hadn't reached: (1) file organization
(layer-first vs. feature-first) was unaddressed; (2) state management
(Provider/Riverpod/Bloc/`ValueNotifier`) was unaddressed anywhere in the
draft despite driving file organization and naming; (3) the construction
guardrail's generic error-handling rule needed a stricter, donation-specific
tailoring (reconcile against the aggregator's status, never default-resolve
a timeout) given the higher stakes of that integration boundary. Also
proposed the `flutter_lints` vs. `very_good_analysis` trade-off explicitly,
and proposed the services/-only-imports-Amplify layer boundary as a
candidate Mandated rule.

**Devsecops agent** (`contributions/aidlc-devsecops-agent.md`) — flagged
that the draft was silent on secrets, dependencies, and supply chain
entirely, despite the project handling real credentials (Google OAuth
client secret, AWS access) from the first release. Proposed pre-commit
secret scanning (`gitleaks`/`detect-secrets`) plus GitHub's built-in
scanning/Dependabot as a solo-builder-appropriate, low-maintenance
substitute for a full SAST/DAST program. Raised four Forbidden/Mandated
candidates (PII encryption, boundary input validation, never store raw
payment credentials, server-side-only admin gate enforcement) and one
Deployment-adjacent candidate (a self-review checklist for IAM/auth
changes before merge). Also flagged, as an OBJECT position, that the repo
host was still undecided and that several of these recommendations
(GitHub secret scanning, Dependabot, free Actions CI) assume GitHub
specifically — this is the same underlying gap the lead had flagged under
Deployment, and the interview resolved both together via Q1.

## Interview decisions on the open questions (resolved 2026-09-13)

All fourteen questions in `practices-discovery-questions.md` were answered
and the consolidated summary was confirmed ("Looks correct"). In order:

1. **Repo host**: GitHub — resolves the devsecops agent's OBJECT and
   unblocks the GitHub-specific recommendations (secret scanning, push
   protection, Dependabot, free Actions CI) that several other answers
   depend on.
2. **Branching**: trunk-based/squash-merge kept as-is — the builder
   explicitly chose to keep branch-per-change discipline over simplifying
   to direct-to-`main` commits, despite being solo.
3. **Construction Autonomy Mode**: gate every Bolt, not just the skeleton
   checkpoint — the builder wants to review each increment while still
   learning the stack.
4. **Testing methodology**: test-after, as recommended by both the lead and
   the quality agent — confirms rather than overrides the draft.
5. **Skeleton test rigor**: light smoke-level check everywhere, including
   the admin allowlist gate. This is the one point where the human's
   answer differs from the quality agent's recommendation (which argued
   for a real pass/fail assertion on the admin gate specifically, given
   it's a security boundary) — the human considered that option (it was
   offered as choice B) and deliberately chose the uniform, lighter bar
   instead (choice A). Recorded in `team-practices.md` as the human's
   considered choice, not an oversight; a proper test for that boundary is
   expected once fuller coverage floors apply from Bolt 2 onward.
6. **Coverage floor beyond the skeleton**: 80%, adopted anyway — resolves
   the quality agent's OBJECT about the floor's ambiguous applicability
   under the custom scope by explicit builder choice rather than default
   inheritance.
7. **CI + backend framework**: GitHub Actions + Jest — resolves the
   quality agent's most pressing OBJECT (no enforceable quality gate
   existed). Vitest was offered and not chosen.
8. **Production deploy gate**: a short concrete checklist (no secrets
   committed, no open dependency warnings, auth/permission changes
   double-checked) — resolves both the lead's own open item (what does
   "the builder approves their own release" concretely mean) and the
   devsecops agent's OBJECT that the deployment section lacked a
   security-relevant pre-production check.
9. **Linter**: `flutter_lints`, not `very_good_analysis` — the lighter
   option, matching the developer agent's own lean, chosen deliberately to
   reduce friction while the builder is still learning Flutter.
10. **State management**: plain `ValueNotifier`/`ChangeNotifier` — resolves
    the developer agent's OBJECT that this was entirely unaddressed;
    Provider, Riverpod, and Bloc were all offered and not chosen.
11. **File organization**: layer-first — resolves the developer agent's
    other OBJECT; feature-first was offered and not chosen, consistent
    with the developer agent's own recommendation for a solo builder.
12. **Layer-boundary rule**: made firm — only `services/` may import/call
    Amplify directly. Promoted from the developer agent's suggestion into
    an affirmed Mandated rule in `discovered-rules.md`.
13. **Security tooling**: both pre-commit secret scanning and GitHub's
    built-in scanning/Dependabot — the devsecops agent's recommendation
    adopted in full ("both" was explicitly offered and chosen over
    "GitHub-only" or "not needed yet").
14. **Hard project rules**: four of the five offered candidates were
    elevated to firm, affirmed Mandated/Forbidden status (never store/
    transmit raw payment details; PII encrypted at rest and in transit;
    never assume a payment outcome on timeout, always check the
    aggregator's record; brief self-review before merging sign-in/
    permissions/payment changes). The fifth candidate — server-side-only
    enforcement of the admin allowlist gate — was offered but **not**
    selected in this batch; it is not recorded as a Mandated/Forbidden
    rule, only noted as a suggested good practice in
    `team-practices.md` § Deployment.

## Remaining unresolved uncertainty

Very little remains open after the interview. The one item still
explicitly deferred, not overlooked:

- **AWS region choice**: Feasibility suggested `ap-south-1` (Mumbai) for
  proximity to the user base, but this was never in scope for
  practices-discovery — it is an infrastructure-design-time decision and
  remains deferred there, as noted in both the original draft and
  `team-practices.md` § Deployment.

Everything else the lead draft and the three support agents flagged as an
open question or OBJECT position was put to the human directly in the
interview and resolved (see above); nothing else is outstanding.
