/**
 * auth-unit — smoke-level configuration tests (walking-skeleton Bolt, team.md Q5).
 *
 * These assert the shape of the exported `authConfig` object, not deployed
 * Cognito behaviour. `@aws-amplify/backend` is NOT mocked: `defineAuth` runs at
 * import time but nothing is synthesized.
 */
import { authConfig } from './resource';

describe('auth-unit: authConfig (Cognito User Pool definition)', () => {
  const google = authConfig.loginWith.externalProviders.google;

  it('declares exactly one Cognito group, "Admin" (BR1.2, Contract 2)', () => {
    expect(authConfig.groups).toEqual(['Admin']);
  });

  it('references the Google client id/secret as secret() objects, never string literals (BR1.1, NFR3.4)', () => {
    expect(typeof google.clientId).not.toBe('string');
    expect(typeof google.clientSecret).not.toBe('string');
    expect(google.clientId).toEqual(expect.any(Object));
    expect(google.clientSecret).toEqual(expect.any(Object));
  });

  it('requests the openid and email scopes from Google (Contract 1 email claim)', () => {
    expect(google.scopes).toEqual(expect.arrayContaining(['openid', 'email']));
  });

  it('registers the app custom-URL-scheme callback and sign-out redirects (flutter-app-unit obligation)', () => {
    expect(authConfig.loginWith.externalProviders.callbackUrls).toContain(
      'sarovarjinalaya://callback/',
    );
    expect(authConfig.loginWith.externalProviders.logoutUrls).toContain(
      'sarovarjinalaya://signout/',
    );
  });

  it('maps the Google email claim onto the Cognito email attribute (Contract 1)', () => {
    expect(google.attributeMapping.email).toBe('email');
  });

  it('uses email as the single sign-in attribute with no phone login (security-design.md)', () => {
    expect(authConfig.loginWith.email).toBe(true);
    expect('phone' in authConfig.loginWith).toBe(false);
    expect(authConfig.userAttributes.email.required).toBe(true);
  });
});
