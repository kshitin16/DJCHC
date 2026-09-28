---
name: temple-mobile-app
depth: Standard
keywords: []
description: Composed plan for a real production app that moves real money, starting greenfield with no existing tests or CI
skeleton: on
runner: true
change_control: strict
---

# temple-mobile-app scope

Composed for a single-community mobile app (Flutter + AWS Amplify Gen2) that
processes recurring UPI donations, so Risk and Verification Entropy both
score HIGH despite the project being small in scope. Standard depth, but
tuned to skip the ceremony that only pays off for a multi-team or
market-facing product.

Change Control defaults to strict: an input that changes after approval
reopens that approval rather than being recorded and continued, because both
risk (real payments) and verification entropy (brand-new codebase) are high.

## Why these stages, why skip those

Kept: the full inception design pass (domain-design, units-generation,
contract-design, functional-design) because four fairly separate feature
areas share one backend and the payment/subscription lifecycle needs a
written design before code. Kept the full operation phase (deployment,
environments, observability, incident-response) because this ships to real
users handling real money, unlike an MVP that stops at proving the product.

Skipped market-research and team-formation (one fixed community, one
maintainer — nothing to research or coordinate), user-stories and
refined-mockups (personas are simple and one rough-mockup pass already
covers UX direction), delivery-planning (~5 units mostly depending on one
shared thing, expressible inline in units-generation), and
performance-validation and feedback-optimization (no stated performance
target for a small user base, and post-launch iteration is separate future
work).

## Membership

Composed scope, not keyword-inferable — resolves only via `--scope
temple-mobile-app`. See `aidlc/spaces/default/intents/` for the originating
composition record.
