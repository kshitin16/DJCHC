# Security Requirements — reminder-unit

## NFR4.1 — Data protection (inherits inception NFR4)

```
Classification: Reminder/DeviceToken records are Confidential — a device's own reminder set and
push token are not intended for other devices to read, even though no Google identity is
involved (BR7.6).
Encryption at rest: AWS-managed DynamoDB encryption (AES-256), per NFR4's blanket requirement.
Encryption in transit: TLS 1.2+ on the AppSync GraphQL boundary; push tokens themselves are never
transmitted over this Unit's own API beyond the initial registerDeviceToken call — delivery to
APNs/FCM is a separate, provider-managed channel outside this Unit's own network surface.
```

## NFR-AUTHZ.1 — Authorization (BR7.6) — the one Unit in this project using guest (unauthenticated)
identity instead of a Cognito User Pool token

```
Model: IAM auth mode via Amplify Data's allow.guest() — every operation (myReminders,
registerDeviceToken, setRemindersEnabled, snoozeReminder, cancelReminder) is scoped to the
caller's Cognito Identity Pool guest identity id, ownerIdentityId. No Google sign-in, no
cognito:groups check, and no Contract 1/2 involvement anywhere in this Unit.
Resource granularity: Row-level — every mutation/query is implicitly scoped to the caller's own
ownerIdentityId (BR7.5's cancel check, BR7.3's snooze check, myReminders' own scoping)
Delegation: None
Threat model basis (Q3, confirmed): a Cognito Identity Pool guest identity id is a long,
cryptographically-generated identifier bound to a device-specific set of temporary IAM
credentials — not a short, guessable, or enumerable value (unlike, say, a 4-digit PIN or a
sequential integer id). Guessing or brute-forcing another device's identity id to hijack its
reminders is not a realistic attack at this app's scale. Combined with this Unit's data being
low-sensitivity (which public Event posts a device has reminders for — not payment data, not
personal suggestions), guest-identity-only authorization is an accepted, deliberate design
choice, not an overlooked gap — stated explicitly here per this stage's review rather than left
implicit.
Audit: Standard logging (NFR-OBS.2) records mutation attempts; no alerting (Q4, confirmed).
```

## NFR-AUTHZ.2 — Push-token registration abuse (identified at this stage's review, R-02)

```
Contract 9's registerDeviceToken(pushToken, platform) accepts an arbitrary client-supplied
pushToken string, verified only against the caller's own guest identity (ownerIdentityId) —
NOT against proof that the token actually belongs to the calling device. A malicious guest
identity could register a real third party's push token against its own Reminder set, causing
that third party's device to receive unwanted notifications whenever the attacker's Reminders
fire.

ACCEPTED, not closed, at this app's scale: the impact is limited to unwanted push notifications
(no data exposure, no financial harm, no access to the victim's own account or data — the
victim's device simply receives a notification it didn't ask for, dismissible like any other).
Obtaining a real, valid push token for a specific victim device in the first place is not a
trivial attack (it requires access to that device's own push-registration flow, which this app
doesn't expose to other callers), making this a low-likelihood, low-impact residual risk rather
than one warranting the operational cost of platform-level token attestation at this project's
scale. Revisit if this ever becomes a real-world nuisance reported by users.
```

## NFR6.1 — Access-boundary and change-review process (inherits inception NFR6)

```
NFR-AUTHZ (process): only services/reminder_service.dart may call package:amplify_* or generated
AppSync/GraphQL operations for this Unit — including resolving/persisting the device's Cognito
guest identity and OS push-permission/token registration (frontend-components.md's own service
boundary) — screens/widgets never call Amplify directly (inherited firm rule, project.md
Mandated).

Trigger: a change to reminder_service.dart, the guest-identity authorization configuration, or
the Contract 8 Lambda handler's idempotency logic (BR7.10) requires a brief self-review before
merging (project.md Mandated, Q14 option E) — this Unit is directly named ("any change touching
sign-in, permissions...") even though its own auth model is guest-based rather than sign-in-based,
since the underlying Cognito Identity Pool configuration is exactly this class of change.
```

## Threat model (STRIDE)

| Threat | Applicable? | Mitigation |
|---|---|---|
| Spoofing | Low, per NFR-AUTHZ.1's threat-model basis — non-guessable guest identity ids | `ownerIdentityId` is resolved server-side from the caller's actual IAM credentials (Amplify Data's `allow.guest()`), never client-supplied as a plain field |
| Tampering | Yes — a caller attempting to modify another device's Reminder | BR7.3/BR7.5's owner-equality checks on snooze/cancel; the AppSync `allow.guest()` auth rule additionally scopes access at the schema level |
| Repudiation | Low — no dispute-resolution scenario for a low-stakes reminder toggle | `createdAt`/`registeredAt` timestamps exist if ever needed |
| Information Disclosure | Low | Reminder/DeviceToken content is not shared across devices; Contract 9 has no `Query` that returns any device's `DeviceToken` (including `pushToken`) — it is only ever returned to the caller as the direct response of that same caller's own `registerDeviceToken`/`setRemindersEnabled` mutation, never fetchable by another caller or via a separate read |
| Denial of Service | Low | Best-effort availability (NFR2); Contract 8's Lambda has its own AWS-managed concurrency/retry limits; no additional rate limiting added at this app's scale. Push-notification-harassment via a spoofed third-party token (registerDeviceToken accepting an unverified token) is a distinct, low-impact abuse vector — see NFR-AUTHZ.2 |
| Elevation of Privilege | Low — there is no elevated role in this Unit (no admin concept applies here) | N/A — every operation is scoped identically to the caller's own identity; there is no "Admin" analog to escalate to |
