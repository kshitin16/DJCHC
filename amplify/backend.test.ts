/**
 * auth-unit — tests for the Cognito policy that `amplify/backend.ts` applies to
 * the L1 User Pool / App Client resources.
 *
 * `amplify/backend.ts` itself cannot be imported here: `defineBackend` reads the
 * `amplify-backend-namespace` CDK context key, which only `ampx` supplies, so a
 * bare import throws `No context value present for amplify-backend-namespace
 * key` before any assertion can run. A `Template.fromStack` assertion over the
 * synthesized backend is therefore not available without reimplementing the
 * `ampx` bootstrap.
 *
 * The overrides consequently live in `./auth/token-policy` as `applyTokenPolicy`,
 * which `backend.ts` calls once. These tests drive that function against a stand-in
 * for the CFN resources and assert what it actually writes — so the claim that the
 * policy is APPLIED (not merely declared) rests on a runnable test, not on a
 * one-off synth.
 */
import {
  applyTokenPolicy,
  selfSignUpDisabled,
  tokenPolicy,
  type SelfSignUpPoolTarget,
  type TokenPolicyClientTarget,
} from './auth/token-policy';

/** A stand-in for the L1 `CfnUserPoolClient`, with nothing set yet. */
function emptyClient(): TokenPolicyClientTarget {
  return {};
}

/** A stand-in for the L1 `CfnUserPool`, with nothing set yet. */
function emptyPool(): SelfSignUpPoolTarget {
  return {};
}

describe('auth-unit: Cognito policy constants', () => {
  it('declares 60-minute access/ID tokens and a 30-day refresh token (BR1.3, NFR3.1)', () => {
    expect(tokenPolicy.accessTokenValidity).toBe(60);
    expect(tokenPolicy.idTokenValidity).toBe(60);
    expect(tokenPolicy.refreshTokenValidity).toBe(30);
    expect(tokenPolicy.tokenValidityUnits).toEqual({
      accessToken: 'minutes',
      idToken: 'minutes',
      refreshToken: 'days',
    });
  });

  it('disables email/password self-registration so Google federation is the only identity path (BR1.1, BR1.4)', () => {
    expect(selfSignUpDisabled).toBe(true);
  });
});

describe('auth-unit: applyTokenPolicy writes the policy onto the L1 resources', () => {
  it('sets the token lifetimes and their units on the App Client (BR1.3, NFR3.1)', () => {
    const client = emptyClient();

    applyTokenPolicy(client, emptyPool());

    expect(client.accessTokenValidity).toBe(60);
    expect(client.idTokenValidity).toBe(60);
    expect(client.refreshTokenValidity).toBe(30);
    expect(client.tokenValidityUnits).toEqual({
      accessToken: 'minutes',
      idToken: 'minutes',
      refreshToken: 'days',
    });
  });

  it('pins the App Client PUBLIC by setting generateSecret to false (NFR3.1)', () => {
    const client = emptyClient();

    applyTokenPolicy(client, emptyPool());

    expect(client.generateSecret).toBe(false);
  });

  it('refuses to proceed if the App Client would be issued a client secret (NFR3.1, NFR3.4)', () => {
    const client: TokenPolicyClientTarget = { generateSecret: true };

    expect(() => applyTokenPolicy(client, emptyPool())).toThrow(/must be PUBLIC/);
    // The lifetimes written before the guard are irrelevant: the throw aborts
    // synthesis, so no template is produced with a secret-bearing client.
  });

  it('turns off self-registration on the User Pool (BR1.1, BR1.4)', () => {
    const pool = emptyPool();

    applyTokenPolicy(emptyClient(), pool);

    expect(pool.adminCreateUserConfig).toEqual({ allowAdminCreateUserOnly: true });
  });

  it("merges into Amplify's existing adminCreateUserConfig rather than clobbering it", () => {
    const pool: SelfSignUpPoolTarget = {
      adminCreateUserConfig: {
        inviteMessageTemplate: { emailSubject: 'Welcome' },
      },
    };

    applyTokenPolicy(emptyClient(), pool);

    expect(pool.adminCreateUserConfig).toEqual({
      inviteMessageTemplate: { emailSubject: 'Welcome' },
      allowAdminCreateUserOnly: true,
    });
  });

  it('does not spread an unresolved CDK token into the merged config', () => {
    // A CFN property can hold an `IResolvable` instead of a plain bag; spreading
    // one would produce a meaningless object of its internal fields.
    const resolvable = {
      creationStack: [],
      resolve: () => ({ InviteMessageTemplate: {} }),
      toString: () => '${Token[TOKEN.1]}',
    } as unknown as NonNullable<SelfSignUpPoolTarget['adminCreateUserConfig']>;
    const pool: SelfSignUpPoolTarget = { adminCreateUserConfig: resolvable };

    applyTokenPolicy(emptyClient(), pool);

    expect(pool.adminCreateUserConfig).toEqual({ allowAdminCreateUserOnly: true });
  });
});
