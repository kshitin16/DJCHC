# Observability Requirements — feed-unit

> Unit-local IDs (`NFR-OBS.x`) — no inception-level observability NFR exists to derive these from; see traceability.json.

## NFR-OBS.1 — Metrics

- **Application metrics**: listPosts call count/latency, mutation success/failure counts
- **Business metric**: post count over time (a light adoption/activity signal for the admin side)
- **Retention**: standard CloudWatch defaults

## NFR-OBS.2 — Logging

| Log Level | Event | Retention |
|---|---|---|
| INFO | Post created/edited/deleted (which admin, which post id, what changed) | 30 days |
| WARN | Non-admin attempting a mutation (BR2.3 refusal) | 30 days |
| ERROR | Unexpected query/mutation failure | 90 days |

Standard logging only, no special alerting (Q3, confirmed) — the builder is the one posting content and notices a mistake immediately.

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

Not applicable at this app's scale — each request path this Unit owns (list, create, edit, delete) is a single AppSync-to-DynamoDB hop.

## NFR-OBS.4 — Alerting

None configured — consistent with this project's default best-effort posture (the one deliberate exception being donation-unit's reconciliation-failure alert, which does not apply here).
