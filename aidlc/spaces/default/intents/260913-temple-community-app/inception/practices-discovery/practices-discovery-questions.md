# Practices Discovery — Questions

## Sources

- [scope] Workflow-selected scope: `temple-mobile-app`.
- Lead draft (pipeline-deploy agent): `team-practices.md`, `discovered-rules.md`, `evidence.md` (this stage's own Step 2 draft, drawing on `aidlc/spaces/default/memory/org.md`'s five default sections)
- Support contributions: `contributions/aidlc-quality-agent.md`, `contributions/aidlc-developer-agent.md`, `contributions/aidlc-devsecops-agent.md`

This is a greenfield project with no existing codebase, so every question below either confirms a framework default, resolves a genuine gap the lead or a support reviewer flagged, or asks the builder's own preference where the reviewers explicitly said it's the builder's call.

## Q1. Where will the code live — which repository host? Several other answers (secret scanning, automatic dependency alerts, and free CI) assume GitHub, so this is worth settling first.

- A. GitHub
- B. A different host (GitLab, Bitbucket, etc.)
- C. Not yet defined
- X. Other (please specify)

[Answer]: A. GitHub

## Q2. How should code get to the main branch? The default is trunk-based development: everyone works in short-lived branches that merge to `main` within a day or two, and each merge is squashed into one clean commit. For a solo project, is that still the right fit, or would you rather simplify further and commit straight to `main`?

- A. Keep trunk-based development with short-lived branches and squash-merge, as the default suggests
- B. Simplify — commit directly to `main`, no branch-per-change ceremony
- C. Not yet defined
- X. Other (please specify)

[Answer]: A. Keep trunk-based development with short-lived branches and squash-merge, as the default suggests

## Q3. Once the first thin end-to-end slice (the walking skeleton — already decided in Scope Definition) is built and working, should every subsequent build increment stop for your review before the next one starts, or should the build continue on its own after that first checkpoint?

- A. Gate every increment — I want to review and approve each one, at least while I'm still learning the stack
- B. Continue on its own after the first checkpoint — don't stop for my review each time
- C. Not yet defined
- X. Other (please specify)

[Answer]: A. Gate every increment — I want to review and approve each one, at least while I'm still learning the stack

## Q4. How should tests get written relative to the code — test-first (write a failing test, then the code that makes it pass) or test-after (write the code, then the tests)? Test-after is the recommendation here, since test-first asks you to be confident about an API or screen's shape before you've built it, which is harder when the stack itself is new to you.

- A. Test-after, as recommended
- B. Test-first (TDD) despite the learning curve — I'd rather build that habit from the start
- C. Not yet defined
- X. Other (please specify)

[Answer]: A. Test-after, as recommended

## Q5. For that first walking-skeleton slice specifically: should everything in it get only a light smoke-level check (does it basically work), or should the one piece that's a real security boundary — the admin allowlist gate (only allowlisted Google accounts can post) — get a proper pass/fail test even at this early stage, with the rest staying light?

- A. Light smoke-level check everywhere in the skeleton, including the admin gate
- B. Light smoke-level check everywhere, except the admin gate gets a real pass/fail test proving non-admins are actually rejected
- C. Full test coverage for the whole skeleton, not just smoke-level
- X. Other (please specify)

[Answer]: A. Light smoke-level check everywhere in the skeleton, including the admin gate

## Q6. Beyond the skeleton, how much test coverage should the rest of the build aim for? The framework's standard target is 80% of lines covered by tests, but that standard is written for larger team scopes and this project runs a custom, lighter-weight scope — so it's worth deciding deliberately rather than inheriting a number that wasn't written with a solo project in mind.

- A. Adopt the 80% line-coverage target anyway
- B. A lighter target — enough tests to cover what each piece is supposed to do, without chasing a specific percentage
- C. No fixed target — judge it case by case as the build goes
- X. Other (please specify)

[Answer]: A. Adopt the 80% line-coverage target anyway

## Q7. What should automatically check the code before it merges, and what should run the backend tests? The recommendation is one free GitHub Actions workflow that runs the Flutter checks and formatter, plus the backend checks and tests, on every push — blocking the merge if something fails. For the backend test runner, there's a choice between two similar tools: Jest (older, more widely used) or Vitest (newer, faster).

- A. GitHub Actions as recommended, with Jest for the backend tests
- B. GitHub Actions as recommended, with Vitest for the backend tests
- C. No automatic checks for now — I'll test manually and add this later
- X. Other (please specify)

[Answer]: A. GitHub Actions as recommended, with Jest for the backend tests

## Q8. Right now, the plan is simply "you approve your own production release" since there's no second person to review it. Should that be backed by a short concrete checklist (no secrets accidentally committed, no open dependency warnings, any AWS permissions/auth changes double-checked) before each release, or is an informal self-check enough?

- A. A short concrete checklist before each production release
- B. An informal self-check is enough — no formal checklist
- C. Not yet defined
- X. Other (please specify)

[Answer]: A. A short concrete checklist before each production release

## Q9. How strict should the code style checker (linter) be? `flutter_lints` is the lighter, standard starting point that ships with new Flutter projects. `very_good_analysis` is a stricter alternative that catches more but is noisier while you're still learning the framework.

- A. `flutter_lints` (lighter, recommended while learning the stack)
- B. `very_good_analysis` (stricter from the start)
- C. Not yet defined
- X. Other (please specify)

[Answer]: A. `flutter_lints` (lighter, recommended while learning the stack)

## Q10. How should the app manage on-screen state (what changes and re-renders as the user interacts with it)? This drives how files are organized and named throughout the app, so it's worth picking now rather than mixing approaches later. From simplest to more powerful: plain `ValueNotifier`/`ChangeNotifier` (built into Flutter, no extra package), `Provider` (a thin, popular wrapper around the same idea), `Riverpod` (more powerful, another concept to learn), or `Bloc` (more structured, more ceremony).

- A. Plain `ValueNotifier`/`ChangeNotifier` — simplest, built in
- B. `Provider` — a thin, popular wrapper, still simple
- C. `Riverpod` or `Bloc` — more powerful, willing to learn the extra concept
- D. Not yet defined
- X. Other (please specify)

[Answer]: A. Plain `ValueNotifier`/`ChangeNotifier` — simplest, built in

## Q11. How should the app's Flutter code be organized into folders? "Layer-first" groups files by what they do across the whole app (all screens together, all reusable widgets together, and so on) — this is what most beginner tutorials use. "Feature-first" groups files by which capability they belong to (a folder for the feed, a folder for donations, etc.) — this scales better with more contributors but adds an extra folder-per-concept decision that doesn't pay off for a single builder.

- A. Layer-first (`lib/models`, `lib/screens`, `lib/widgets`, `lib/services`, `lib/utils`) — recommended for a solo builder
- B. Feature-first (a folder per capability: `lib/feed/`, `lib/donations/`, etc.)
- C. Not yet defined
- X. Other (please specify)

[Answer]: A. Layer-first (`lib/models`, `lib/screens`, `lib/widgets`, `lib/services`, `lib/utils`) — recommended for a solo builder

## Q12. Should there be a firm rule that only one specific layer of the code (the `services/` folder) is ever allowed to talk to AWS Amplify directly — with every screen and widget going through that layer instead of calling Amplify itself? This means if Amplify's API ever changes, only a handful of files need updating instead of every screen that touched it.

- A. Yes, make this a firm rule
- B. No, treat it as a loose guideline rather than a firm rule
- C. Not yet defined
- X. Other (please specify)

[Answer]: A. Yes, make this a firm rule

## Q13. Beyond the code-style linter, should a couple of lightweight security checks run automatically — a pre-commit check that blocks an accidentally-committed secret (like an API key) from ever being saved to the repository, plus (if GitHub is the host) GitHub's own free secret-scanning and dependency-alert features?

- A. Yes, add both — pre-commit secret scanning and GitHub's built-in scanning/alerts
- B. Just GitHub's built-in scanning — skip the pre-commit hook
- C. Not needed yet — revisit this later
- X. Other (please specify)

[Answer]: A. Yes, add both — pre-commit secret scanning and GitHub's built-in scanning/alerts

## Q14. Several hard rules were suggested based on what this app will eventually handle (sign-in identity now, donations and personal data later). Which of these should become firm, non-negotiable rules for the whole project rather than just suggestions? (select all that apply)

- A. The app must never store or transmit raw payment details (card numbers, UPI PIN) — even temporarily; all payment handling goes through the aggregator's own secure flow
- B. The admin allowlist gate (who can post to the feed) must be enforced on the server side, never only checked on the device — a device-only check can be bypassed
- C. Any personal data collected (names, emails, donation records, suggestions) must be encrypted both at rest and in transit
- D. On the future donation path specifically: never assume a payment succeeded or failed just because the connection timed out — always check the aggregator's own record of what actually happened
- E. Any change touching sign-in, permissions, or (later) payment handling gets a brief self-review before merging, even though you're working solo
- X. Other (please specify)

[Answer]: A, C, D, E. Selected: never store/transmit raw payment details; personal data encrypted at rest and in transit; never assume payment outcome on timeout, always check the aggregator's record; and a brief self-review before merging any change touching sign-in, permissions, or payment handling. Not selected: enforcing the admin gate server-side only was offered but not elevated to a firm rule in this batch.

## Consolidated Summary Confirmation

Does this all look correct before I generate the artifact?

- Looks correct
- Request changes

[Answer]: Looks correct
