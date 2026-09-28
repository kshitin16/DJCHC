/**
 * auth-unit — smoke-level tests for the Cognito policy constants that
 * `amplify/backend.ts` applies to the L1 User Pool / App Client resources.
 *
 * The constants live in `./auth/token-policy` so they can be asserted without
 * synthesizing the CDK backend (synthesis belongs to `ampx sandbox` / deploy).
 */
import { selfSignUpDisabled, tokenPolicy } from './auth/token-policy';

describe('auth-unit: Cognito policy applied by backend.ts', () => {
  it('sets 60-minute access/ID tokens and a 30-day refresh token (BR1.3, NFR3.1)', () => {
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
