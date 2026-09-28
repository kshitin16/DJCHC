# Feasibility & Constraints — Questions

## Sources

- [desc] Initial description: "Mobile app (Flutter, single codebase for iOS+Android) for our Digamber Jain temple community. Backend: AWS, using Amplify Gen2 (Cognito for auth with Google federation, Amplify Data/AppSync+DynamoDB, S3 storage, Lambda functions). Features: (1) Content feed of temple happenings - event dates/times, donation call-outs, visiting saints/dignitaries - posted by admins through a simple in-app admin UI; admin access is Google sign-in restricted to an allowlist of admin Google accounts (Cognito Google federation + allowlist-gated admin group). (2) Online donations via UPI (PhonePe/Google Pay), including recurring/subscription donations - needs a payment aggregator with UPI Autopay support (e.g. Razorpay), account to be set up. (3) A library of Jain religious PDFs (daily poojan, vidhaans, bhaktamar, meri bhavna, etc.), browsable by category. (4) A suggestion box where users submit suggestions visible only to admins, not to other users."
- [scope] Workflow-selected scope: `temple-mobile-app`.

Consumed upstream artifact: `aidlc/spaces/default/intents/260913-temple-community-app/ideation/intent-capture/intent-statement.md` (confirms the project owner/maintainer decides scope and priority, consulting temple trustees informally on major changes such as donation account details).

## Q1. What existing systems, if any, does this app need to integrate with or replace?

Right now the temple likely coordinates through informal channels. Understanding what's being replaced (vs. left running alongside the app) affects migration work and whether any legacy data needs to move in.

- A. Nothing to integrate with — this is the temple's first digital system; no existing data or tools to migrate
- B. Replaces an informal channel (e.g. a WhatsApp group or mailing list) used for announcements — no structured data to migrate, but the app needs to become the new default
- C. There's an existing donation record system (spreadsheet, ledger, or accounting software) that donation history should reconcile with or migrate from
- D. Not yet defined
- X. Other (please specify)

[Answer]: A. Nothing to integrate with — this is the temple's first digital system; no existing data or tools to migrate

## Q2. Is the temple a registered legal entity (e.g. a registered trust or society), and does it already hold any tax-exemption registration (like 80G/12A)?

This matters because Razorpay (and most UPI payment aggregators) require KYC business/entity verification to open a merchant account for recurring UPI Autopay donations — an unregistered or informal temple committee typically cannot open one directly.

- A. Yes, registered as a trust/society with active tax-exemption registration (80G/12A or equivalent)
- B. Yes, registered as a trust/society, but tax-exemption status is unclear or not yet obtained
- C. No formal registration — the temple operates informally today
- D. Not yet defined / need to confirm with trustees
- X. Other (please specify)

[Answer]: B. Yes, registered as a trust/society, but tax-exemption status is unclear or not yet obtained

## Q3. Will donations be accepted only from donors inside India, or also from overseas/NRI donors?

This is a real constraint, not a detail: donations from foreign sources to an Indian entity are regulated under India's Foreign Contribution (Regulation) Act (FCRA), which requires separate registration and a dedicated FCRA bank account — UPI donations alone typically do not satisfy this, and getting it wrong has legal consequences for the temple, not just the app.

- A. Domestic donors only (within India) — no FCRA exposure for this version of the app
- B. We do expect overseas/NRI donors and the temple already has (or is pursuing) FCRA registration
- C. We do expect overseas/NRI donors but FCRA registration is not yet in place
- D. Not yet defined
- X. Other (please specify)

[Answer]: A. Domestic donors only (within India) — no FCRA exposure for this version of the app

## Q4. What's your own comfort level with the proposed stack (Flutter + AWS Amplify Gen2), and are you building this solo or with any help?

You're the sole builder and maintainer (confirmed in Intent Capture). Since Amplify Gen2 (Cognito, AppSync, DynamoDB, Lambda) and payment-aggregator integration both carry a real learning curve, this shapes how much can realistically be built in the standard-depth plan versus what should be trimmed or phased.

- A. Experienced with both Flutter and AWS already — this is within my comfort zone
- B. Experienced with one of the two (e.g. mobile dev, but AWS/Amplify is new to me, or vice versa)
- C. New to both — this is a learning project as much as a build project
- D. Not yet defined
- X. Other (please specify)

[Answer]: C. New to both — this is a learning project as much as a build project

## Q5. Are there budget or timeline constraints that should shape this plan?

AWS usage, an Apple Developer account (~$99/year), a Google Play developer account (~$25 one-time), and a Razorpay merchant account all carry direct costs, and some (Apple/Google publishing) have review lead time before the app can go live.

- A. No fixed budget or deadline — this is a personal project running at its own pace, self-funded for now
- B. There's a target date (e.g. an upcoming festival or event) the app should be live for
- C. There's a budget ceiling the temple has set, and costs need to stay within it
- D. Not yet defined
- X. Other (please specify)

[Answer]: A. No fixed budget or deadline — this is a personal project running at its own pace, self-funded for now

## Q6. Who will own the AWS account, the Apple/Google developer accounts, and the Razorpay merchant account — you personally, or the temple as an organization?

This affects both the constraint register (who can approve spend, who's the point of contact for compliance/KYC) and continuity if you were ever unable to maintain the app.

- A. All accounts under my personal name/ownership, informally on the temple's behalf
- B. All accounts should be under the temple's legal entity where the entity supports it (trust/society)
- C. Mixed — some personal (e.g. AWS), some entity-owned (e.g. Razorpay, which likely requires it)
- D. Not yet defined
- X. Other (please specify)

[Answer]: C. Mixed — some personal (e.g. AWS), some entity-owned (e.g. Razorpay, which likely requires it)

## Consolidated Summary Confirmation

Does this all look correct before I generate the artifact?

- Looks correct
- Request changes

[Answer]: Looks correct
