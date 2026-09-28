# Scope Definition — Questions

## Sources

- [desc] Initial description: "Mobile app (Flutter, single codebase for iOS+Android) for our Digamber Jain temple community. Backend: AWS, using Amplify Gen2 (Cognito for auth with Google federation, Amplify Data/AppSync+DynamoDB, S3 storage, Lambda functions). Features: (1) Content feed of temple happenings - event dates/times, donation call-outs, visiting saints/dignitaries - posted by admins through a simple in-app admin UI; admin access is Google sign-in restricted to an allowlist of admin Google accounts (Cognito Google federation + allowlist-gated admin group). (2) Online donations via UPI (PhonePe/Google Pay), including recurring/subscription donations - needs a payment aggregator with UPI Autopay support (e.g. Razorpay), account to be set up. (3) A library of Jain religious PDFs (daily poojan, vidhaans, bhaktamar, meri bhavna, etc.), browsable by category. (4) A suggestion box where users submit suggestions visible only to admins, not to other users."
- [scope] Workflow-selected scope: `temple-mobile-app`.

Consumed upstream artifacts:
- `aidlc/spaces/default/intents/260913-temple-community-app/ideation/intent-capture/intent-statement.md`
- `aidlc/spaces/default/intents/260913-temple-community-app/ideation/feasibility/feasibility-assessment.md` (flags the donation-aggregator entity KYC as an open precondition, and no fixed budget/deadline)
- `aidlc/spaces/default/intents/260913-temple-community-app/ideation/feasibility/constraint-register.md`

## Q1. The donation-aggregator account (Razorpay or similar) has an open precondition — the temple's tax-exemption status needs confirming before its merchant KYC can complete (flagged in Feasibility). Should donations wait for that account to be ready, or ship with the rest of the app from day one?

- A. Donations can wait — ship the content feed, PDF library, and suggestion box first; add donations once the aggregator account is confirmed ready
- B. Donations must be in the first release — hold the whole app's launch until the account is set up
- C. Build the donation feature in parallel with the rest, so it's ready to switch on the moment the account clears, even if it's not live on day one
- D. Not yet defined
- X. Other (please specify)

[Answer]: A. Donations can wait — ship the content feed, PDF library, and suggestion box first; add donations once the aggregator account is confirmed ready

## Q2. Within donations: is one-time UPI giving enough for the first release, with recurring/Autopay donations following once the aggregator fully supports it, or do both need to ship together?

- A. One-time donations first; recurring/Autopay can follow in a later release
- B. Both must ship together — recurring/Autopay is core to why this feature matters
- C. Not yet defined
- X. Other (please specify)

[Answer]: A. One-time donations first; recurring/Autopay can follow in a later release

## Q3. Of the four capabilities — content feed, donations, PDF library, suggestion box — which are must-have for the app to deliver its core value, and which could be deferred without the app failing its purpose?

- A. All four are must-have — none can be deferred
- B. Content feed and PDF library are must-have; donations and the suggestion box could follow in a later release
- C. Content feed and donations are must-have (the two problems named in Intent Capture); PDF library and suggestion box could follow
- D. Not yet defined
- X. Other (please specify)

[Answer]: X. Other — Content Feed and Suggestion Box are must-have for the first release. Donations and the PDF library can follow in later releases. A further future idea (not this release): a RAG-based AI-assisted chat to answer user questions about Jain religion.

## Q4. There's no fixed deadline for this project (confirmed in Feasibility). Given that, what should drive the build order — tackling the riskiest unknown first, delivering the most valuable piece first, or building one thin slice through every layer of the app before adding features?

- A. Risk-first — tackle the donation-aggregator dependency and any other real unknowns early, since they're outside your direct control
- B. Value-first — ship the content feed first, since it addresses the most immediate pain (no reliable place for announcements)
- C. Walking-skeleton-first — build one thin end-to-end slice (sign-in, one feed post, one PDF) that proves every layer works, then add features on top
- D. Not yet defined
- X. Other (please specify)

[Answer]: C. Walking-skeleton-first — build one thin end-to-end slice (sign-in, one feed post, one PDF) that proves every layer works, then add features on top

## Q5. Should the content feed's three content types (event dates/times, donation call-outs, visiting dignitaries) all launch together, or could donation call-outs be introduced specifically alongside the donation feature rather than in the first content-feed release?

- A. All three launch together as one content feed — donation call-outs are just another feed item type from day one
- B. Event dates and visiting-dignitary posts launch first; donation call-outs are added when the donation feature itself goes live
- C. Not yet defined
- X. Other (please specify)

[Answer]: B. Event dates and visiting-dignitary posts launch first; donation call-outs are added when the donation feature itself goes live

## Q6. For the PDF library — is a fixed initial set of categories and documents enough for the first release (with admins adding more later through the same admin UI), or does the category structure itself need to be flexible/admin-editable from day one?

- A. A fixed initial category list is fine — admins can add documents within those categories later; changing the category list itself can wait
- B. Categories need to be admin-editable from day one — the initial list is just a starting point, not a fixed structure
- C. Not yet defined
- X. Other (please specify)

[Answer]: A. A fixed initial category list is fine — admins can add documents within those categories later; changing the category list itself can wait

## Consolidated Summary Confirmation

Does this all look correct before I generate the artifact?

- Looks correct
- Request changes

[Answer]: Looks correct
