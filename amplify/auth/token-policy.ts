/**
 * Token-lifetime and sign-up policy for the Cognito App Client / User Pool.
 *
 * Holds both the policy constants and `applyTokenPolicy()`, which writes them
 * to the L1 `CfnUserPoolClient` / `CfnUserPool` resources. `amplify/backend.ts`
 * calls that function rather than assigning the overrides inline, so the
 * application logic is unit-testable against a plain stand-in object without
 * synthesizing the backend. The only CDK import here is type-only (erased at
 * runtime), so nothing in this module needs the `ampx` CDK context to load —
 * which is what makes the tests runnable at all: importing `backend.ts` itself
 * fails outside `ampx`, because `defineBackend` reads CDK context keys only
 * that CLI sets.
 *
 * - BR1.3 / NFR3.1 / security-design.md "Token lifetime": 1-hour access and ID
 *   tokens, 30-day refresh token. The 1-hour access/ID lifetime bounds the
 *   admin-revocation exposure window: a removal from the `Admin` group is
 *   picked up at the next silent token refresh (<= 1 hour), not at the next
 *   full sign-in.
 * - Spoofing mitigation (NFR3.4): short-lived tokens limit the value of a
 *   stolen or replayed ID token.
 */
import type { CfnUserPool, CfnUserPoolClient } from 'aws-cdk-lib/aws-cognito';

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

/**
 * The subset of CDK's L1 `CfnUserPoolClient` that the token policy writes to.
 *
 * Declared as a `Pick` of the real CDK type (type-only import, erased at
 * runtime) so production code stays fully type-checked against CloudFormation's
 * own property types, while a test can pass a plain object standing in for the
 * construct.
 */
export type TokenPolicyClientTarget = Partial<
  Pick<
    CfnUserPoolClient,
    | 'accessTokenValidity'
    | 'idTokenValidity'
    | 'refreshTokenValidity'
    | 'tokenValidityUnits'
    | 'generateSecret'
  >
>;

/**
 * The subset of CDK's L1 `CfnUserPool` that the self-sign-up policy writes to.
 *
 * `Partial` because these are properties this module ASSIGNS; a caller (and a
 * test stub) need not have set them beforehand. The property VALUE types are
 * still CloudFormation's own, so a wrong-typed assignment is still an error.
 */
export type SelfSignUpPoolTarget = Partial<Pick<CfnUserPool, 'adminCreateUserConfig'>>;

/** True for a plain property bag, false for `undefined` or a CDK `IResolvable` token. */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !('resolve' in value && typeof (value as { resolve: unknown }).resolve === 'function')
  );
}

/**
 * Applies auth-unit's Cognito policy to the L1 resources Amplify created.
 *
 * `amplify/backend.ts` calls this once, immediately after `defineBackend`. The
 * work lives here rather than inline in `backend.ts` so it is reachable from a
 * unit test: `backend.ts` cannot be imported under Jest (importing it builds
 * and synthesizes the whole Amplify backend), so an assignment written there is
 * unverifiable by anything short of a deploy.
 *
 * What it does, and the rule each part realizes:
 *
 * - **Token lifetimes** (BR1.3 / NFR3.1): writes `tokenPolicy`'s 60 min access,
 *   60 min ID and 30 day refresh validities plus the matching
 *   `tokenValidityUnits`, so the <= 1-hour admin-revocation window does not
 *   depend on a Cognito or Amplify default.
 * - **PUBLIC App Client** (NFR3.1 / NFR3.4): throws if anything upstream ever
 *   turns on a client secret — a secret inside a distributed mobile binary is
 *   extractable, and the Flutter client is built for Authorization Code + PKCE
 *   — then pins `generateSecret` to `false`.
 * - **No self-registration** (BR1.1 / BR1.4): merges
 *   `allowAdminCreateUserOnly` into whatever `defineAuth` already placed on
 *   `adminCreateUserConfig` (e.g. the invite message template) rather than
 *   replacing it wholesale, so the email/password sign-up path that
 *   `loginWith.email` would otherwise open is closed without discarding
 *   Amplify's own configuration.
 *
 * @throws Error at synthesis time if the App Client would be issued a secret.
 */
export function applyTokenPolicy(
  cfnUserPoolClient: TokenPolicyClientTarget,
  cfnUserPool: SelfSignUpPoolTarget,
): void {
  // --- App Client: token lifetimes (BR1.3, NFR3.1) -------------------------
  cfnUserPoolClient.accessTokenValidity = tokenPolicy.accessTokenValidity;
  cfnUserPoolClient.idTokenValidity = tokenPolicy.idTokenValidity;
  cfnUserPoolClient.refreshTokenValidity = tokenPolicy.refreshTokenValidity;
  cfnUserPoolClient.tokenValidityUnits = tokenPolicy.tokenValidityUnits;

  // --- App Client: PUBLIC client, PKCE (NFR3.1) ----------------------------
  if (cfnUserPoolClient.generateSecret === true) {
    throw new Error(
      'auth-unit: the Cognito App Client must be PUBLIC (no client secret) for the ' +
        'Authorization Code + PKCE flow (NFR3.1); GenerateSecret was set to true.',
    );
  }
  cfnUserPoolClient.generateSecret = false;

  // --- User Pool: no self-registration (BR1.1, BR1.4) ----------------------
  const existingAdminCreateUserConfig = cfnUserPool.adminCreateUserConfig;
  cfnUserPool.adminCreateUserConfig = {
    ...(isPlainObject(existingAdminCreateUserConfig) ? existingAdminCreateUserConfig : {}),
    allowAdminCreateUserOnly: selfSignUpDisabled,
  };
}
