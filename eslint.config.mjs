// @ts-check

import eslint from '@eslint/js';
import loveConfig from 'eslint-config-love';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  eslint.configs.recommended,
  loveConfig,
  tseslint.configs.strict,
  tseslint.configs.stylistic,
  {
    rules: {
      'eslint-comments/require-description': 0,
      '@typescript-eslint/no-extraneous-class': 0,
      '@typescript-eslint/no-unsafe-return': 0,
      '@typescript-eslint/require-await': 0,
      '@typescript-eslint/no-magic-numbers': 0,
      '@typescript-eslint/init-declarations': 0,
      '@typescript-eslint/strict-boolean-expressions': 0,
      '@typescript-eslint/use-unknown-in-catch-callback-variable': 0,
      '@typescript-eslint/no-unsafe-assignment': 0,
      '@typescript-eslint/prefer-destructuring': 0,
      '@typescript-eslint/class-methods-use-this': 0,
      '@typescript-eslint/no-unsafe-member-access': 0,
      '@typescript-eslint/no-unnecessary-condition': 0,
      'semi': 2,
    },
  },
  {
    ignores: ['www/', 'build/', 'eslint.config.mjs'],
  }
);
