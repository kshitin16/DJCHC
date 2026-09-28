# Intent Statement — Digamber Jain Temple Community App

## Problem Statement

Information about temple happenings and the ability to give money to the temple are two separate gaps today, and this initiative closes both together: there is no single reliable place for the community to learn about events, donation call-outs, and visiting dignitaries, and there is no digital donation channel at all — giving is cash and in-person only. [Q1]

The initiative addresses those gaps through a mobile app on a single Flutter codebase for iOS and Android, backed by AWS Amplify Gen2 (Cognito for authentication with Google federation, Amplify Data/AppSync with DynamoDB, S3 storage, and Lambda functions). [desc]

The app carries four capabilities: [desc]

- A content feed of temple happenings — event dates and times, donation call-outs, and visiting saints and dignitaries — posted by admins through a simple in-app admin UI, where admin access is Google sign-in restricted to an allowlist of admin Google accounts (Cognito Google federation plus an allowlist-gated admin group). [desc]
- Online donations over UPI (PhonePe and Google Pay), including recurring and subscription donations, which requires a payment aggregator with UPI Autopay support such as Razorpay; that account is still to be set up. [desc]
- A library of Jain religious PDFs — daily poojan, vidhaans, bhaktamar, meri bhavna and similar texts — browsable by category. [desc]
- A suggestion box where users submit suggestions that are visible only to admins and not to other users. [desc]

## Target Customer

The app serves a broader public audience beyond the existing temple community, including visitors and prospective donors who are not members. [Q2]

Access is split between what is open and what requires an account: administrative functions, donating, and submitting feedback are available only after the user has signed in, while the content feed and the PDF library are public information and require no sign-in. [Q4a]

## Success Metrics

| Metric | Target | Source |
|---|---|---|
| Adoption of the app across the temple community — members actively using it, such as checking the feed and downloading PDFs | Roughly a quarter of a community of approximately 300-1000 people install and use the app within the first year | [Q3] [Q3a] |

## Initiative Trigger

The initiative is a personal one: a community member with the necessary skills decided to build the app as a contribution to the temple, rather than in response to an external deadline or mandate. [Q4]

## Initial Scope Signal

| Signal | Value | Source |
|---|---|---|
| Workflow-selected scope | `temple-mobile-app` | [scope] (workflow-selected) |
| User-confirmed product boundary | The 25-step plan as proposed — requirements, design, build, test and deployment, with market research and team-formation excluded — matches the intended product boundary and proceeds as planned | [Q8] |

## Assumptions & Open Questions

None.
