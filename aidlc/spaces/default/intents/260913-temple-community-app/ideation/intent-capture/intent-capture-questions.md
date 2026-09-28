# Intent Capture & Framing — Questions

## Sources

- [desc] Initial description: "Mobile app (Flutter, single codebase for iOS+Android) for our Digamber Jain temple community. Backend: AWS, using Amplify Gen2 (Cognito for auth with Google federation, Amplify Data/AppSync+DynamoDB, S3 storage, Lambda functions). Features: (1) Content feed of temple happenings - event dates/times, donation call-outs, visiting saints/dignitaries - posted by admins through a simple in-app admin UI; admin access is Google sign-in restricted to an allowlist of admin Google accounts (Cognito Google federation + allowlist-gated admin group). (2) Online donations via UPI (PhonePe/Google Pay), including recurring/subscription donations - needs a payment aggregator with UPI Autopay support (e.g. Razorpay), account to be set up. (3) A library of Jain religious PDFs (daily poojan, vidhaans, bhaktamar, meri bhavna, etc.), browsable by category. (4) A suggestion box where users submit suggestions visible only to admins, not to other users."
- [scope] Workflow-selected scope: `temple-mobile-app`.

## Q1. What business problem is this app solving for the temple community today?

Right now, temple happenings, donations, religious resources, and member feedback likely flow through informal or scattered channels (word of mouth, a WhatsApp group, in-person only). Which best describes the core gap this app closes?

- A. No single reliable place for members to learn about events/donation calls/visiting dignitaries — information is scattered across word-of-mouth and informal channels
- B. No digital donation channel at all — donations are cash/in-person only today
- C. Both A and B — the app is meant to solve the information gap and the donation gap together
- D. Not yet defined
- X. Other (please specify)

[Answer]: C. Both A and B — the app is meant to solve the information gap and the donation gap together

## Q2. Who is the primary user of this app, and who else besides them will use it?

- A. Temple community members/devotees (for the content feed, donations, PDF library, suggestions) plus a small set of temple admins/trustees (for posting content)
- B. Only temple admins/trustees — this is primarily an internal tool
- C. A broader public audience beyond the existing temple community (e.g. visitors, prospective donors who aren't members yet)
- D. Not yet defined
- X. Other (please specify)

[Answer]: C. A broader public audience beyond the existing temple community (e.g. visitors, prospective donors who aren't members yet)

## Q3. What does success look like for this app, and what would you measure?

- A. Adoption — a target share of the temple community actively using the app (e.g. checking the feed, downloading PDFs)
- B. Donations — an increase in donation volume/frequency, or successful setup of recurring donations, compared to the current cash/manual process
- C. Reduced admin burden — admins spend less time re-announcing the same information across channels
- D. Not yet defined / no specific metric in mind yet
- X. Other (please specify)

[Answer]: A. Adoption — a target share of the temple community actively using the app (e.g. checking the feed, downloading PDFs)

## Q4. What's the trigger for building this now?

- A. A specific upcoming need (e.g. a renovation/donation drive, an increase in event volume) that made the lack of a digital channel acutely felt
- B. General modernization — the temple wants a proper digital presence and this is a good time to build it
- C. Personal initiative — you (as a community member with the skills) decided to build this as a contribution to the temple
- D. Not yet defined
- X. Other (please specify)

[Answer]: C. Personal initiative — you (as a community member with the skills) decided to build this as a contribution to the temple

## Q4a (follow-up). Q2 said the app is also for a broader public beyond the existing community — should non-member visitors get the same access as members (browsing the feed, donating, downloading PDFs) without creating an account, or is some of that members-only?

- A. Fully open — anyone can browse the feed, donate, and download PDFs without any account; only posting suggestions or admin actions need sign-in
- B. Mostly open, but donating requires at least a name/contact (no full account) for receipt purposes
- C. Members-only for everything except a public-facing donation page (donations are the one thing open to the wider public)
- D. Not yet defined
- X. Other (please specify)

[Answer]: X. Other — Admin functions, Donation, and Feedback (suggestions) should be possible only after the user has logged in. The rest (content feed, PDF library) is public information and should not require login.

## Q5. Who are the key stakeholders, and what does each care about?

- A. Temple trustees/management committee (own the content, donation accounts, final say on what's published) and general members (consume content, donate, submit suggestions)
- B. Just you, as the person building and maintaining this for the temple, with trustees signing off informally as needed
- C. A wider set including a temple treasurer (donation reconciliation) and a dedicated communications volunteer
- D. Not identified
- X. Other (please specify)

[Answer]: B. Just you, as the person building and maintaining this for the temple, with trustees signing off informally as needed

## Q6. Who decides scope or priority for this app going forward, and who influences those decisions?

- A. You decide, informally consulting temple trustees on major changes (e.g. what counts as an "admin," donation account details)
- B. A temple committee formally owns the roadmap and you implement their decisions
- C. Shared — you and trustees co-decide as equals
- D. Not yet defined
- X. Other (please specify)

[Answer]: A. You decide, informally consulting temple trustees on major changes (e.g. what counts as an "admin," donation account details)

## Q7. Are there communication requirements or a reporting cadence for this project (e.g. do you need to report progress to trustees, or is this informal)?

- A. Informal — no set reporting cadence; I'll show trustees the app when it's ready to use
- B. Periodic updates expected — trustees want to see progress at set intervals
- C. Formal sign-off required at key milestones (e.g. before launch, before enabling real donations)
- D. Not applicable
- X. Other (please specify)

[Answer]: A. Informal — no set reporting cadence; I'll show trustees the app when it's ready to use

## Q8. The workflow was started with scope `temple-mobile-app` (a custom 25-stage plan covering requirements, design, build, test, and deployment — skipping market research and team-formation since this is a single-community app with one maintainer). Does that match the product boundary you intend, or would you like to adjust it?

- A. Yes, that scope matches what I want — proceed as planned
- B. I want to narrow it further (e.g. skip more ceremony)
- C. I want to broaden it (e.g. add back a stage that was skipped)
- D. Not yet defined
- X. Other (please specify)

[Answer]: A. Yes, that scope matches what I want — proceed as planned

## Q3a (follow-up). Success is "adoption" (Q3) — what number would you actually count as success in the first year?

Q3 chose adoption as the success measure, but "a target share of the community" has no number attached, and a success metric that can't be checked can't be verified later. Roughly how many people are in the temple community, and what share of them using the app would you call a win?

- A. Community is roughly 100-300 people; success is about half of them installing and using the app within the first year
- B. Community is roughly 300-1000 people; success is about a quarter of them installing and using the app within the first year
- C. Success is better measured in activity than headcount — e.g. most temple events get seen in the app rather than needing a separate announcement
- D. Not yet defined — I'd rather set the target after launch, once I see real usage
- X. Other (please specify)

[Answer]: B. Community is roughly 300-1000 people; success is about a quarter of them installing and using the app within the first year

## Consolidated Summary Confirmation

Does this all look correct before I generate the artifact?

- Looks correct
- Request changes

[Answer]: Looks correct
