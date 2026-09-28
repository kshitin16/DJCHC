<!-- INVARIANT: examples are single-line HTML comments so a fresh template parses to total=0 (MEMORY_EMPTY). Do NOT un-comment or split across lines. t100 guards this. -->
> This file is kept up to date automatically while the stage runs. Add observations at the review step, not by editing here directly.

## Interpretations
<!-- example: 2026-05-29T10:14:32Z — chose REST over GraphQL; the consuming team only needs CRUD, revisit if subscriptions land -->


- 2026-09-14T17:35:00Z — resolved the AWS region question (deferred by Feasibility) to ap-south-1, and the environment/promotion mechanism to Amplify Hosting's git-branch model, implementing team.md/org.md's already-affirmed deploy-on-merge-to-staging + manual-production-gate cadence without introducing a new mechanism.
<!-- aidlc-wave-memory:auth-unit:b1565c14137840739789a01ccd9a2356c5a1cb4000c07c69e90c53db8ebdca15 -->


- 2026-09-14T17:50:00Z — designed against Contract 7's own Razorpay-compatible placeholder shape rather than blocking on a real aggregator account; per-environment test/live Secrets Manager separation ensures staging can never move real money, applying the auth-unit review's own lesson (name every secret explicitly) proactively to a Unit with two payment-adjacent secrets rather than waiting for a reviewer to catch the same gap twice.
<!-- aidlc-wave-memory:donation-unit:811855a976341372931b3915fecce616672c8880fc608e3f80597e8ade36be9c -->


- 2026-09-15T15:25:00Z — after review flagged R-01: corrected the compute-model claim — AppSync direct resolvers cannot generate S3 pre-signed URLs (no native S3 data source, no SDK access), so this Unit does have one Lambda after all, backing the three signing/verification operations. NFR Design's "no Lambda needed" was right that the operation is fast and local, wrong that it needs zero compute.
<!-- aidlc-wave-memory:pdf-library-unit:f0ce3d8c7a384ee57aee14bfec5771df667f25c2059752a6c645edff0338e728 -->


- 2026-09-15T00:00:00Z — Region, environment strategy, and IaC approach were all inherited unchanged from auth-unit's already-approved Infrastructure Design rather than re-litigated; this Unit's own NFR Design had already fixed every unit-specific infrastructure decision (the `allSuggestions` Lambda split, the `SuggestionDailyCount` TTL table), so this stage's job was concrete AWS resource sizing/configuration, not new preference-gathering.
<!-- aidlc-wave-memory:suggestion-unit:08b8833e6d41c90cb3e620f9dc0be5a5ef8b8cb676d7a4ac4feff17028f062ff -->


- 2026-09-15T17:05:00Z — Selected Firebase Cloud Messaging as the push provider (deferred to this stage by NFR Design's security-design.md) because it reuses the Firebase project already established for Crashlytics client-side and gives one unified API for both iOS/Android, relaying to APNs automatically rather than a separate direct-APNs integration.
<!-- aidlc-wave-memory:reminder-unit:52b9615ad031c9747812366de272dfb6371676af1d7591a21784637645ae85b8 -->


- 2026-09-16T14:41:23Z — surfaced two provisioning items no prior stage named — the APNs authentication key upload to Firebase (without it FCM cannot reach iOS devices, so reminder-unit's push design silently fails on iOS) and the Cognito App Client custom-URL-scheme callback pairing with this Unit's platform manifests — rather than leaving them to be discovered as first-run failures.
<!-- aidlc-wave-memory:flutter-app-unit:077f2b214bd466c21445df6c619e6f5ae7b86aacc68400ee5011bffa680c03b7 -->


- 2026-09-16T14:41:23Z — treated Q1's `amplify_outputs.json` as Amplify Gen2's Dart-format outputs file (`lib/amplify_outputs.dart`, `--format dart`) since that is what the Flutter client actually consumes; the JSON form is the same generated content in a shape the app cannot import directly.
<!-- aidlc-wave-memory:flutter-app-unit:2a8bceb950d99a42f523fbd9fe3eefca5a1276e7d1d3112ad81c040968087ad0 -->

## Deviations
<!-- example: 2026-05-29T10:14:32Z — skipped the optional caching layer the stage prose suggested; the dataset is small enough that it adds risk -->


- 2026-09-14T17:42:00Z — after review flagged R-01/R-02: added the Google OAuth Client ID/Secret (Cognito's external-IdP credential, distinct from the Cognito App Client's own no-secret PUBLIC config) as a named infrastructure dependency and CI/CD secret, and documented the per-environment Google Cloud Console redirect-URI registration step that the per-branch Amplify Hosting model requires.
<!-- aidlc-wave-memory:auth-unit:8ffbcd68cf5e1b1482c8b0a3c7130279afc96b84e6f314fafae02ab2fcfe41d9 -->


- 2026-09-14T17:56:00Z — after review flagged R-01/R-02: added a `statusIndex` GSI (status + createdAt) so the reconciliation Lambda can actually discover PENDING Donations, and corrected functional-spec.md's own Payment Status Reconciliation workflow (an upstream defect, not just an infra-design gap) — the webhook's real lookup key is `order_id`→`id` (GetItem), never `payment_id`, which is used only for the idempotency comparison.
<!-- aidlc-wave-memory:donation-unit:84c871f0e9be4928a51cfde56aa0e41d9e8c47a1cedb2c44951dc432e86121b7 -->


- 2026-09-16T16:46:46Z — after review flagged R-01: the app-facing Cognito callback/sign-out URLs (custom URL scheme) were wrongly described as already provisioned by auth-unit; auth-unit's approved Infrastructure Design covers only the Cognito→Google redirect. Reworded as an explicit, open obligation this Unit imposes on auth-unit's `amplify/auth/resource.ts` at Code Generation, rather than amending auth-unit's already-reviewed artifact.
<!-- aidlc-wave-memory:flutter-app-unit:dbc94e411c4dc45fee1987cffe44fe7fc5bf56948c9b1d23ed64b0b53fd46b8e -->


- 2026-09-16T14:41:23Z — the interview surfaced a contradiction (Q1 no-flavors vs. Q2 per-flavor Firebase apps) that the stage's own question set did not anticipate; resolved through a follow-up (Q5) rather than silently picking one answer, and the resolution (one Firebase app per platform + Crashlytics disabled in debug builds) is what the artifacts implement.
<!-- aidlc-wave-memory:flutter-app-unit:e12a096034c8121688f26f87328b17b446d179cf31c3cd4d3f44f58d932875b3 -->

## Tradeoffs
<!-- example: 2026-05-29T10:14:32Z — picked TDD over BDD this run; the team is unit-first and the domain is well-understood -->


- 2026-09-15T17:05:00Z — Implemented deliver-push and auto-clear as two separate Lambda functions rather than one branching on schedule name (both were valid per NFR Design's logical-components.md) — a cleaner IAM boundary per function outweighs the minor duplication.
<!-- aidlc-wave-memory:reminder-unit:def1b24d34ae2e54c5e6de082b1607baaaeca00496487fd94a53b9c3b91056a8 -->


- 2026-09-16T14:41:23Z — designed CI to stub `lib/amplify_outputs.dart` rather than generate it with `ampx generate outputs` — keeps AWS credentials out of CI entirely (the builder's Q4 choice) at the cost of CI never compiling against a real backend config; `flutter analyze` is the compile-level check and `flutter build` is deliberately not run in CI.
<!-- aidlc-wave-memory:flutter-app-unit:6038ac392ef9a1e9197d1979a09a22c0610148083b8e74b6754b04947ab859ae -->

## Open questions
<!-- example: 2026-05-29T10:14:32Z — confirm the retention window with compliance before the next stage hardens the schema -->

- 2026-09-16T14:41:23Z — the single-target build (Q1: B) means the staging Amplify backend is never exercised from a device build; if a staging-only regression ever bites, revisit build flavors — every backend resource already supports it (per-branch outputs), so it is a client-only change.
<!-- aidlc-wave-memory:flutter-app-unit:97f0032323181ac8a942fb638b55a227a0d683d02eb8ddd79aefceac6207ae2f -->
