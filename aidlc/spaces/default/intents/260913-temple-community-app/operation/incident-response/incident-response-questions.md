# Incident Response — Questions

## Sources

- [scope] Workflow-selected scope: `temple-mobile-app`; Depth: Standard.
- Consumed: `operation/observability-setup/alarms.md` and `dashboards.md`; all seven units' `nfr-design/reliability-design.md` and `security-design.md`; `infrastructure-design/infrastructure-specification.md`; `operation/deployment-pipeline/rollback-runbook.md`; `operation/deployment-execution/health-check-report.md`.
- Rules: phases/operation.md § Incident Response (runbooks must include escalation paths and contact information; post-incident reviews required for P1/P2); team.md § Deployment Q8; project.md § Mandated.

## What is already settled and not re-asked

- **What reaches you**: four CloudWatch alarms, the donation reconciliation SNS email, and the Crashlytics new-fatal-issue email. All to one email address. Decided at Observability Setup Q1.
- **How to roll back**: redeploy the previous commit for the backend; halt the rollout and ship a higher build number for the app. `rollback-runbook.md`.
- **What triggers a rollback**: a failed smoke test. `deployment-execution/health-check-report.md`, including the two failures that must *not* trigger one.
- **No failover for the payment aggregator** — an aggregator outage degrades to "donations cannot be initiated", accepted at NFR Design.
- **Point-in-time recovery on all seven tables, S3 versioning with 90-day noncurrent expiry** — decided at Environment Provisioning Q1.
- **No automated restart or health-check endpoints** — there is no long-running compute to restart. Every component is invoked per event.

## The shape problem this stage has to solve

The standard incident-response playbook assumes an organisation: severity tiers
with sub-15-minute response times, an incident commander who coordinates while
others debug, a weekly on-call rotation with a trained secondary, a public
status page, and pre-drafted external communications.

This project has one volunteer with a day job, building for a temple community
of roughly 300-1000 people, funded personally. Transcribing that playbook would
produce a document describing a response capability that does not exist — the
same failure the project has already rejected twice, when `team.md` replaced the
org default's "tech lead + product owner sign-off" with a concrete solo
checklist, and when `environment-provisioning/validation-report.md` refused to
mark unexecuted checks as passing.

So these questions are about what response is actually promised, not what a
template says it should be.

## Q1. What response time is honestly committed?

The guide suggests under 15 minutes for a critical incident. That is only true if
someone is carrying a pager. Writing it down when nobody is would make the
incident plan fiction on its first page.

What matters most here is that the commitment matches reality, because the
document's whole value is that a future reader can trust it.

- A. Two tiers, both best-effort. **Urgent** (donations broken, nobody can sign in, data at risk) — look at it as soon as you see the email, same day. **Everything else** — next time you sit down with the project. No clock-based promise at all.
- B. Three tiers with loose target windows — urgent within a few hours, degraded within a day or two, minor whenever. Still best-effort, but with rough expectations written down.
- C. The standard four-tier SEV1-SEV4 model with defined response times, treated as an aspiration to grow into.
- X. Other (please specify)

[Answer]: X. Other (please specify) — "there is no Sev1 here and I don't need anything for incident response. It's a community application and there is nothing critical about it. Even if the critical issue is not resolved for a day, it won't matter" (the builder's own words). No severity tiers, no response-time commitment of any kind, not even best-effort same-day.

## Q2. How does the community find out when something is broken?

There is no status page and no in-app banner. If the app stops working on a
festival morning when people are checking event times, they currently have no way
to learn whether it is the app or their phone — and no way to tell you.

This is the gap most likely to matter in practice, because a temple community
will not file a bug report; they will simply stop using the app.

- A. Nothing formal — people who notice will mention it in person at the temple, and that is enough at this size.
- B. An existing community channel — if the temple already has a WhatsApp group or similar, post there when something is broken and when it is fixed. No new infrastructure.
- C. A simple in-app notice — a banner the app shows when the backend is unreachable, telling people it is a known problem rather than leaving them staring at an error. This is an app change, not a configuration one.
- D. B now, C added later when there are enough users for it to matter.
- X. Other (please specify)

[Answer]: A

## Q3. How much data loss and downtime is acceptable, per kind of data?

Point-in-time recovery is enabled on all seven tables, which makes restore
*possible*. Nothing has said how fast recovery should be or how much loss is
tolerable — and the answer is clearly not the same for a donation record as for
a feed post.

Setting these matters because they decide whether a restore is a calm procedure
or a panic.

- A. Two tiers. **Donation records**: zero tolerated loss, restore the same day — money people actually gave. **Everything else** (posts, documents, reminders, suggestions): a few hours of loss tolerable, restore within a few days.
- B. One tier for everything — a few hours of loss, restore within a day or two. Simpler to remember, treats a lost donation record the same as a lost feed post.
- C. Three tiers separating suggestions as well, since a lost suggestion is someone's unheard voice and cannot be reconstructed from anywhere.
- X. Other (please specify)

[Answer]: A

## Q4. Should anything respond automatically, or is every response manual?

There is no long-running service to restart, so the usual automated remediation
patterns mostly do not apply. Two places where automation is genuinely possible:

- The donation reconciler already retries every cycle. It could keep retrying longer before giving up and alerting.
- A failed EventBridge reminder invocation could be retried automatically rather than only being alarmed on.

Against that: automated remediation can mask a real fault and can loop. The
knowledge guidance is to always bound it.

- A. Everything manual. The alarms tell you; you decide. Simplest, and with this little traffic nothing is urgent enough to need a machine deciding.
- B. Bounded automatic retry on the two cases above, with the alarm still firing so you know it happened. Capped so it cannot loop.
- X. Other (please specify)

[Answer]: B

## Q5. What happens if you are unavailable?

This is the risk this stage can see most clearly and nothing upstream addresses.

One person holds the AWS account credentials, the Android upload keystore, the
Apple distribution certificate, the Firebase project and the Google OAuth client.
`deployment-strategy.md` already notes that losing the Android keystore is
unrecoverable — it would mean republishing under a new app id that existing users
see as a different app.

If you are travelling, ill, or otherwise unavailable, nobody can deploy a fix,
nobody can add an admin, and nobody can even find out what is wrong. For an app
meant to serve a temple community over years rather than months, that is an
operational gap, not a theoretical one.

- A. Document it as an accepted risk with a named trigger to revisit — the same shape as the one-environment decision. No action now.
- B. Credentials escrow only — put the AWS root recovery details, the keystore and its password, and the Firebase and Google account recovery paths somewhere a trusted second person can reach them if needed (a sealed envelope with a temple trustee, or a shared password-manager vault). No second operator, just recovery.
- C. B plus a named second person with read access to the AWS account and the alert emails, so somebody else at least knows when something is broken.
- D. B plus written continuity notes — what this system is, where everything lives, who to contact — so a future volunteer could pick it up.
- X. Other (please specify)

Worth saying plainly: B is roughly an hour of work and removes the
unrecoverable-keystore scenario entirely. The rest is judgement about how much
continuity this project should carry at its current size.

[Answer]: D

## Q6. Added after Q1 — what should this stage produce?

The answer to Q1 removed the basis for severity tiers, response-time
commitments, an escalation matrix and a communications plan. Three of this
stage's four declared outputs assume an incident-response process that the
builder has explicitly said this project does not need.

- A. A minimal recovery runbook only — drop the tiers and the matrix, keep restore/rollback/alarm-reading
- B. Skip the stage — its own condition is "when incident response procedures are needed", and they are not
- C. A minimal runbook plus the credential-escrow section
- X. Other (please specify)

[Answer]: B

## Outcome: stage reported skipped

This stage reports **skipped** against its own CONDITIONAL condition
("Execute when operational runbooks and incident response procedures are
needed"), on the builder's explicit decision that they are not needed for a
community application where a day of unresolved breakage would not matter.

This file is retained as the record of that decision and of two answers given
alongside it that are **not** incident-response procedures and were therefore
carried into the artifacts that own them, rather than lost with the skip:

| Answer | Carried to |
|---|---|
| Q3 — two recovery tiers, donation records separate (zero tolerated loss, same-day restore; everything else a few hours' loss, restore within days) | `environment-provisioning/validation-report.md` standing gaps; it qualifies the PITR decision already made there |
| Q4 — bounded automatic retry on the donation reconciler and on failed EventBridge reminder invocations, with the alarm still firing | `donation-unit/nfr-design/reliability-design.md` and `reminder-unit/nfr-design/reliability-design.md` |
| Q5 — credential escrow plus written continuity notes | `deployment-pipeline/cd-config.md` beside the keystore warning, and the standing-gaps register |

Reachable later with `/aidlc --stage incident-response` if the project ever
grows a reason to need one.
