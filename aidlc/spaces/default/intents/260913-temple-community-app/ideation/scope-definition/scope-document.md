# Scope Document — Digamber Jain Temple Community App

## Overview

This document sets the in/out boundary for the first release of the app and names what follows in a later release, based on the confirmed answers in `scope-definition-questions.md`. It builds on the four capabilities named in Intent Capture (content feed, donations, PDF library, suggestion box) by sequencing them rather than dropping any of them.

## In Scope — First Release

| Capability | Detail | Source |
|---|---|---|
| Content feed | Event dates/times and visiting-saints/dignitaries posts, posted by admins through the in-app admin UI. Donation call-outs are excluded from this release's feed (see below). Public — no sign-in required to browse. | [Q3] [Q5] [desc] |
| Suggestion box | Users submit suggestions visible only to admins, not to other users. Requires sign-in to submit (per the access model confirmed in Intent Capture). | [Q3] [intent-statement.md] |
| Authentication foundation | Cognito Google federation, with an allowlist-gated admin group restricting admin access; needed by both must-have capabilities above. | [desc] |

## In Scope — Later Release

| Capability | Detail | Source |
|---|---|---|
| Donations | Online UPI donations (PhonePe/Google Pay) via a payment aggregator with UPI Autopay support (e.g. Razorpay). One-time donations ship first; recurring/Autopay donations follow once the aggregator fully supports it. Waits on the aggregator merchant account, which has an open precondition (the temple's tax-exemption status) flagged in Feasibility. | [Q1] [Q2] |
| Donation call-outs in the feed | Added to the content feed specifically when the donation feature itself goes live — not part of the first release's feed. | [Q5] |
| PDF library | Library of Jain religious PDFs, browsable by category, with a fixed initial category/document set; admins can add documents within those categories later. Changing the category structure itself is not required for this later release. | [Q3] [Q6] |

## Out of Scope (Not This Version — Documented for Future Consideration)

| Item | Why it's out | Source |
|---|---|---|
| RAG-based AI-assisted chat for Jain-religion questions | Raised as a future idea during scope definition, not part of either the first or the later release scoped here. Recorded so it isn't lost, not because it was rejected. | [Q3] |
| Admin-editable PDF category structure | The later PDF library release ships with a fixed initial category list; making categories themselves admin-editable is not required now. | [Q6] |

## Sequencing Approach

The build order follows a walking-skeleton-first heuristic: one thin end-to-end slice (sign-in through Cognito, one feed post, and confirmation that the admin allowlist gate works) is built first to prove every architectural layer works, before the remaining first-release features (the rest of the content feed, then the suggestion box) are added on top. [Q4] This was chosen over risk-first or value-first because there's no fixed deadline pressuring an earlier value delivery, and proving the full stack end-to-end first reduces the risk of discovering an integration problem late, which matters given the builder is new to both Flutter and AWS Amplify Gen2 (flagged in Feasibility).

## Assumptions & Open Questions

None.
