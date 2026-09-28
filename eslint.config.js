// ESLint flat config for the Amplify Gen2 / TypeScript backend.
// Affirmed pair (team.md, Code Style): typescript-eslint recommended + eslint-config-prettier
// (Prettier owns formatting; ESLint owns correctness rules only).
import { defineConfig, globalIgnores } from 'eslint/config';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default defineConfig([
  globalIgnores([
    'node_modules/',
    'coverage/',
    '.amplify/',
    'dist/',
    'aidlc/',
    '.claude/',
    'amplify_outputs*',
  ]),
  ...tseslint.configs.recommended,
  prettier,
]);
