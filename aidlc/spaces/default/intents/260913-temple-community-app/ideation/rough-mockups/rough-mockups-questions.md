# Rough Mockups — Questions

## Sources

- [desc] Initial description: "Mobile app (Flutter, single codebase for iOS+Android) for our Digamber Jain temple community. Backend: AWS, using Amplify Gen2 (Cognito for auth with Google federation, Amplify Data/AppSync+DynamoDB, S3 storage, Lambda functions). Features: (1) Content feed of temple happenings - event dates/times, donation call-outs, visiting saints/dignitaries - posted by admins through a simple in-app admin UI; admin access is Google sign-in restricted to an allowlist of admin Google accounts (Cognito Google federation + allowlist-gated admin group). (2) Online donations via UPI (PhonePe/Google Pay), including recurring/subscription donations - needs a payment aggregator with UPI Autopay support (e.g. Razorpay), account to be set up. (3) A library of Jain religious PDFs (daily poojan, vidhaans, bhaktamar, meri bhavna, etc.), browsable by category. (4) A suggestion box where users submit suggestions visible only to admins, not to other users."
- [scope] Workflow-selected scope: `temple-mobile-app`.

Consumed upstream artifacts:
- `aidlc/spaces/default/intents/260913-temple-community-app/ideation/intent-capture/intent-statement.md`
- `aidlc/spaces/default/intents/260913-temple-community-app/ideation/scope-definition/scope-document.md` (first release = content feed + suggestion box; donations and PDF library are a later release)
- `aidlc/spaces/default/intents/260913-temple-community-app/ideation/scope-definition/intent-backlog.md`

These mockups cover the first release only (content feed, suggestion box, and the auth/admin foundation both depend on) — donations and the PDF library will get their own mockups when that later release is scoped in detail.

## Q1. What are the key screens for the first release, beyond the feed itself?

The scoped first release is: browse the feed (public), sign in, submit a suggestion (signed-in), and the admin posting UI (admin-only). Is that the complete screen set, or is something missing?

- A. That's the complete set — feed, sign-in, suggestion submission, admin posting
- B. Also need a screen to view past submitted suggestions (the user's own, not others')
- C. Also need a basic account/profile screen (even if just showing the signed-in Google identity)
- D. Not yet defined
- X. Other (please specify)

[Answer]: X. Other — All three: the base set (feed, sign-in, suggestion submission, admin posting) is needed, plus a screen to view the user's own past submitted suggestions, plus a basic account/profile screen showing the signed-in Google identity

## Q2. What's the core first-time-visitor flow — what should someone see and do the very first time they open the app?

- A. Straight to the feed, no sign-in prompt — browsing is public, so nothing should block that first view
- B. A brief one-time welcome/intro screen explaining what the app is, before landing on the feed
- C. Not yet defined
- X. Other (please specify)

[Answer]: A. Straight to the feed, no sign-in prompt — browsing is public, so nothing should block that first view

## Q3. Is there an existing visual identity for the temple (logo, colors, a name/wordmark) the app should reflect, or is this a blank slate?

- A. There's an existing logo and/or color scheme the app should use
- B. No existing visual identity — this is a blank slate; use sensible defaults for now
- C. Not yet defined
- X. Other (please specify)

[Answer]: A. There's an existing logo and/or color scheme the app should use

## Q4. The temple community likely spans a wide age range, including older members who may not be highly comfortable with mobile apps. Should the design lean toward extra-large text and simplified navigation beyond the WCAG AA baseline, or is standard mobile-app sizing appropriate?

- A. Lean larger/simpler than typical — default to larger text sizes and minimal navigation depth, given the likely age range
- B. Standard mobile sizing is fine — WCAG AA baseline (the design agent's default) covers this without special treatment
- C. Not yet defined
- X. Other (please specify)

[Answer]: B. Standard mobile sizing is fine — WCAG AA baseline (the design agent's default) covers this without special treatment

## Q5. How simple should the admin posting UI be — a bare single-purpose form, or something closer to a small content-management screen (list of past posts, edit/delete existing posts)?

- A. Bare minimum — a form to create a new post; editing/deleting can be a later-release admin capability
- B. Needs edit and delete of existing posts too, even in the first release — admins will make mistakes and need to fix them
- C. Not yet defined
- X. Other (please specify)

[Answer]: B. Needs edit and delete of existing posts too, even in the first release — admins will make mistakes and need to fix them

## Q6. Any specific phone form-factor priorities — is this phone-only, or should tablet layouts also be considered for the first release?

- A. Phone-only for now — tablet layout is not a first-release concern
- B. Should scale reasonably to tablets too, even if not pixel-perfect
- C. Not yet defined
- X. Other (please specify)

[Answer]: A. Phone-only for now — tablet layout is not a first-release concern

## Q3a (follow-up). What's the temple's name/wordmark for the app, and are there specific colors or a logo file to reference?

Since there's an existing identity to use, the wireframes and later refined mockups need something concrete to reflect — even a temple name and a couple of brand colors is enough to note now; exact logo files can come later.

- A. I'll provide the temple's name and describe the colors/logo now
- B. Use a placeholder for now ("[Temple Name]") and I'll supply the real identity details before Refined Mockups
- X. Other (please specify)

[Answer]: A. Temple name: Sarovar Jinalaya. Theme reference: photo SarovarJinalay.jpeg — the temple building's facade is a warm mustard/gold-ochre yellow with white architectural trim, and displays the Jain Ahimsa hand symbol (white hand bearing the dharmachakra wheel and swastika) on the facade. Also use traditional Digambar Jain symbol colors as accents where appropriate: the Jain Pancharangi flag's five colors — white (peace/ahimsa, arihants), red (truthfulness, siddhas), yellow (non-stealing, acharyas), green (chastity, upadhyayas), and blue (non-attachment, sadhus).

## Consolidated Summary Confirmation

Does this all look correct before I generate the artifact?

- Looks correct
- Request changes

[Answer]: Looks correct
