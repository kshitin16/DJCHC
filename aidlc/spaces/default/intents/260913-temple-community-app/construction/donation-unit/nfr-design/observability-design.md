# Observability Design — donation-unit

## Metrics architecture (NFR-OBS.1)

```
CloudWatch metrics (standard Lambda/AppSync built-ins: invocation count, duration, error
  count) for both the webhook Lambda and the scheduled-poller Lambda, plus a small set of
  custom metrics emitted via CloudWatch Embedded Metric Format (EMF) from within each
  Lambda: donations-initiated-count, donations-succeeded-count, donations-failed-count,
  reconciliation-failures-count.
```

## Structured logging (NFR-OBS.2)

```
Both Lambdas log structured JSON (timestamp, level, donationId, payment_id where relevant,
  event) to CloudWatch Logs — the standard Lambda logging destination, no separate log
  shipping designed. 90-day retention (financial activity, per NFR-OBS.2's existing spec)
  is set via each Lambda's `logRetention` CDK property at Infrastructure Design time.
```

## Alerting architecture (NFR-OBS.4, Q3)

```
Alert: Donation reconciliation failure
Trigger: the scheduled-poller Lambda, after its own reconciliation logic exhausts and a
  Donation still cannot be resolved to SUCCEEDED/FAILED, publishes a message to an SNS
  topic (donation-reconciliation-alerts) with the Donation id and relevant context.
Delivery: an email subscription on that SNS topic, pointing at the builder's own address —
  configured once, not per-alert.
No CloudWatch Alarm is used for this specific alert (the trigger condition is business
  logic inside the Lambda, not a metric threshold) — CloudWatch Alarms remain available for
  infrastructure-level concerns (e.g. Lambda error-rate spikes) as a separate, standard
  AWS observability layer, not designed further here.
```

## Tracing

Not applicable at this app's scale (NFR-OBS.3 already established this) — no distributed tracing infrastructure (X-Ray) is designed for this Unit's two-Lambda, single-hop-per-call topology.
