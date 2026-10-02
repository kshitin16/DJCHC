# Project-Level Rules

> Project-specific specialisation and corrections. Loaded after `org.md` and
> `team.md` as strict-additive guidance; contradictions with broader policy
> are rejected. Populated by practices-discovery and the self-learning loop.
>
> Use sparingly: most teams don't need a project layer. Reach for it
> only when this specific project needs stable, durable guidance beyond the
> team practice (for example, package-specific release checks or an additional
> regression suite for a legacy component).

## Way of Working

<!-- Project-specific specialisation. Example: -->
<!-- This monorepo requires package-scoped branch names and a package owner -->
<!-- review in addition to the team's normal merge policy. -->

## Walking Skeleton

<!-- Project-specific specialisation. Example: -->
<!-- The walking skeleton must exercise the legacy service adapter as well -->
<!-- as the new service boundary. -->

## Testing Posture

<!-- Project-specific specialisation. -->

- The per-unit test commands in this project are filters over a single Jest project, so run the backend suite once rather than once per unit; running every unit's scoped command executes the same tests repeatedly and double-counts results. (learned 2026-10-01) <!-- cid:260913-temple-community-app:build-and-test:c8e95d55f7de8dee6efaeea18c670203db70510ca72ee14edee927a5617ccbc6 -->

- At this project's scale the dominant performance risk is Lambda cold start rather than throughput, and a load-testing framework averages cold start away. Prefer device-side instrumentation plus CloudWatch duration and InitDuration metrics, reporting cold-start samples separately from warm ones. (learned 2026-10-01) <!-- cid:260913-temple-community-app:build-and-test:a27fd8032852a3e2249823b0fdec3aa3001dd2356fc46b797dfeac907860e38b -->

- A figure from five to ten samples is an observed value, not a p95. Record it with the sample count beside it and describe what was observed, rather than labelling it a percentile it cannot support. Choosing a lighter measurement is legitimate; reporting it as a stronger one is not. (learned 2026-10-01) <!-- cid:260913-temple-community-app:performance-validation:c2531dcdf70f5458d8ae0b125c0573db03b368f5f9ed20e03bed9fd174d4de07 -->

## Change Control

<!-- Project-specific. Mode: strict or relaxed. Strict here holds for every intent and cannot be changed from chat. -->

## Deployment

<!-- Project-specific specialisation. -->

- With a single permanent environment, a merge to main is a production deploy, so the pre-release checklist gates every merge rather than a separate promotion step, and branch protection requiring CI to pass is what makes that gate real. State the obligation a cheaper option carries rather than letting it look free. (learned 2026-10-01) <!-- cid:260913-temple-community-app:deployment-pipeline:c3d7496941f791e7a019ff88ddd0aa398259c75ed7bd377dd1545ff89226d076 -->

- A guardrail must not break the thing it protects. The spend cap is scoped to block creation of new resources and never to cut off AppSync or DynamoDB, and its policy scope is verified before it is armed, because a cost control that takes the temple's app offline to save a small sum inverts the priority it exists to serve. (learned 2026-10-01) <!-- cid:260913-temple-community-app:environment-provisioning:bde6947c9504038fcc0b14d898d3fbd101c172def07610ebed3ae77608ee4aa0 -->

## Code Style

<!-- Project-specific specialisation. -->

- When an automated formatter gate conflicts with deliberately hand-formatted documentation, narrow the gate's paths rather than reformatting the documentation, and keep the local script and the CI gate pointed at the same definition so they cannot diverge. (learned 2026-10-01) <!-- cid:260913-temple-community-app:ci-pipeline:b014cc26a3c3b37f8c753202429f1642d055a2a51670ef972a6114e8f735e2fa -->

## Tech Stack

<!-- Technology choices locked for this project. -->

## Decided

<!-- Decisions made in earlier stages that should not be re-asked. -->
<!-- Format: DECIDED: [decision] (Stage [slug], [date]) -->

## Scope Overrides

<!-- Custom scope rules for this project. -->

## Forbidden

<!-- Populated by practices-discovery affirmation gate. -->
<!-- Format: NEVER [behavior] (affirmed [date]) -->
<!-- Example: NEVER throw exceptions across service layer boundaries (affirmed 2026-05-17) -->

- NEVER store or transmit raw payment details (card numbers, UPI PIN) — (affirmed 2026-09-13)

even temporarily. All payment handling goes through the aggregator's own (affirmed 2026-09-13)

secure, tokenized flow (affirmed 2026-09-13, Q14 — option A). (affirmed 2026-09-13)

**Not elevated to a firm rule in this batch**: server-side-only enforcement (affirmed 2026-09-13)

of the admin allowlist gate (Cognito group / AppSync authorization rule, (affirmed 2026-09-13)

never a client-side-only check) was offered as a candidate rule in Q14 (affirmed 2026-09-13)

(option B) but was not among the options the human selected. It is not (affirmed 2026-09-13)

recorded here as Mandated/Forbidden; `team-practices.md` § Deployment notes (affirmed 2026-09-13)

it as a suggested good practice for future reference, clearly labeled as (affirmed 2026-09-13)

such rather than as an affirmed rule. (affirmed 2026-09-13)

## Mandated

<!-- Populated by practices-discovery affirmation gate. -->
<!-- Format: ALWAYS [behavior] (affirmed [date]) -->
<!-- Example: ALWAYS use Result<T,E> for fallible operations in service layer (affirmed 2026-05-17) -->

- ALWAYS restrict direct AWS Amplify access (imports of `package:amplify_*` (affirmed 2026-09-13)

and calls to generated AppSync/GraphQL operations) to the `services/` (affirmed 2026-09-13)

layer — screens and widgets must go through `services/`, never call (affirmed 2026-09-13)

Amplify directly (affirmed 2026-09-13, Q12). This is a firm rule, not a (affirmed 2026-09-13)

loose guideline: it keeps the blast radius of a future Amplify API (affirmed 2026-09-13)

change or storage-detail swap to one file per capability instead of (affirmed 2026-09-13)

every screen that touched Amplify. (affirmed 2026-09-13)

- ALWAYS encrypt personal data collected by the app (names, emails, (affirmed 2026-09-13)

donation records, suggestion-box submissions) both at rest and in (affirmed 2026-09-13)

transit (affirmed 2026-09-13, Q14 — option C). (affirmed 2026-09-13)

- ALWAYS check the payment aggregator's own record of what actually (affirmed 2026-09-13)

happened before treating a donation as succeeded or failed on the (affirmed 2026-09-13)

timeout path — never assume the outcome from the timeout alone (affirmed (affirmed 2026-09-13)

2026-09-13, Q14 — option D). (affirmed 2026-09-13)

- ALWAYS give any change touching sign-in, permissions, or (later) payment (affirmed 2026-09-13)

handling a brief self-review before merging, even though the builder is (affirmed 2026-09-13)

working solo (affirmed 2026-09-13, Q14 — option E). (affirmed 2026-09-13)

- ALWAYS run a pre-commit secret-scanning hook (`gitleaks` or (affirmed 2026-09-13)

`detect-secrets`) on staged diffs before every commit, and keep GitHub's (affirmed 2026-09-13)

built-in secret scanning, push protection, and Dependabot alerts enabled (affirmed 2026-09-13)

on the repository (affirmed 2026-09-13, Q13). Both layers were (affirmed 2026-09-13)

explicitly selected together, not as alternatives. (affirmed 2026-09-13)

Note: `org.md` already carries its own `## Mandated` entries (the (affirmed 2026-09-13)

conversation-language resolution/stability/preserved-tokens rules). Those (affirmed 2026-09-13)

are framework-tier defaults that apply automatically at every layer of the (affirmed 2026-09-13)

rule chain (org → team → project → phase) and are not restated here. (affirmed 2026-09-13)

## Corrections

<!-- Project-specific corrections from human feedback. -->
<!-- Format: NEVER/ALWAYS [behavior] (learned [date]) -->
- Adopt the AWS platform and compliance perspectives inline (rather than dispatching separately) whenever a stage runs in inline mode with support agents (learned 2026-09-13) <!-- cid:260913-temple-community-app:feasibility:d1537846573cc0b8a7a015045c40205480fdd75b87c0c32eed55de3d95457ff3 -->
- When a later, more specific answer narrows an earlier one, let it override rather than flagging a contradiction (learned 2026-09-13) <!-- cid:260913-temple-community-app:scope-definition:91f593e1df6f9f9fb5dcdd3be89627ae7a8d7d6aa635e720173f778605fc7192 -->
- When an answer lists multiple option numbers together, treat it as the union of those options rather than forcing a single pick (learned 2026-09-13) <!-- cid:260913-temple-community-app:rough-mockups:c7592d3ced50e0e1d5e38f7452c4bd089143d00594993256e97c3420946bf10c -->
- When brand/theme material is referenced (a photo, a file), read it directly and research the relevant symbolism rather than guessing (learned 2026-09-13) <!-- cid:260913-temple-community-app:rough-mockups:4463d1ddaa4a7ce40073e7c3d9c753c69c5bfc6714c0f00e37120e2ab16c8be8 -->
- Defer full five-state wireframes (empty/loading/success/error/partial) to Refined Mockups; note key states in prose at the rough stage (learned 2026-09-13) <!-- cid:260913-temple-community-app:rough-mockups:3c6f1e386d560274b770569f163fab26ac4e0237e1922c92aa88b46425b4faeb -->
- When a reply to a gate question is a genuine review/pause request rather than a matching option, honor it instead of forcing a fit (learned 2026-09-13) <!-- cid:260913-temple-community-app:approval-handoff:5bb003dde3a46174dd9997d8d4aff915499e6bf0c8f5d4cbe68f056f5f7ad5dd -->
- When market-research/team-formation are skipped stages, substitute equivalent questions (e.g. builder readiness) rather than asking questions that don't apply (learned 2026-09-13) <!-- cid:260913-temple-community-app:approval-handoff:4d9bdbf5811940bc7cc8131e4918fa67aed572b7904cdfcb31253b1d756b10c9 -->
- When a human asks to review prior decisions before a gate, give the full recap inline rather than just pointing to file paths (learned 2026-09-13) <!-- cid:260913-temple-community-app:approval-handoff:7593a20b4fd2316d5e81d5db2feaca22a5ce0f2f37df4ad80af0f15c0526847a -->
- Batch a large interview by cross-cutting topic rather than strictly by section boundary, when gaps span multiple sections (learned 2026-09-13) <!-- cid:260913-temple-community-app:practices-discovery:a5188ee1de8d8c11e057c3d573b9cbb7a9c928ca477e41eb6e9458f9bdb5fa7c -->
- Carry forward affirmed Mandated/Forbidden rules from Practices Discovery as explicit NFRs, since they're security-relevant and testable (learned 2026-09-13) <!-- cid:260913-temple-community-app:requirements-analysis:31a7f5ebd220fdc55d34492d71a949498ef6779116c415f8b658c551ec2f47a6 -->
- Use N/A/Deferred (not OK/GAP) for traceability items that are cross-cutting concerns or organizational preconditions, not component-design gaps (learned 2026-09-14) <!-- cid:260913-temple-community-app:domain-design:ae8f652736e03fd9a88fad80607ec5664819619e51eb6cd621956c9844c4f983 -->
- Avoid a component boundary with no feature surface on the other side of it (e.g. backend-only admin management) — fold it into the related component instead (learned 2026-09-14) <!-- cid:260913-temple-community-app:domain-design:8691841d6d7ccae6a4eff4dbbb026f394194851c170517fa39b7be168d9a2651 -->
- When a stage's own wording for a pre-generation checkpoint differs from the standard tokens, present the stage's wording to the human but persist the receipt using the tool's required literal tokens (learned 2026-09-14) <!-- cid:260913-temple-community-app:units-generation:d7a3dc94fa5e8e5bafdfaa099fd4cff3e5cfe98c098642b5a97bfadbeb2fa735 -->
- Consolidate near-duplicate contracts (same shape, multiple consumers) into one spec with a consumer list, rather than repeating the spec per consumer (learned 2026-09-14) <!-- cid:260913-temple-community-app:contract-design:ad511f5a84edaa8e3d845f7f8979842104e6b15890f10c75809bb84f4ba2e203 -->
- Use the integration mechanism's native spec format (e.g. GraphQL) rather than forcing everything into OpenAPI, when the stage allows it (learned 2026-09-14) <!-- cid:260913-temple-community-app:contract-design:159b3306938d22003508d8f8f318c785949a621fcf64f614e7d6762f54847c95 -->
- Before generating a unit's Functional Design artifacts, check whether new fields/enum values/mutations the interview surfaces are already reflected in the shared Contract Design artifact, and amend it proactively rather than waiting for a reviewer to catch the drift. (learned 2026-09-14) <!-- cid:260913-temple-community-app:functional-design:d7088543c815d510a9c60e3b49cadd8fe8bcd9c20c2a6ad69dafed3cec5b009b -->
- When enforcing a hard per-user rate limit or cap, use an atomic conditional write (e.g. a DynamoDB conditional UpdateItem) rather than a separate read-then-write count check, to avoid a race where concurrent requests both pass. (learned 2026-09-14) <!-- cid:260913-temple-community-app:functional-design:90d40b5dfc4cd74093fea0560a1769328eb2c552c404d51bdf50956ffe87db35 -->
- An entity's identifier field must be named exactly what the shared GraphQL contract calls it (e.g. `id`, not an internal name like `suggestionId`) — a silent rename invites a real implementation bug. (learned 2026-09-14) <!-- cid:260913-temple-community-app:functional-design:d94e46d07ccc13d7ce626d8d1110a59b159dd3fe3b59eaeb8dd22fe3eea162f3 -->
- Always state explicitly which layer actually enforces an authorization rule (declarative server-side AppSync/Amplify Data auth) versus which layer is only a UX convenience (client-side screen gating) — never leave this implicit. (learned 2026-09-14) <!-- cid:260913-temple-community-app:functional-design:cdeaa2d4317fef5a8124819946749db8a2b5d19d01884b4a675134d0239a68bb -->
- When the project has chosen to design the whole domain up front (not just first release), extend that same choice to UI screens for later-release capabilities too, rather than stopping the screen design short at what was wireframed. (learned 2026-09-14) <!-- cid:260913-temple-community-app:functional-design:476c7ccb08ee98414c4d8b9aff72ee92e661714e2ab4d82dc54b934797d2a7a5 -->
- A field name must make its unit of measurement unambiguous (e.g. `max_word_count` not `max_length` when the limit is words, not characters) — an ambiguous name invites the wrong validation to get implemented. (learned 2026-09-14) <!-- cid:260913-temple-community-app:functional-design:77fae6858d7c38f23b73dd5dfaff5d4c001f4785cad6cb18180cf082cf3c7099 -->
- When a backward jump reopens an already-approved stage to add one new capability, scope the re-interview to just the new capability rather than re-asking everything from scratch. (learned 2026-09-14) <!-- cid:260913-temple-community-app:requirements-analysis:02962175d03f58884daf85d3bd17b3ced6bec6e3f799b811a15acaf93ed72893 -->
- When a new decision supersedes an earlier one recorded in a document (like an Out-of-Scope line), strike it through with a supersession note instead of deleting it, so the record shows what changed and why. (learned 2026-09-14) <!-- cid:260913-temple-community-app:requirements-analysis:92b205b17f94d40d98dde22feaaa3a2651b3086f84f34c8d6705d094b9226b53 -->
- When an earlier stage flags an explicitly open technical question, resolve it directly (using the relevant specialist perspective) as soon as there's enough information, rather than deferring it further downstream. (learned 2026-09-14) <!-- cid:260913-temple-community-app:domain-design:61dce3c607ab9a17fd9542e5864b4b1db361e6e26a8df8cc4f5634c04d45657d -->
- When a review has disclosed the same open gap across multiple prior iterations or stages (e.g. an async contract's idempotency/terminal-state behavior), close it directly in the next pass that has enough information to resolve it, rather than letting it ride and be disclosed again a third or fourth time. (learned 2026-09-14) <!-- cid:260913-temple-community-app:functional-design:df319079c589cfabf5f4259f896f4af7a820f08bbbe04e9212ceeb6f36aac2ae -->
- When a requirement (FR) has no explicit business rule to trace to because an interview's answers only implied it, add the missing rule directly so traceability has a real target, rather than leaving it incomplete or implicit. (learned 2026-09-14) <!-- cid:260913-temple-community-app:functional-design:9b3038e1ed4b6008521192bea7375b46790e2524feced93274a6156ae2db1c19 -->
- When a requirement's literal wording (e.g. "on by default") cannot happen the way it is phrased given the data model, raise it as a clarifying question rather than silently inventing a mechanism to make the wording true. (learned 2026-09-14) <!-- cid:260913-temple-community-app:functional-design:84c6b444dbbfe18851c14732c472038e85edc6b7bf7cc50041a0a89646c63af8 -->
- When a later stage's review finds a genuine defect in an already-approved earlier artifact (e.g. a business rule's logic field missing a check its own workflow description assumed), fix that upstream artifact directly with an amendment note, rather than only patching the downstream document around it. (learned 2026-09-14) <!-- cid:260913-temple-community-app:nfr-requirements:50319a9f5707ac3105809980a43a4009bc3f836baf013feb85ca74d3e82e0962 -->
- When two units reuse the same engineering technique (e.g. an atomic conditional write), that shared technique does not by itself count as one unit's coverage of the inception requirement that originally motivated the technique elsewhere — check whether the requirement's actual subject matter is addressed, not just whether the same technique was reused. (learned 2026-09-14) <!-- cid:260913-temple-community-app:nfr-requirements:ef09482ea2828646f1202a449f98b7ed13bb5b4e4e81ceb45f53e99db6b09cc3 -->
- When renaming an identifier that is referenced across multiple sibling files, grep for the old identifier across all of them before considering the rename complete — a partial rename recreates the exact broken-cross-reference defect the rename was meant to fix. (learned 2026-09-14) <!-- cid:260913-temple-community-app:nfr-requirements:b44bd20b1caff3e346938cbd4360b6b089d6ebd256d2b6d04a679c088d9083b1 -->
- When a design decision relies on a third-party SDK plugin's crash/error-reporting behavior (e.g. Firebase Crashlytics), verify the plugin's actual documented wiring rather than assuming it — many such plugins require explicit application-level handler registration (e.g. FlutterError.onError, PlatformDispatcher.instance.onError) and do not wire error capture automatically on import. (learned 2026-09-14) <!-- cid:260913-temple-community-app:nfr-design:76e5526ac5e3d65cb59c736075e2e841461f7b906fa398be53758d132e08f6b0 -->
- The reminder module's Post-dateTime-change handling (BR7.8) is deliberately simplified to a no-op rather than an in-place reschedule, per the builder's explicit choice to favor a simple, flexible reminder module over a 100%-complete one: a Post date change surfaces as an additional Reminder on the affected device's next sync instead of rescheduling the existing one, which is left pointing at the stale date. When later stages (Infrastructure Design, Code Generation) touch this Unit's reminder-scheduling logic, preserve this simplicity trade-off rather than "fixing" it back toward full correctness unless the builder asks otherwise. (learned 2026-09-14) <!-- cid:260913-temple-community-app:nfr-design:0eb57f3987c26ee489069431307be2f492e1bc59b41341091f3321e2d47d88a5 -->
- When a Build and Test failure's root cause is the workflow scope rather than the generated code (for example a measurable target whose validation stage is SKIP), do not offer or take a loop-back to code-generation: it fixes nothing and a stage-attempt reset invalidates every unit's Plan Approval. Offer the scope recompose as the impact-estimated fix instead. (learned 2026-10-01) <!-- cid:260913-temple-community-app:build-and-test:0542efc9fe8ccd87b60e39f47093fa65600c5c6985246f63f5de2d4ce8684838 -->
- An organisational precondition that no code artefact can satisfy (such as a requirement blocked on external KYC or tax status) is recorded as N/A in traceability rather than as a coverage GAP, and tracked as a release blocker for the affected feature instead. (learned 2026-10-01) <!-- cid:260913-temple-community-app:build-and-test:1bb60f37a18fa9cd2aaa21f0047f219835fdf4c65170bbacea1b09252e554e11 -->
- When a stage's condition is "skip if it already exists and is adequate", adequacy is a judgement to be made by reading the existing configuration against the repository, never an assumption. Reading the CI workflow against .gitignore is what revealed that its app job would fail on its first run. (learned 2026-10-01) <!-- cid:260913-temple-community-app:ci-pipeline:7df14f5f1446cbd633474357ef7fe27ad5f14f7416e3ec2f36adaaaa4b3e64c8 -->
- When a stage whose declared outputs are documents finds a real defect in the configuration it is documenting, fix the configuration as well as describing it. Producing a document that accurately describes a broken pipeline while leaving it broken is worse than useless. (learned 2026-10-01) <!-- cid:260913-temple-community-app:ci-pipeline:13ab319f438056ce11162b9094bfcece955a7ab7fb9872f0a81b5b128008a0bc -->
- A phase-boundary verification record states NOT CLEAN when findings were accepted at a gate rather than fixed. Accepted risk is not the same as resolved, and a boundary record claiming clean when a requirement has nothing built toward it misleads whoever reads it next. (learned 2026-10-01) <!-- cid:260913-temple-community-app:ci-pipeline:2c05c8edbe168f56ad80283ab360f4ce822a0abc28a13df5eb67bf98c8e4f591 -->
- When a decision is right only under present conditions, record the condition that should reopen it rather than the decision alone. One backend environment is right while nobody is affected by a bad deploy and wrong once somebody is, so it is recorded as a posture with a named trigger (the arrival of real users) rather than as settled. (learned 2026-10-01) <!-- cid:260913-temple-community-app:deployment-pipeline:62761b987c21da3ffac60090d2f7258a6b72793c87502dde52f68ed3d8b4d174 -->
- Do not re-ask decisions an earlier stage already settled. Ask only what the upstream design left implicit or contradictory. Region, deploy mechanism, release gates and rollback procedure were all fixed at Infrastructure Design and were carried forward rather than re-interviewed. (learned 2026-10-01) <!-- cid:260913-temple-community-app:deployment-pipeline:4eab75a7e9f0e729717dd6516a04f2a8026b2679e127126c63cbd83cc959845f -->
- Verify an inventory or specification against the source it describes rather than against the upstream design documents. Checking this project's resources against amplify/**/resource.ts found four errors in the design documents, three of them an inaccurate claim that secrets live in AWS Secrets Manager when the code uses Amplify's secret() helper, which stores them free in SSM Parameter Store. (learned 2026-10-01) <!-- cid:260913-temple-community-app:environment-provisioning:1bc229b21f569197da726cd0c3c04794073b13823d59a8ce2a1ef90a3a251ce6 -->
- Never record a check as passing when it was not executed. Where a check could not run, mark it Not run and give the command that settles it. A false pass lets a deployment inherit confidence nothing earned, which is worse than an openly stated gap. (learned 2026-10-01) <!-- cid:260913-temple-community-app:environment-provisioning:4fa245ad69c827773cc458e7a09c82d2a23b56bd4bb6a653b2e9060b6a62359f -->
- A gap an upstream document records as blocking may have been closed since it was written. Survey the machine or environment directly before carrying such a gap forward, because a stale blocker is as misleading as a wrong one. Reading flutter doctor rather than trusting three documents is what revealed that Xcode, Android Studio and the Android SDK had been installed all along. (learned 2026-10-01) <!-- cid:260913-temple-community-app:deployment-execution:3a7600eac0a1e1026b9b68813f7cb9d175ed6b8eab1a7fee3ee460d107b8715e -->
- When a stage finds that an already-approved upstream document states something no longer true, amend that document in place with strike-through and a dated note rather than only describing the staleness in the current stage's output. A document that accurately describes a blocker which no longer exists misleads whoever reads it next. (learned 2026-10-01) <!-- cid:260913-temple-community-app:deployment-execution:a212a7797bcd800e37012173f53dc7ec2a7b4d19965d46264deaaaa2d563de15 -->
- When a declared SLO cannot be measured continuously, say so next to the target rather than letting it read as tracked. Two of this project's four SLOs are sampled by a manual profile run per release, so their error budgets never burn; an SLO that reads as measured but is not invites confidence nothing earned, which is worse than having no SLO. (learned 2026-10-01) <!-- cid:260913-temple-community-app:observability-setup:3b0f02e27d045f34821e0c143774f3bb6f7551755bb9ed612bde048960c9bda5 -->
- When a requirement cannot be implemented as written because the chosen mechanism does not work that way, amend the requirement with a dated supersession note recording what replaced it, rather than silently implementing the half that fits. NFR-OBS.2 specified log retention per level while CloudWatch sets it per log group. (learned 2026-10-01) <!-- cid:260913-temple-community-app:observability-setup:1c58f273a3cbdf7ef326bc5ebc4cd74fc4a53328648e36cfdde0de221f7899d2 -->
- Derive alarm thresholds from the service level objectives they protect rather than choosing them independently. Answers about alerting and about SLOs interact, and thresholds picked in isolation produce alarms unrelated to the thing they exist to defend. (learned 2026-10-01) <!-- cid:260913-temple-community-app:observability-setup:49f54f647d822ef42c0ca8aac3da9aa5895f5df065c128c0eda3f91ceb8b8a5e -->
- When a stage's declared output records a deliberate decision not to do something, write that decision and its reasoning out in full rather than leaving the artifact thin. An absent capability nobody wrote down is indistinguishable from one that was forgotten. (learned 2026-10-01) <!-- cid:260913-temple-community-app:observability-setup:d65c172eda9ad2c8d070df718feb620832f09c0e7150e1a844235896d8710410 -->
- When the human answers a question by saying they do not understand a concept it depends on, explain that concept concretely using this project's own numbers and then re-present the question. Do not treat the reply as a choice and do not press for one. A builder who knows Lambda well had never met the cold-versus-warm execution-environment distinction, and the right answer to the question turned entirely on it. (learned 2026-10-01) <!-- cid:260913-temple-community-app:performance-validation:e5365c2511c9ef7483cdf827474fbea4a873e0e1e93833738c6f2480f70dbbbd -->
- When a cost constraint decides a technical trade-off, record the signal that should reopen it rather than the decision alone. Provisioned concurrency was rejected on cost and the cold-start cost was written into the latency targets instead, with the community complaining about first-open slowness named as the observation that would prove the trade wrong. (learned 2026-10-01) <!-- cid:260913-temple-community-app:performance-validation:c13ce12953fe9fd1ce81fd440d5885e1228b4a8e16216f0d09245ed5970a62f3 -->
