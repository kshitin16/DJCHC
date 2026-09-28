# Observability Requirements — auth-unit

> Unit-local IDs (`NFR-OBS.x`) — no inception-level observability NFR exists to derive these from; see traceability.json.

## NFR-OBS.1 — Metrics

- **Application metrics**: sign-in success count, sign-in failure count (by cause: user-cancelled vs. federation error), both emitted client-side via Amplify's own Auth hub events
- **Business metric**: distinct signed-in identities over time, as a proxy for the adoption goal stated in requirements.md (a quarter of the 300-1000 person community within a year)
- **Retention**: standard CloudWatch defaults are sufficient at this app's volume — no custom retention tier is configured

## NFR-OBS.2 — Logging

| Log Level | Event | Retention |
|---|---|---|
| INFO | Sign-in success (subject id only, never raw token contents) | 30 days |
| WARN | Sign-in failure (federation error, network error) | 30 days |
| ERROR | Unexpected Amplify Auth client exception | 90 days |

No sign-in attempt logs the ID token itself, the `sub`/`email` claims beyond what's needed to attribute the log line, or any Google-side credential — per the observability anti-pattern of logging sensitive data, and per NFR4's encryption/handling requirement extending to logs.

## NFR-OBS.3 — Tracing

Not applicable at this app's scale and topology — AuthUnit's sign-in flow is a single client-to-Cognito-to-Google round trip with no internal service-to-service hop that would benefit from distributed tracing. Amplify's client-side Auth hub events are sufficient to diagnose a failed sign-in.

## NFR-OBS.4 — Alerting

No paging alert is configured for this Unit — there is no on-call rotation for a solo-built community app (NFR8's testing posture already reflects this project's scale). A sustained rise in sign-in failure rate is something the builder would notice through normal use, not something worth an automated page.
