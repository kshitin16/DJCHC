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
        attributeMapping: {
          email: 'email',
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
  },
} satisfies AuthConfig;

export const auth = defineAuth(authConfig);
