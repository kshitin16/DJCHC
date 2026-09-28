# Monitoring Design — feed-unit

Implements NFR Design's observability-design.md (standard AppSync CloudWatch metrics, custom post-count metric, AppSync CloudWatch Logs) at the AWS platform level.

## Metrics & KPIs

| Metric | Source | Threshold | Why it matters |
|---|---|---|---|
| AppSync resolver call count/latency/error rate (listPosts, listAllPostsForAdmin, getPost, createPost, updatePost, deletePost) | Standard AppSync CloudWatch metrics | None configured (no alerting, per NFR-OBS.4) | Baseline health of the Feed API surface. |
| `feed-post-count` | Custom CloudWatch metric, emitted from `createPost` (increment)/`deletePost` (decrement) | None | The running-total business metric NFR Design's own R-03 fix established, distinct from resolver call-count metrics. |

## Alerts

None configured — consistent with this project's default posture (auth-unit's own established pattern; donation-unit is the one deliberate exception, per NFR Design).

## SLIs / SLOs

| SLI | SLO target | Measurement window |
|---|---|---|
| N/A | No formal SLO — best-effort, matching NFR Design's reliability-design.md | N/A |

## Logs & Tracing

**Logging**: AppSync's own CloudWatch Logs integration, enabled at the API level (a standard Amplify Data/AppSync configuration flag) — resolver-level logging of who/when/what changed for mutations, per NFR-OBS.2's existing spec. No separate log-shipping infrastructure.

**Tracing**: Not applicable (NFR-OBS.3) — each request path is a single AppSync-to-DynamoDB hop.

**Dashboards**: No dedicated dashboard for this Unit.
