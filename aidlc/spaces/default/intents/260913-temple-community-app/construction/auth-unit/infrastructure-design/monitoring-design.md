# Monitoring Design — auth-unit

Implements NFR Design's observability-design.md (Amplify Auth Hub client-side events; no server-side alerting configured, consistent with this project's default posture) at the AWS platform level.

## Metrics & KPIs

| Metric | Source | Threshold | Why it matters |
|---|---|---|---|
| `SignInSuccesses` | Cognito's built-in CloudWatch metrics (User Pool) | None configured (no alerting, per NFR-OBS.4) | Visibility into sign-in volume; a sudden drop is a signal worth noticing manually, not an automated alert at this project's scale. |
| `SignInThrottles` | Cognito's built-in CloudWatch metrics (User Pool) | None configured | Would indicate Cognito's own rate limits being approached — not expected at this project's volume, tracked passively. |
| `TokenRefreshSuccesses` / `TokenRefreshFailures` | Amplify Auth Hub client-side events, forwarded to the app's existing client-side metrics sink (NFR Design) | None configured | The client-side signal for BR1.3's ≤1h admin-revocation-exposure window actually working as designed. |

## Alerts

None configured — consistent with this project's default posture (NFR-OBS.4, affirmed at NFR Design and carried forward here without change). Cognito's own AWS-managed availability and security monitoring (e.g. anomalous sign-in detection, if enabled) operates independently of this project's own alerting design.

## SLIs / SLOs

| SLI | SLO target | Measurement window |
|---|---|---|
| Sign-in success rate | No formal SLO — best-effort, matching NFR Design's reliability-design.md (no independent availability target beyond Cognito's own managed SLA) | N/A |

## Logs & Tracing

**Logging**: CloudTrail records every Cognito admin API call (group membership changes) by default — the accepted audit posture from NFR Requirements, requiring no additional CloudTrail configuration beyond ensuring CloudTrail is enabled account-wide (an account-level setting, not specific to this Unit). No application-level sign-in audit log is added beyond Amplify Auth Hub's client-side events (NFR Design).

**Tracing**: Not applicable — NFR Design already established this Unit has no internal service-to-service hop to trace (a single client-to-Cognito-to-Google flow).

**Dashboards**: No dedicated dashboard for this Unit at this project's scale (NFR Design) — `SignInSuccesses`/`SignInThrottles` are visible via the AWS Console's own Cognito metrics view if the builder wants to check manually.
