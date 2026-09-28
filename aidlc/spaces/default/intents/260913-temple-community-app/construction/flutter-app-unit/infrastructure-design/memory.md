<!-- INVARIANT: examples are single-line HTML comments so a fresh template parses to total=0 (MEMORY_EMPTY). Do NOT un-comment or split across lines. t100 guards this. -->
> This file is kept up to date automatically while the stage runs. Add observations at the review step, not by editing here directly.

## Interpretations
<!-- example: 2026-05-29T10:14:32Z — chose REST over GraphQL; the consuming team only needs CRUD, revisit if subscriptions land -->

- 2026-09-16T14:41:23Z — surfaced two provisioning items no prior stage named — the APNs authentication key upload to Firebase (without it FCM cannot reach iOS devices, so reminder-unit's push design silently fails on iOS) and the Cognito App Client custom-URL-scheme callback pairing with this Unit's platform manifests — rather than leaving them to be discovered as first-run failures.

- 2026-09-16T14:41:23Z — treated Q1's `amplify_outputs.json` as Amplify Gen2's Dart-format outputs file (`lib/amplify_outputs.dart`, `--format dart`) since that is what the Flutter client actually consumes; the JSON form is the same generated content in a shape the app cannot import directly.

## Deviations
<!-- example: 2026-05-29T10:14:32Z — skipped the optional caching layer the stage prose suggested; the dataset is small enough that it adds risk -->

- 2026-09-16T16:46:46Z — after review flagged R-01: the app-facing Cognito callback/sign-out URLs (custom URL scheme) were wrongly described as already provisioned by auth-unit; auth-unit's approved Infrastructure Design covers only the Cognito→Google redirect. Reworded as an explicit, open obligation this Unit imposes on auth-unit's `amplify/auth/resource.ts` at Code Generation, rather than amending auth-unit's already-reviewed artifact.

- 2026-09-16T14:41:23Z — the interview surfaced a contradiction (Q1 no-flavors vs. Q2 per-flavor Firebase apps) that the stage's own question set did not anticipate; resolved through a follow-up (Q5) rather than silently picking one answer, and the resolution (one Firebase app per platform + Crashlytics disabled in debug builds) is what the artifacts implement.

## Tradeoffs
<!-- example: 2026-05-29T10:14:32Z — picked TDD over BDD this run; the team is unit-first and the domain is well-understood -->

- 2026-09-16T14:41:23Z — designed CI to stub `lib/amplify_outputs.dart` rather than generate it with `ampx generate outputs` — keeps AWS credentials out of CI entirely (the builder's Q4 choice) at the cost of CI never compiling against a real backend config; `flutter analyze` is the compile-level check and `flutter build` is deliberately not run in CI.

## Open questions
<!-- example: 2026-05-29T10:14:32Z — confirm the retention window with compliance before the next stage hardens the schema -->

- 2026-09-16T14:41:23Z — the single-target build (Q1: B) means the staging Amplify backend is never exercised from a device build; if a staging-only regression ever bites, revisit build flavors — every backend resource already supports it (per-branch outputs), so it is a client-only change.
