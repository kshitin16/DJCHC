/**
 * Token-lifetime and sign-up policy for the Cognito App Client / User Pool.
 *
 * Kept as plain constants (no CDK import) so they can be unit-tested without
 * synthesizing the backend; `amplify/backend.ts` applies them to the L1
 * `CfnUserPoolClient` / `CfnUserPool` resources.
 *
 * - BR1.3 / NFR3.1 / security-design.md "Token lifetime": 1-hour access and ID
 *   tokens, 30-day refresh token. The 1-hour access/ID lifetime bounds the
 *   admin-revocation exposure window: a removal from the `Admin` group is
 *   picked up at the next silent token refresh (<= 1 hour), not at the next
 *   full sign-in.
 * - Spoofing mitigation (NFR3.4): short-lived tokens limit the value of a
 *   stolen or replayed ID token.
 */
export const tokenPolicy = {
  /** Access-token lifetime, in `tokenValidityUnits.accessToken` (minutes). */
  accessTokenValidity: 60,
  /** ID-token lifetime, in `tokenValidityUnits.idToken` (minutes). */
  idTokenValidity: 60,
  /** Refresh-token lifetime, in `tokenValidityUnits.refreshToken` (days). */
  refreshTokenValidity: 30,
  tokenValidityUnits: {
    accessToken: 'minutes',
    idToken: 'minutes',
    refreshToken: 'days',
  },
} as const;

/**
 * BR1.1 / BR1.4: identity comes ONLY from Google federation. `defineAuth`
 * requires an email sign-in attribute on the pool, so self-registration with
 * email/password is switched off at the User Pool level
 * (`AdminCreateUserConfig.AllowAdminCreateUserOnly = true`). Google-federated
 * users are still created automatically by Cognito's federation flow — this
 * flag only closes the email/password path, so no first-sign-in special case
 * and no second identity path exist.
 */
export const selfSignUpDisabled = true;
