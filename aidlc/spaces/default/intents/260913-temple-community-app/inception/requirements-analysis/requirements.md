# Requirements — Digamber Jain Temple Community App (Sarovar Jinalaya)

## Intent Analysis

The builder is trying to give the Sarovar Jinalaya temple community a single reliable place for event information and, eventually, a digital way to donate — replacing scattered, informal channels with one app that serves both the existing community and a broader public audience. Success is adoption: roughly a quarter of a 300-1000 person community using the app within the first year. The first release focuses on the two capabilities that don't depend on external accounts (content feed, suggestion box); donations and the PDF library follow once the payment aggregator and content are ready. (Source: `intent-statement.md`, `scope-document.md`)

## Functional Requirements

### FR1 — Authentication & Access Control (First Release)

- **FR1.1** — Users sign in with their Google account via Cognito federation. (Source: `intent-statement.md`)
- **FR1.2** — Admin access is restricted to an allowlist of Google accounts, enforced via a Cognito admin group. The allowlist must be manageable without a code change — an editable list in the database, not a hardcoded value — from day one. (Source: Q3)
- **FR1.3** — The content feed and (later release) PDF library are publicly readable without signing in. Donating, submitting a suggestion, and admin actions all require sign-in. (Source: `intent-statement.md` Q4a)

### FR2 — Content Feed (First Release)

- **FR2.1** — Each feed post captures a title, a date/time, and a short text description. No photo attachment and no location field in this release. (Source: Q1)
- **FR2.2** — Feed posts have a type: Event or Visiting Dignitary. (The Donation Call-out post type is introduced with FR5, once donations ship — see FR5.3.) (Source: `wireframes.md`, `scope-document.md`)
- **FR2.3** — The feed displays posts in reverse-chronological order, most recent first.
- **FR2.4** — A feed post ages out of the main feed view 1 day after its event date. It is not deleted — only no longer shown in the default view. (Source: Q6a)
- **FR2.5** — Admins can create, edit, and delete feed posts through the admin UI. (Source: `wireframes.md` Screen 6, Practices Discovery Q5 admin-UI-depth decision)
- **FR2.6** — The feed is readable by anyone, signed in or not. (Source: `intent-statement.md`)

### FR3 — Suggestion Box (First Release)

- **FR3.1** — A signed-in user submits a suggestion as free text, up to 300 words. (Source: Q2)
- **FR3.2** — Every suggestion is tied to the submitting user's identity — there is no anonymous submission option in this release. (Source: Q2)
- **FR3.3** — Suggestions are visible only to admins, never to other users. (Source: `intent-statement.md`)
- **FR3.4** — A signed-in user can view their own past submitted suggestions (not other users' suggestions). (Source: `wireframes.md` Screen 4, Rough Mockups Q1)
- **FR3.5** — Admins do not have a read/resolved-tracking mechanism for suggestions in this release — that was explicitly not requested. (Source: Q2)

### FR4 — Localization (First Release)

- **FR4.1** — The app supports English and Hindi. (Source: Q5, Q5a)

### FR5 — Donations (Later Release)

- **FR5.1** — Users make one-time UPI donations (PhonePe/Google Pay) through a payment aggregator with a tokenized flow (e.g. Razorpay); the app never stores or transmits raw payment details. (Source: `intent-statement.md`, `scope-document.md`, Practices Discovery Forbidden rule)
- **FR5.2** — Recurring/subscription UPI Autopay donations follow one-time donations, once the aggregator account fully supports it. (Source: `scope-document.md` Q2)
- **FR5.3** — Once donations ship, the Donation Call-out post type is added to the content feed (FR2.2). (Source: `scope-document.md` Q5)
- **FR5.4** — This release is blocked on the temple's tax-exemption status being confirmed with the aggregator, and depends on donations remaining domestic-only (no FCRA registration exists). (Source: `raid-log.md`, `feasibility-assessment.md`)

### FR6 — PDF Library (Later Release)

- **FR6.1** — A library of Jain religious PDFs (daily poojan, vidhaans, bhaktamar, meri bhavna, and similar texts), browsable by category. (Source: `intent-statement.md`)
- **FR6.2** — The category list is fixed at this release's launch; admins add documents within those categories, but the category structure itself is not editable in this release. (Source: `scope-document.md` Q6)

### FR7 — Calendar & Reminders (First Release)

> Added after Functional Design's first pass, via a backward jump from `nfr-requirements` back to this stage. Requested directly by the builder mid-Construction, not present in the original Scope Definition. (Source: Requirements Analysis Q1-Q5b, redo pass)

- **FR7.1** — The app provides a calendar view of upcoming events, populated from the same admin-entered `Post` data the Feed already shows (FR2.1) — but only Event-type posts, not Visiting Dignitary posts. (Source: Q1)
- **FR7.2** — A day-before reminder is created automatically for every Event-type post — on by default, not opt-in. The user can turn a reminder off for an individual event, and separately has an app-wide toggle to turn all reminders off at once. (Source: Q3)
- **FR7.3** — Reminders are delivered as server-triggered push notifications. This explicitly reverses this project's earlier decision to exclude push notifications from the first release (see Out of Scope, below). (Source: Q2)
- **FR7.4** — The initial (non-snoozed) reminder fires at 9:00 AM IST the day before the event. (Source: Q5b)
- **FR7.5** — A reminder can be snoozed. Snoozing re-triggers it at a fixed 9:00 PM IST the same day (the day before the event) — a fixed clock time, not a relative offset from when snooze was tapped — and does not re-trigger at all if 9:00 PM IST has already passed by the time snooze is tapped. (Source: Q5, Q5a)
- **FR7.6** — A reminder auto-clears once the event's own `dateTime` has passed, whether or not the user ever acted on it. (Source: user's original request)
- **FR7.7** — A user can cancel a reminder for any individual event at any time. (Source: user's original request)
- **FR7.8** — Browsing the calendar never requires sign-in, matching the Feed's public-read model (FR2.6). Whether setting/managing a reminder requires sign-in is an OPEN TECHNICAL QUESTION for Domain Design to resolve: the strong preference is that reminders also require no sign-in at all, with "sign-in required for reminders only" as an acceptable fallback if a signed-in identity turns out to be technically necessary to reliably register a device for push and let a user manage their own reminders. (Source: Q4)

## Non-Functional Requirements

- **NFR1** — **Performance**: the feed shows content within 2 seconds on a typical mobile connection. (Source: Q7)
- **NFR2** — **Availability**: best-effort, matching AWS Amplify's managed-service availability — no specific uptime target is set for this community app. (Source: Q8)
- **NFR3** — **Security — payment data**: the app never stores or transmits raw payment credentials (card numbers, UPI PIN), even temporarily; all payment handling goes through the aggregator's own tokenized flow. (Source: `discovered-rules.md` § Forbidden)
- **NFR4** — **Security — personal data**: all personal data collected (Google identity, donation records once FR5 ships, suggestion-box submissions) is encrypted both at rest and in transit. (Source: `discovered-rules.md` § Mandated)
- **NFR5** — **Security — payment reconciliation**: on the future donation path, a timeout is never treated as a success or failure by default — the aggregator's own record of what happened is checked before resolving the donation's state. (Source: `discovered-rules.md` § Mandated)
- **NFR6** — **Security — access boundary**: only the `services/` layer may call AWS Amplify directly; any change touching sign-in, permissions, or (later) payment handling gets a brief self-review before merging. (Source: `discovered-rules.md` § Mandated)
- **NFR7** — **Accessibility**: standard WCAG AA baseline — no special large-text or simplified-navigation treatment beyond that baseline. (Source: Rough Mockups Q4)
- **NFR8** — **Testability**: test-after methodology; the walking-skeleton Bolt is held to a light smoke-level test bar throughout (including the admin allowlist gate, per the builder's explicit choice); the standard 80% line-coverage floor applies from the second Bolt onward. (Source: `team-practices.md` § Testing Posture)

## Constraints

- **Technical**: single Flutter codebase for iOS and Android; AWS Amplify Gen2 backend (Cognito, AppSync/DynamoDB, S3, Lambda) — both are fixed choices, not open for reconsideration. (Source: `intent-statement.md`)
- **Organizational**: solo builder, new to both Flutter and AWS Amplify Gen2; no fixed budget or deadline; every Construction Bolt is gated for the builder's review. (Source: `feasibility-assessment.md`, `team-practices.md` § Walking Skeleton)
- **Regulatory**: the temple is a registered trust with unclear tax-exemption status, a precondition for the donation aggregator's merchant KYC (FR5.4); donations are domestic-only, so FCRA registration is not required for this scope. (Source: `constraint-register.md`)
- **Repository/process**: GitHub, trunk-based development with squash-merge, GitHub Actions CI, pre-commit and GitHub-native secret scanning. (Source: `team-practices.md` § Way of Working, § Code Style)

## Assumptions

- The temple's registered-trust status will be sufficient for the payment aggregator's merchant KYC, even without confirmed tax-exemption — unconfirmed, to be checked directly with the aggregator before FR5 design work begins. (Source: `raid-log.md` A3) [assumption]
- AWS costs will stay near the free tier at this community's expected scale (300-1000 people, intermittent usage). (Source: `feasibility-assessment.md`) [assumption]

## Out of Scope

- A RAG-based AI-assisted chat for Jain-religion questions — a future idea, not part of either the first or later release. (Source: `scope-document.md`)
- Admin-editable PDF category structure — the later PDF release ships with a fixed category list. (Source: `scope-document.md` Q6)
- ~~Push notifications — explicitly not needed for the first release. (Source: Q4)~~ **SUPERSEDED** by FR7.3 (Calendar & Reminders redo pass): push notifications are now required for the first release, specifically to deliver day-before event reminders. Kept here, struck through, as a record of the original decision and why it changed, rather than silently deleted.
- Tablet-optimized layout — phone-only for the first release. (Source: Rough Mockups Q6)
- Server-side-only enforcement of the admin allowlist gate as a *firm, Mandated* rule — this was offered as a candidate hard rule during Practices Discovery and not selected; it remains a suggested good practice to follow at Code Generation time, not a binding requirement. (Source: `discovered-rules.md`)

## Open Questions

- AWS region choice (Feasibility suggested `ap-south-1`/Mumbai for proximity to the user base) remains deferred to Infrastructure Design, not resolved here. (Source: `constraint-register.md`, `team-practices.md` § Deployment)
- Whether reminders (FR7.2-FR7.7) can work without requiring sign-in (FR7.8's strong preference), or whether a signed-in identity is technically necessary to reliably register a device for push notifications and let a user manage their own reminders — deferred to Domain Design to resolve. (Source: Requirements Analysis Q4, redo pass)
