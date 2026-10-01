# Rollback Runbook

## Sources

- [scope] Workflow-selected scope: `temple-mobile-app`.
- Consumed: `deployment-strategy.md`, `cd-config.md` (this stage); every unit's `infrastructure-design/cicd-pipeline.md`; `inception/contract-design/contract-summary.md`.
- [Q1] One permanent environment. [Q2] No deploy branch.

## The asymmetry to internalise first

**The backend can be rolled back. The app cannot.**

A bad backend deploy is reverted by redeploying the previous commit — minutes, and
every user is back to the old behaviour. A bad app release reaches devices
gradually and permanently: neither Play nor the App Store can downgrade a device
that already updated. The only remedy is stopping the spread and shipping a fix
forward.

That asymmetry should shape how carefully each side is gated. It is also why the
app path carries the heavier manual checklist.

## Backend rollback

**Triggers** — any of:

- Errors spiking in CloudWatch after a deploy
- Sign-in failing (the whole app depends on it)
- An operation returning Unauthorized that previously worked
- A deploy that succeeded but produced a schema the app cannot call

**Procedure:**

1. **Confirm it is the deploy.** Compare the deploy timestamp in the Amplify Console against when the symptom started. A coincidence here wastes a rollback.
2. **Amplify Console → the `main` branch → deployment history → redeploy the last known-good build.** Amplify retains prior deployments per branch.
3. **Watch the redeploy complete**, then re-check the symptom.
4. **Revert the source** with `git revert` on `main` so the next deploy does not reapply the same change. A redeploy without a revert is a rollback that undoes itself on the next merge — the most common way a rollback fails to stick.
5. **Verify** sign-in and one read path manually.

**Expected time:** a few minutes for the redeploy; the diagnosis usually takes longer.

### What rolls back cleanly, and what does not

| Change | Reverts cleanly? |
|---|---|
| Lambda handler logic | Yes — code is replaced |
| Cognito configuration (groups, token lifetimes, sign-up policy) | Yes, declaratively. Already-issued tokens keep their original lifetime; Cognito does not retroactively invalidate them |
| AppSync resolvers and auth rules | Yes |
| IAM policy scoping | Yes |
| **Adding a DynamoDB table or index** | Reverting *removes* it. Safe only if nothing shipped depends on it |
| **Removing a field or operation** | **Not safely.** A shipped app version still calls it. See below |
| **Data already written** | Never. A rollback reverts schema and code, not rows |

### The one that bites: contract removal

Contract changes are additive by the ownership rules in `contract-summary.md`, and
that is precisely what makes app-version skew survivable — an older app keeps
working against a newer backend.

It cuts the other way on rollback. If a deploy *added* a field the new app version
calls, rolling the backend back removes it, and every user already on that app
version breaks. They cannot downgrade.

**So: never roll the backend back past a change a shipped app version depends on.**
Roll forward with a fix instead. If you are unsure whether a shipped version
depends on it, assume it does.

## App rollback

There is no server-side artefact. The blast radius is exactly the devices running
the bad build.

### Android

1. **Play Console → the release → halt the staged rollout.** Immediate. Users who have not yet received the update stay on the previous version — which is why staged rollout exists and why a 20% first step is worth the patience.
2. Devices already updated **stay updated**. Play offers no downgrade.
3. Either re-promote the previous release to resume serving it to new installs, or ship a fixed build with a **higher** build number.
4. Affected users get the fix on the next update.

### iOS

1. **App Store Connect → pause the phased release.** Same effect, same limitation.
2. A previous build cannot be re-submitted under the same version number.
3. Ship a fixed build; request **expedited review** if users are materially affected. Expedited review is a favour, not a guarantee — do not plan around it.

### The implication

Because the app cannot be rolled back, the pre-release checks are the real control,
not the rollback. A staged rollout that starts at 20% and a day's patience before
promoting is worth more than any rollback procedure on this side.

## Scenarios

### Sign-in broken after a backend deploy

Highest severity — everything depends on it. Redeploy the previous backend build
immediately, then diagnose. If the deploy touched `amplify/auth/resource.ts` or the
Google OAuth secrets, suspect those first. A newly registered redirect URI that was
never added to the Google Cloud Console produces exactly this and is **not** fixed
by a rollback.

### Reminders not firing

Lower severity, no rollback needed. Check the EventBridge Scheduler group for
schedules, then `deliver-push` logs. Known open finding: a device syncing after the
intended send time can leave a reminder that never fires — see the reminder unit's
review. That is a code defect, not a deploy problem, and a rollback will not help.

### Signed-in users cannot use reminders, guests can

**Expected.** This is IT-1, predicted before any deploy: the app calls in IAM mode
while the schema's rule may accept that only for guests. Not a rollback — the fix is
adding `allow.authenticated('identityPool')` to the five reminder operations and
redeploying forward.

### A donation was charged but shows as failed

Cannot happen yet — `DONATIONS_ENABLED` is false. When it is flipped, this is the
scenario the two open donation majors describe, and both must be closed first.
Never resolve a payment outcome from the app's own state; the aggregator's record
decides. That is a Mandated rule.

### CI was red and someone merged anyway

With one environment, that merge deployed to production. Revert the merge on `main`
and let Amplify redeploy. Then set branch protection, which is what would have
prevented it.

## After any rollback

1. Write down what happened and when, while it is fresh.
2. Add a test that reproduces it — `org.md`'s "every defect gets a test".
3. If the deploy gates would not have caught it, say so explicitly and decide whether a new gate is worth its cost.
4. Only then ship the fix forward.

## Not covered here

Data recovery. No backup or point-in-time-recovery strategy has been designed for
the DynamoDB tables or the S3 bucket — Infrastructure Design did not specify one
and no stage has owned it since.

This runbook reverts code and configuration. **It cannot recover deleted or
corrupted data.** For an app holding donation records and suggestion submissions,
that is a real gap, and the natural owner is Environment Provisioning (4.2): enable
DynamoDB point-in-time recovery and decide an S3 versioning or lifecycle posture
before anything holds data that matters.
