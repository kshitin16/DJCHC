# Observability Requirements — suggestion-unit

> Unit-local IDs (`NFR-OBS.x`) — no inception-level observability NFR exists to derive these from; see traceability.json.

## NFR-OBS.1 — Metrics

- **Application metrics**: submit call count/latency, myPastSuggestions/allSuggestions call count/latency
- **Business metric**: suggestion count over time (an engagement signal)
- **Retention**: standard CloudWatch defaults

## NFR-OBS.2 — Logging

| Log Level | Event | Retention |
|---|---|---|
| INFO | Suggestion submitted (submitter, timestamp — not the suggestion text itself, to keep log volume/sensitivity low); 5/day cap hit (Q2, confirmed) | 30 days |
| WARN | Submission attempt exceeding the 300-word limit (BR3.1 refusal) | 30 days |
| ERROR | Unexpected query/mutation failure | 90 days |

Declarative AppSync auth refusals (BR3.3) are NOT captured in this Unit's own application logging — see NFR-OBS.4 below.

> **Amended 2026-10-01 at Observability Setup.** CloudWatch Logs sets retention
> per log GROUP, not per log level, so the per-level split above cannot be
> configured as written. Resolved at that stage (Q2): **30 days on every log
> group except `donation-webhook` and `donation-reconciler`, which are 90 days.**
> ERROR lines outside the two donation functions are therefore retained 30 days
> rather than 90 — a deliberate narrowing chosen with the trade-off visible, and
> one that reduces how long personal data in log context survives
> (`environment-provisioning/validation-report.md` check C-5). The per-level
> table above remains the record of what was originally asked for. See
> `operation/observability-setup/log-queries.md`.

## NFR-OBS.3 — Tracing

Not applicable at this app's scale — each request path (submit, view own, view all) is a single AppSync-to-DynamoDB hop.

## NFR-OBS.4 — Unauthorized-access visibility (Q1, confirmed)

```
Since BR3.3's owner/group authorization rules are enforced declaratively by AppSync itself,
before any resolver code runs, an unauthorized attempt (a non-admin calling allSuggestions, or
any caller attempting to read another user's myPastSuggestions) never reaches this Unit's own
application code — there is no event for this Unit's logging to capture. Visibility into such
attempts relies entirely on AppSync's own CloudWatch access logs (an API-level, project-wide
setting, not something configured per-Unit here). This is a genuine architectural property of
declarative authorization, not an observability gap this Unit's design needs to work around.
```

## NFR-OBS.5 — Alerting

None configured — consistent with feed-unit's and pdf-library-unit's posture. The one deliberate exception in this project remains donation-unit's reconciliation-failure alert, which does not apply here.
