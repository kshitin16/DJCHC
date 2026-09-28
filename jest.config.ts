/**
 * Jest configuration for the Amplify Gen2 / TypeScript backend.
 *
 * ts-jest runs in ESM mode because the backend is `"type": "module"`; the test
 * scripts therefore set `NODE_OPTIONS=--experimental-vm-modules`.
 *
 * `coverageThreshold` was deliberately UNSET for the walking-skeleton Bolt
 * (team.md, Testing Posture Q5). donation-unit is the first Unit past the
 * skeleton, so the affirmed 80% line-coverage floor (team.md Q6) applies from
 * here on and is NEVER lowered afterwards — a step that cannot meet it is
 * reported as a gap, not hidden by weakening this number.
 *
 * Excluded from collection (declarative, no branching logic; exercised by
 * `ampx sandbox`, not Jest): `amplify/backend.ts` (CDK wiring) and every
 * `amplify/functions/<name>/resource.ts` (`defineFunction` declarations).
 *
 * feed-unit (U2) adds:
 * - `moduleNameMapper` for `@aws-appsync/utils`: the six AppSync JavaScript
 *   resolvers under `amplify/data/post-resolvers/` import that module, which
 *   only exists inside the APPSYNC_JS runtime. Under Jest it resolves to the
 *   in-repo double `amplify/data/test-support/appsync-utils-double.ts`.
 * - The resolver `.js` files are added to `collectCoverageFrom` (they are
 *   plain ES modules, not TypeScript) so their coverage counts toward the
 *   floor; the test double itself is excluded from collection.
 *
 * suggestion-unit (U3) adds `amplify/data/suggestion-resolvers/**\/*.js` to
 * `collectCoverageFrom` for the same reason (the `myPastSuggestions` resolver).
 */
import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^@aws-appsync/utils$': '<rootDir>/amplify/data/test-support/appsync-utils-double.ts',
  },
  testMatch: ['<rootDir>/amplify/**/*.test.ts'],
  testPathIgnorePatterns: ['/node_modules/', '/.amplify/', '/aidlc/', '/.claude/'],
  collectCoverageFrom: [
    'amplify/**/*.ts',
    'amplify/data/post-resolvers/**/*.js',
    'amplify/data/suggestion-resolvers/**/*.js',
    '!amplify/backend.ts',
    '!amplify/functions/*/resource.ts',
    '!amplify/data/test-support/**',
  ],
  coverageDirectory: 'coverage',
  coverageThreshold: {
    global: {
      lines: 80,
    },
  },
};

export default config;
