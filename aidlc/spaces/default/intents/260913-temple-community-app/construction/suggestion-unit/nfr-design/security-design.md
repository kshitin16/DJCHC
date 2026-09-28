# Security Design — suggestion-unit

## Authorization architecture (NFR-AUTHZ.1, unchanged from NFR Requirements)

No new design decision — the declarative AppSync owner/group auth rules on Contract 4's schema (`allow: owner` on myPastSuggestions, `allow: groups` on allSuggestions) are a schema-level configuration, not an infrastructure resource this stage designs further. This stage's only addition is the allSuggestions pagination-loop design (performance-design.md), which does not change the authorization boundary.

## Rate limiting design (NFR-RATE.1, TTL addition — Q2)

```
SuggestionDailyCount item shape: { pk: submittedByGoogleId, sk: <IST-date>, count: N,
  ttl: <epoch seconds> }
TTL formula (corrected at this stage's review, R-03, to remove ambiguity between an
  IST-anchored and a UTC-anchored calculation — DynamoDB TTL itself has no timezone
  awareness, it only compares epoch seconds):

  ttl = toEpochSeconds(startOfDay(dateKey, "Asia/Kolkata")) + 48 * 3600

  i.e. take the item's own IST date key, resolve its midnight moment in the Asia/Kolkata
  timezone (UTC+5:30) to an epoch-seconds value, then add 48 hours. This is the single,
  unambiguous anchor — not "the same date's UTC midnight," which would silently apply the
  wrong offset.
DynamoDB Time to Live attribute: `ttl`, enabled on the SuggestionDailyCount table/entity.
  AWS's own background TTL sweep deletes expired items at no write cost, typically within
  48 hours of the expiry timestamp (AWS's documented TTL deletion window) — chosen with
  enough margin (the item's own 48h buffer beyond IST midnight, plus AWS's own sweep
  window) that a count is never deleted while it could still be legitimately queried for
  that day.
This does not change BR3.5's atomic conditional-write logic (unaffected by TTL) — it is
  purely a storage-cost-hygiene addition, not a behavioral change to the rate limit itself.
```

## Encryption

At rest: AWS-managed DynamoDB encryption (NFR4.1). In transit: TLS 1.2+ on the AppSync endpoint. No change from NFR Requirements' existing spec.

## Process controls (NFR6.1)

```
Access-boundary rule: only services/suggestion_service.dart may call package:amplify_* for
  this Unit's client-side operations.
Change-review trigger: any change to suggestion_service.dart, the declarative owner/group
  auth rules on Contract 4's schema, the atomic rate-limit counter logic, or the new TTL
  configuration gets a brief self-review before merging.
```
