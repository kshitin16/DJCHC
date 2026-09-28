# Feasibility Assessment — Digamber Jain Temple Community App

## Overview

This assessment covers technical viability, cost/architecture fit, and risk for the app described in Intent Capture: a Flutter mobile app on AWS Amplify Gen2, serving a content feed, UPI donations with recurring Autopay, a PDF library, and an admin-only suggestion box, for a domestic (India-only) temple community of roughly 300-1000 people, built and maintained by a single volunteer who is new to both Flutter and AWS.

## Technical Viability

**The chosen stack is a reasonable fit for this project's scale, but the builder's inexperience with it is the dominant technical risk, not the stack itself.**

- **Flutter** is a sound choice for "one codebase, both platforms" at this project's size — a single small team (here, one person) maintaining one feature set across iOS and Android. [Q4]
- **AWS Amplify Gen2** (Cognito, AppSync/DynamoDB, S3, Lambda) is a fully managed, serverless-native stack. For a community of 300-1000 people with intermittent, spiky usage (checking a feed, occasional donations, downloading PDFs), that traffic pattern favors managed, pay-per-use services over anything requiring capacity planning — this is a good architectural fit, not over-engineering for the scale involved.
- **Cognito Google federation with an allowlist-gated admin group** is a sound least-privilege pattern for the admin/public access split already confirmed in Intent Capture (admin, donation, and suggestion features require sign-in; the feed and PDF library are public). [desc]
- **The real risk is the builder, not the architecture**: the person building and maintaining this is new to both Flutter and AWS Amplify Gen2. [Q4] That doesn't make the project infeasible, but it means the standard-depth plan should expect a real learning curve, and the design stages that follow should favor well-documented, conventional patterns over anything clever or non-standard, so the builder isn't fighting the framework and the stack at the same time.

## Cost and Architecture Fit

- On-demand pricing for DynamoDB, Lambda's pay-per-invocation model, and S3's low per-GB storage cost all suit a workload this size and this unpredictable — the temple is unlikely to see costs materially above AWS's free tier in the app's first phase, though this is an estimate, not a quote, and should be revisited once real usage is known.
- Choosing an AWS region physically close to the user base (e.g. Mumbai, `ap-south-1`) is worth doing for latency and as a reasonable default for data-residency expectations, even though nothing in the confirmed answers makes this a hard legal requirement today. This is a recommendation for later infrastructure design, not a blocker now.
- No budget ceiling or deadline was set. [Q5] That removes one source of pressure, but "no deadline" combined with "new to the stack" is itself worth naming as a risk: without external pressure, the project's main risk becomes stalling rather than shipping late.

## Regulatory and Compliance Fit

- **Payments**: routing UPI donations through a payment aggregator such as Razorpay keeps the app itself outside the direct scope of PCI-DSS-equivalent card/payment-credential handling, provided the app never stores or transmits raw payment credentials itself — only the aggregator's tokenized flow.
- **FCRA (foreign donations)**: not a concern for this version, since donations are domestic-only. [Q3] This must be re-assessed if the scope ever expands to overseas or NRI donors — flagged as an assumption in the RAID log, not a closed question.
- **Entity status for the payment aggregator**: the temple is a registered trust/society, but its tax-exemption (80G/12A) status is unclear. [Q2] This is a real dependency for opening a Razorpay merchant account with UPI Autopay support — it's an organizational, not technical, item, and is tracked as a risk below.
- **Data protection**: the app collects personal data (Google account identity, donor information, suggestion-box submissions). India's data protection law (the DPDP Act) and general good practice both call for a stated purpose, data minimization, and a defined retention approach — this doesn't block feasibility, but it should be addressed explicitly during Requirements Analysis and Domain Design rather than left implicit.

## Conclusion

**Feasible.** The technology choices fit the project's scale and the confirmed access model. The two things that could genuinely block or delay the plan are organizational, not technical: the temple's tax-exemption status (a precondition for the donation aggregator) and the builder's unfamiliarity with the chosen stack (a pace risk, not a viability risk). Both are tracked in the constraint register and RAID log below rather than blocking this stage.

## Assumptions & Open Questions

- The temple's registered-trust status (without confirmed 80G/12A) will be sufficient for a UPI payment aggregator's merchant KYC — unconfirmed; needs to be checked directly with the chosen aggregator before donation work begins. [assumption]
- AWS costs will stay near the free tier at this community's scale — a reasonable estimate, not a guarantee, and should be revisited once real usage data exists. [assumption]
