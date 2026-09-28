**Collaborator:** aidlc-developer-agent

## Contribution

Read the lead's draft, its evidence notes, the intent statement, and the
feasibility assessment. The lead's draft already covers formatter/linter
choice well; my contribution focuses on the areas the lead's Code Style
section doesn't yet reach — file organization, layer boundaries, naming
conventions, and error-handling specifics — plus a couple of gaps I think
the interview needs to close given a solo builder new to both Flutter and
Amplify Gen2.

**Formatter/linter — endorsing the lead's mapping, with one addition.**
`dart format` + `flutter_lints` for the Flutter side and Prettier + ESLint
for the Amplify/TypeScript backend is the right default: both pairs are
the conventional, zero-configuration-decision choice for their ecosystems,
which matters most for a builder who is still learning the stack itself.
One addition worth raising at interview: `flutter_lints` is intentionally
minimal (it's the "safe defaults" package the `flutter create` template
ships). `very_good_analysis` is a stricter, still well-documented
alternative that catches more (e.g. missing trailing commas, stricter
public-API doc requirements) at the cost of more noise early on. Given the
builder is still learning Flutter, I'd default to `flutter_lints` (less
friction while ramping up) and treat `very_good_analysis` as something to
graduate to later rather than adopt now — but this is a genuine judgment
call the interview should make explicitly rather than inherit silently.

**File organization — not yet addressed in the lead's draft; needs an
explicit answer.** Flutter has no single canonical project layout the way
some frameworks do, which is exactly the situation where an unstated
convention causes the most drift for a solo builder over time. I'd
recommend a simple **layer-first** structure for a project this size (four
capabilities: feed, donations, PDF library, suggestion box) rather than a
feature-first/module-per-capability structure — layer-first is what the
official Flutter docs and most beginner-oriented tutorials use, so it's
the path of least resistance while the builder is still learning:

```
lib/
  models/       # plain Dart data classes (Post, Donation, Document, ...)
  screens/      # one file per screen/route
  widgets/      # shared/reusable widgets
  services/     # Amplify API wrappers (auth, data, storage) — the only
                # layer allowed to import Amplify packages directly
  utils/        # formatting, validation helpers
```

Feature-first (`lib/feed/`, `lib/donations/`, …, each with its own
models/screens/widgets) scales better once the app has many contributors,
but that benefit doesn't apply to a single builder, and it adds a
directory-per-concept decision on every new file. I'd only switch to it if
the builder already has a strong preference.

For the Amplify Gen2 backend, the framework itself is prescriptive about
layout (`amplify/auth/resource.ts`, `amplify/data/resource.ts`,
`amplify/storage/resource.ts`, `amplify/functions/<name>/resource.ts`) —
that convention should simply be adopted as-is rather than reinvented; it's
also the layout every Amplify Gen2 tutorial and the generated starter
follow, which again favors the "well-documented, conventional" guidance
from Feasibility.

**Layer boundaries — the one rule I'd propose as Mandated, not just
suggested.** Given the file organization above, the natural boundary rule
is: **only `services/` may import `package:amplify_*` (or call
generated AppSync/GraphQL operations) directly** — screens and widgets go
through the services layer, never straight to Amplify. This isn't enforced
by `flutter_lints` (lint rules don't check import boundaries by default),
so if the team wants it, it needs to be an explicit Mandated rule the
builder can hold themselves to, not something Code Generation can assume
is covered by the linter. The payoff for a solo project: when Amplify
Gen2's API shape changes (a real risk — it's a newer, less stable surface
than the rest of the stack) or the builder eventually wants to swap a
detail (e.g. how PDFs are fetched from S3), the blast radius is one file
per capability instead of every screen that touched Amplify directly.

**Naming conventions — language-idiomatic, per org default, made
concrete:**
- Dart: `UpperCamelCase` for classes/enums/typedefs, `lowerCamelCase` for
  variables/functions/parameters, `lowercase_with_underscores` for file
  and directory names (this is `effective_dart`'s own convention, and
  `flutter_lints` partially enforces it via `file_names`).
- TypeScript (Amplify backend/Lambda): `camelCase` for variables/functions,
  `PascalCase` for types/interfaces/classes, filenames matching the
  Amplify Gen2 generated convention (`resource.ts` per construct
  directory) rather than a custom scheme.
- No project-wide rename/abbreviation rules beyond the above — consistent
  with the org default's "no project-wide rename rules unless team
  affirms one."

**Error handling — the construction-phase guardrail needs a
donation-specific tailoring.** The phase guardrail (`phases/construction.md`)
already mandates error handling at integration boundaries and distinguishing
recoverable vs. fatal errors — that's correctly generic. But this project
has one integration boundary that's materially higher-stakes than the
others: the UPI donation/payment flow (flagged in Feasibility for its
tokenized-flow requirement). A dropped network error on a feed post is a
retry; a dropped/ambiguous error on a donation confirmation risks a user
being charged with no record on our side, or believing a donation failed
when it didn't. I'd propose the interview affirm something stronger than
the general boundary rule for that one path specifically — e.g. always
reconcile payment-confirmation state against the aggregator's own status
API rather than trusting only the client-side callback, and never treat a
timeout on that path as either "succeeded" or "failed" by default. This is
a design detail more than a style rule, but it belongs in this stage's
Forbidden/Mandated candidates given it's a code-style-adjacent
"never swallow this class of error" rule.

**Gaps I think the interview must resolve (beyond what the lead already
flagged):**
1. **State management approach is entirely unaddressed.** Provider,
   Riverpod, `flutter_bloc`, or plain `setState`/`ValueNotifier` — this
   isn't covered by `org.md`'s generic Code Style section at all, but it's
   foundational: it drives file organization (where state objects live),
   naming (`XProvider`/`XNotifier`/`XCubit` suffixes), and testability.
   For a builder new to Flutter, I'd lean toward the simplest option that
   still scales to four capabilities — `Provider` or plain
   `ValueNotifier` + `ChangeNotifier` — over `Bloc` (more ceremony) or
   `Riverpod` (more powerful but another concept to learn on top of
   Flutter itself), but this is squarely the builder's call and should be
   asked directly rather than assumed.
2. **File-organization convention (layer-first vs. feature-first) is my
   proposal above, not yet a confirmed decision** — should be explicitly
   put to the builder rather than silently adopted at Code Generation
   time, since retrofitting a reorganization later is exactly the kind of
   churn a solo maintainer can't easily absorb.
3. **`flutter_lints` vs. `very_good_analysis`** — flagged above; a
   two-minute question now saves a later "why is the linter suddenly
   noisier" surprise.

## Positions
- AGREE: `dart format`/`flutter_lints` for Flutter and Prettier/ESLint for the Amplify/TypeScript backend — conventional, low-friction defaults that fit a builder new to both ecosystems.
- AGREE: test-after methodology tailored over TDD/BDD, and a lighter test bar for the walking-skeleton Bolt — correctly reduces compounded learning-curve risk per the Feasibility assessment.
- OBJECT: the draft's Code Style section stops at formatter/linter and doesn't address file organization, layer boundaries, or naming conventions at all — those are exactly the conventions a solo builder needs fixed early, before enough files exist to make a reorganization costly.
- OBJECT: state management library choice (Provider/Riverpod/Bloc/setState) is unaddressed anywhere in the draft, yet it drives file organization and naming directly — this should be added as its own interview question, not left to be improvised at Code Generation time.
- OBJECT: the construction-phase error-handling guardrail is treated uniformly, but the UPI donation/payment path is materially higher-stakes than the other integration boundaries and warrants a stricter, explicitly affirmed rule (reconcile against aggregator status, never default-resolve a timeout) rather than the generic boundary rule alone.
