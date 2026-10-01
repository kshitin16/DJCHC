# CD Configuration

## Sources

- [scope] Workflow-selected scope: `temple-mobile-app`.
- Consumed: `deployment-strategy.md` (this stage); `construction/ci-pipeline/ci-config.md`; `construction/ci-pipeline/quality-gates.md`; every unit's `infrastructure-design/cicd-pipeline.md`.
- [Q1] One permanent environment. [Q2] No deploy branch.

## What is configured where

Nothing in this project's CD lives in a pipeline file. That is deliberate and worth
stating plainly, because someone looking for a `deploy.yml` will not find one.

| Mechanism | Configured in | Holds credentials? |
|---|---|---|
| Backend deploy | Amplify Console — app settings, branch connection | AWS-side; nothing in the repo |
| Backend secrets | AWS Secrets Manager / SSM, referenced by name from `amplify/auth/resource.ts` etc. | Never in the repo, never in Actions |
| App build and release | The builder's machine, manually | Local Keychain and `android/key.properties`, both gitignored |
| CI verification | `.github/workflows/ci.yml` | **Zero secrets** |

The CI workflow holding no secrets at all is a real property, not an accident: it
follows from building releases locally and from Amplify Hosting deploying itself.
It means CI can safely run on a fork's pull request. Adding a deploy job to Actions
later would forfeit that, and should be a deliberate trade rather than a drift.

## Amplify Console setup (one-time, manual)

Not yet done — these are prerequisites for any deploy.

1. **Create the Amplify app**, region `ap-south-1`.
2. **Connect the GitHub repository** and add **one branch: `main`**. Do not add a second branch environment (Q1) — each one provisions a full, separately billed resource set.
3. **Enable auto-build on `main`.** A merge becomes a deploy.
4. **Set the backend secrets** for the `main` environment:
   - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` — from the Google Cloud Console OAuth client
   - `FCM_SERVICE_ACCOUNT_JSON` — from the Firebase project's service account
5. **Register the OAuth redirect URI** in the Google Cloud Console once the Cognito hosted-UI domain exists: `https://<domain>/oauth2/idpresponse`. A chicken-and-egg step — the domain is only known after the first deploy, so the first sign-in attempt will fail until this is done.
6. **Note the Amplify app id**; `ampx generate outputs` needs it.

## Backend deploy

**Trigger:** merge to `main`. **Mechanism:** Amplify Hosting auto-build.
**Strategy:** in-place reconciliation of the deployed stack against the source.

**Gate:** the CI workflow plus the pre-release checklist, both before the merge.
With one environment the merge *is* the production deploy, so there is no second
gate afterwards and nothing downstream to catch a mistake.

**Branch protection is what makes that gate real.** In GitHub repository settings,
require the CI workflow to pass before merging to `main`. Without it, CI reports
and a merge can proceed over a red run — straight to production. This is the single
highest-value setting in this document and it takes a minute.

## App release

Fully specified in `deployment-strategy.md`. Configuration that lives outside the
repo:

| Item | Where | Status |
|---|---|---|
| Android upload keystore + `android/key.properties` | Builder's machine, backed up in a password manager | Not created |
| Apple Distribution certificate + provisioning profile | Xcode automatic signing, local Keychain | Not created |
| Play Console app entry | Google Play Console | Not created |
| App Store Connect app entry | App Store Connect | Not created |
| APNs auth key (`.p8`) | Downloaded once from Apple, uploaded once to Firebase, local copy deleted | Not created |
| `google-services.json` / `GoogleService-Info.plist` | Committed — non-secret config, API key restricted to the registered app ids | Not created |

Losing the Android upload keystore is unrecoverable without Play App Signing
enrolment: it would mean publishing under a new application id, which existing
users would see as a different app. Back it up before the first release.

> **Resolved in principle 2026-10-01 at Incident Response (Q5), carried here
> when that stage reported skipped.** The decision is **credential escrow plus
> written continuity notes**: the keystore and its password, the AWS account
> recovery details, and the Firebase and Google account recovery paths go
> somewhere a trusted second person can reach — a sealed envelope with a temple
> trustee, or a shared vault — alongside notes on what this system is and where
> everything lives, so a future volunteer could pick it up. **Not yet done**,
> and it is the single highest-value hour of work outstanding on this project:
> every other failure here is recoverable, and this one is not.

## Environment variables and configuration

| Name | Where set | Notes |
|---|---|---|
| Backend secrets | Amplify Console, per environment | Referenced by name via Amplify's `secret()`; resolved at deploy time by the deploying role |
| `lib/amplify_outputs.dart` | Generated, gitignored | Real file from `ampx generate outputs --branch main`; stubbed in CI by `tool/stub_amplify_outputs.sh` |
| `DONATIONS_ENABLED` | Compile-time constant, currently false | Flipping it needs the aggregator account and the two donation majors closed first |
| Feature flags (`--dart-define`) | Release build command | A release build without them silently ships with donations and the PDF library off — put them in the release script |

## First deploy — expected order

1. Install the Android SDK and Xcode. Nothing app-side works without them.
2. Create the Firebase project and register both app ids against `in.sarovarjinalaya.app`.
3. Create the Google Cloud OAuth client.
4. Push the branch — the CI workflow runs for the first time.
5. Set branch protection on `main`.
6. Create the Amplify app and connect `main`; set the secrets; let the first deploy run.
7. Register the OAuth redirect URI now that the Cognito domain exists.
8. `ampx sandbox` locally and run the eight integration checks — **IT-1 first.**
9. Fix what IT-1 finds, then the rest.

Steps 1–3 are prerequisites with no workflow involvement. Step 8 is where the real
verification this project has never had actually begins.
