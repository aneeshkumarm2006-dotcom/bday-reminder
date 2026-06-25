// Flat ESLint config for the backend (ESLint 9 + typescript-eslint).
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/', 'node_modules/'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.node,
      },
    },
    rules: {
      'no-console': 'warn',
      // Allow intentionally-unused args/vars prefixed with `_` (e.g. the 4th
      // `_next` an Express error handler must declare). Matches tsconfig's
      // noUnusedParameters behavior.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
    },
  },
  {
    // Test + QA glue code legitimately inspects untyped JSON response bodies, so
    // `any` is allowed here (not in src/). Console output stays a warning - the
    // scripts opt out per-file with their existing `eslint-disable no-console`.
    files: ['tests/**/*.ts', 'scripts/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
);
