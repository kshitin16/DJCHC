**Collaborator:** aidlc-devsecops-agent

## Contribution

This is a solo-volunteer build with no dedicated security function, so the
right posture is lightweight, automated, "free-tier" controls baked into
the daily workflow — not a SAST/DAST program or a security team's review
gate. The draft is silent on secrets, dependencies, and supply chain
entirely; that is the main gap I'm flagging, because this project handles
real credentials from day one of the first release (Google OAuth client
secret for Cognito federation, AWS access, later a Razorpay/UPI aggregator
key), not only once payments ship.

**Secret scanning (solo-builder-appropriate, not a platform):**
- Pre-commit hook using `gitleaks` (or `detect-secrets`) scanning staged
  diffs before every commit — catches an accidentally-committed Cognito
  client secret, AWS key, or `.env` file before it ever reaches `main`,
  with near-zero setup and maintenance burden for one person.
- If the repo host is GitHub: enable GitHub secret scanning + push
  protection (free on public and, per plan, private repos) as a second
  layer — this is a checkbox, not a pipeline to build.
- Mandate: no credential, API key, OAuth client secret, or Amplify
  backend secret is ever hardcoded in source — Amplify Gen2 secrets
  (`amplify env secret` / Parameter Store) or environment injection only.
  This should move into `## Forbidden` once affirmed.

**Dependency / supply-chain scanning (appropriate at this scale):**
- Enable GitHub Dependabot alerts + security updates (or the repo host's
  equivalent) on both the Flutter/Dart package graph (`pubspec.yaml`) and
  the Amplify/TypeScript Lambda package graph (`package.json`) — free,
  automatic, no pipeline authored or maintained by the builder. This is
  the right-sized substitute for a dedicated SAST/DAST/Inspector pipeline
  here; a full pipeline is disproportionate to a one-person project and
  would itself become something the builder has to learn and maintain,
  working against the Feasibility assessment's "favor conventional,
  well-documented patterns" guidance.
- `flutter pub outdated` / `npm audit` run manually (or as a CI step, once
  a CI platform is chosen) before each Bolt's merge, rather than a
  standing scanning service — proportionate for pre-launch, low-traffic
  usage.
- No SAST tool (CodeGuru Security, SonarQube) or DAST tool is warranted
  for the first release at this scale; revisit only if the project grows
  a team or a formal compliance driver (see below).

**Lint/format rules relevant to security:**
- `flutter_lints`/`dart analyze` (already proposed in Code Style) does
  not catch security-specific issues (hardcoded secrets, insecure random,
  cleartext HTTP) — it's a style linter, not a security linter. I'd add
  the `gitleaks` pre-commit hook above as the actual security control
  rather than expecting the Dart/TS linters to cover it.
- For the TypeScript Lambda/Amplify backend code, consider
  `eslint-plugin-security` alongside the already-proposed Prettier/ESLint
  — a low-friction addition since ESLint is already in the toolchain, and
  it catches common Node/Lambda antipatterns (unsafe `eval`, insecure
  regex, command injection via `child_process`) relevant to
  request-handling code that will eventually touch PII and (later)
  payment webhooks.

**Forbidden/Mandated candidates for this project specifically** (given it
will eventually handle Google-federated auth now, and UPI payments +
personal data later, even though donations/PDF library are a later
release — these should be affirmed now so the pattern is set before the
riskier features land, not retrofitted):
- MANDATED: All PII (name, email, phone from Google sign-in; donation
  records and suggestion-box submissions once built) is encrypted at rest
  (DynamoDB default encryption via Amplify is sufficient — confirm it
  stays enabled, don't opt out) and in transit (TLS only, no plaintext
  HTTP endpoints).
- MANDATED: All Lambda/AppSync resolver inputs are validated at the
  boundary — this is already in `phases/construction.md` as a phase
  guardrail, but I'd surface it here explicitly because Cognito-federated
  identity claims and (later) donation/webhook payloads are exactly the
  kind of externally-supplied input that boundary validation exists for.
- FORBIDDEN: The app itself must never store or transmit raw payment
  credentials (card PAN, CVV, UPI PIN) even transiently — this is already
  implied by the constraint register's "payment-credential scope
  reduction" assumption, but it should graduate from an assumption to an
  affirmed Forbidden rule now, so it's binding by the time donation
  design work starts rather than being re-litigated then.
- FORBIDDEN: The admin allowlist gate (feed-post moderation, mentioned as
  part of the walking skeleton) must be enforced server-side (Cognito
  group / AppSync authorization rule), never client-side only — a
  client-only check is trivially bypassed and this is exactly the kind of
  early architectural pattern the walking-skeleton Bolt should get right,
  since it's testing this boundary already.
- MANDATED: Any change touching IAM policies, Cognito configuration, or
  (later) payment/webhook handling gets a brief self-review against
  least-privilege before merge, even solo — a lightweight checklist, not
  a second approver, since there is no second person. This should live
  in `## Deployment` or `## Change Control`, not just as a devsecops
  aside, so it's visible at the gate the builder actually uses.

## Positions

- AGREE: Test-after with conventional, well-documented Flutter/Dart and
  TypeScript tooling (rather than TDD/BDD) — one-line rationale: a
  builder new to the stack fighting an unfamiliar testing discipline at
  the same time as an unfamiliar framework increases the odds of security
  corners getting cut under time pressure, not just delivery slipping.
- AGREE: Walking-skeleton-first with Cognito sign-in as the first slice
  (`skeleton: on`) — one-line rationale: proving the auth boundary and
  the admin allowlist gate end-to-end in Bolt 1, while it's still cheap
  to change, is the right moment to get server-side authorization right
  rather than discovering a client-side-only gate later.
- OBJECT: The draft's `## Deployment` section has no security-relevant
  pre-production check beyond "the builder approves their own release" —
  one-line rationale: for a solo builder, "approval" should mean
  something concrete (no secrets in the diff, dependency alerts clear,
  IAM/auth changes self-reviewed) or it's not really a gate; the interview
  should pin this down as a short checklist rather than leaving it
  implicit.
- OBJECT: The draft's `## Code Style` section proposes Dart/TS linters but
  says nothing about secret scanning or a security-focused ESLint rule —
  one-line rationale: style linting and security linting are different
  concerns and the draft only covers the former; I'd fold
  `gitleaks`/`eslint-plugin-security` into that section (or a new line
  item) once the human affirms it.
- OBJECT: Nothing in the draft or the interview-open items addresses
  which repo host will be used — one-line rationale: whether the builder
  uses GitHub (free secret scanning, push protection, Dependabot,
  CodeQL) vs. AWS CodeCommit vs. something else materially changes what
  "dependency scanning" and "secret scanning" concretely mean here, and
  the CI-platform gap the lead already flagged under Deployment is the
  same underlying open question — the interview should resolve repo host
  and CI platform together, since my recommendations above assume GitHub
  is available.
- OBJECT: The draft doesn't flag that the payments/PII scope expansion in
  a later release should trigger a light re-check of this practices set
  (e.g., whether a formal SAST pass or a PCI-DSS-lite checklist becomes
  warranted once UPI Autopay integration begins) — one-line rationale:
  the constraint register and RAID log both treat payments as a
  later-release concern, which is correct for sequencing, but the
  practices set should say explicitly that "no SAST/DAST needed yet" is a
  scope-1 answer, not a permanent one, so it doesn't get forgotten.
