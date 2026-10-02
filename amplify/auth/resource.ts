/**
 * auth-unit (U1) — Cognito User Pool configuration for the Sarovar Jinalaya app.
 *
 * This Unit owns no data entity, Lambda or resolver; its whole behaviour is this
 * configuration plus the token policy in `./token-policy` applied by
 * `amplify/backend.ts`.
 *
 * Rules realized here (functional-design/rules.md, nfr-design/security-design.md):
 * - BR1.1  identity is established by Google federation through Cognito; the ID
 *          token carries `sub` and `email` (Contract 1).
 * - BR1.2  admin = `cognito:groups` claim contains "Admin" (Contract 2); the
 *          group is declared here, membership is administered out-of-band
 *          (README, "Administering the Admin group") — FR1.2's editable list.
 * - BR1.4  no first-sign-in special case: no custom trigger, no self-sign-up
 *          branch (see `selfSignUpDisabled` in ./token-policy).
 * - NFR3.1 PUBLIC App Client (no client secret), Authorization Code + PKCE —
 *          Amplify Gen2 configures the hosted-UI OAuth flow this way for a
 *          `defineAuth` with external providers; `backend.ts` asserts that no
 *          secret is generated.
 * - NFR3.2 `cognito:groups` is issued natively by Cognito for group members —
 *          no pre-token-generation Lambda is needed.
 * - NFR3.4 Google OAuth credentials are `secret()` references resolved at deploy
 *          time from the Amplify secret store, never literals in source.
 * - NFR3.5 any change to this file gets a brief self-review before merge
 *          (project.md Mandated).
 */
import { defineAuth, secret } from '@aws-amplify/backend';

/** The parameter type `defineAuth` accepts — exported so tests can type against it. */
export type AuthConfig = Parameters<typeof defineAuth>[0];

/**
 * Plain, testable configuration object. Exported separately from `auth` so unit
 * tests can assert on its shape without synthesizing any CDK construct.
 */
export const authConfig = {
  loginWith: {
    // `defineAuth` requires an email or phone sign-in attribute even for a
    // federation-only pool. The app never exposes email/password sign-in
    // (BR1.1: Google only) and self-registration is disabled in backend.ts.
    //
    // Side effect worth knowing about: because the pool declares this sign-in
    // attribute, Amplify puts `COGNITO` into the App Client's
    // `SupportedIdentityProviders` alongside `Google`, so the Cognito hosted UI
    // still renders a username/password form. It is INERT, not a second way in:
    // `applyTokenPolicy` (see ./token-policy) sets
    // `AdminCreateUserConfig.AllowAdminCreateUserOnly = true`, so no native
    // account can be self-registered, and no native account is ever created
    // administratively — every user profile in this pool comes from the Google
    // federation flow and therefore has no password to sign in with. The form
    // has nothing to authenticate against.
    //
    // It is left in place rather than overridden because narrowing
    // `supportedIdentityProviders` changes a sign-in surface, which is exactly
    // the kind of change project.md's Mandated self-review rule covers; it was
    // not in this Unit's approved plan. The app itself never shows the hosted UI
    // login page — flutter-app-unit launches the Google provider directly — so
    // the only way to see the form is to hand-craft a hosted-UI URL.
    email: true,
    externalProviders: {
      google: {
        // Resolved from the Amplify secret store (`npx ampx sandbox secret set
        // GOOGLE_CLIENT_ID` / Amplify console for branches). Never a literal.
        clientId: secret('GOOGLE_CLIENT_ID'),
        clientSecret: secret('GOOGLE_CLIENT_SECRET'),
        // `openid` + `email` are what Contract 1's `sub`/`email` claims need;
        // `profile` lets Cognito populate name attributes if ever wanted.
        scopes: ['openid', 'email', 'profile'],
        // Contract 1: Google's `email` claim becomes the Cognito `email` attribute.
        //
        // `givenName`/`familyName`/`emailVerified` added 2026-10-01, after the
        // first real sign-in showed a user record holding only `email`, `sub`
        // and the identity link. The `profile` scope above was already being
        // requested — Google was sending the name and Cognito was discarding
        // it, because a claim only reaches the user pool if it is mapped here.
        //
        // `emailVerified` matters beyond cosmetics: without it Cognito stores
        // `email_verified: false` for a Google account Google has already
        // verified, so any future flow that gates on a verified email would
        // refuse every user.
        //
        // Cognito refreshes mapped attributes on each federated sign-in, so
        // existing users backfill on their next login rather than needing a
        // migration.
        attributeMapping: {
          email: 'email',
          emailVerified: 'email_verified',
          givenName: 'given_name',
          familyName: 'family_name',
        },
      },
      // App-facing custom-URL-scheme redirects consumed by flutter-app-unit's
      // `services/auth_service.dart` (its Infrastructure Design obligation on
      // this Unit). Amplify adds the sandbox / hosted-UI defaults alongside.
      callbackUrls: ['sarovarjinalaya://callback/'],
      logoutUrls: ['sarovarjinalaya://signout/'],
    },
  },
  // BR1.2 / Contract 2: membership surfaces as the `cognito:groups` claim.
  groups: ['Admin'],
  userAttributes: {
    email: {
      required: true,
    },
    // `givenName` / `familyName` are deliberately NOT declared here.
    //
    // They are STANDARD Cognito attributes and already exist on every user
    // pool, so the `attributeMapping` above is all that is needed to populate
    // them. Declaring them in this block makes Amplify attempt a schema
    // change on the existing pool, which Cognito refuses with
    // "Invalid AttributeDataType input" and fails the whole auth stack.
    // Verified against a real deployment 2026-10-01.
    //
    // They are also left un-required on purpose: Google does not guarantee
    // `family_name` — a single-word account name sends `given_name` only — so
    // requiring it would make such an account unable to sign in at all.
  },
} satisfies AuthConfig;

export const auth = defineAuth(authConfig);
