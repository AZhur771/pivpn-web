// @ts-check

import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import stylistic from '@stylistic/eslint-plugin'

export default tseslint.config(
  eslint.configs.recommended,
  stylistic.configs.customize({
    semi: true,
  }),
  tseslint.configs.strict,
  tseslint.configs.stylistic,
  {
    rules: {
      '@typescript-eslint/no-extraneous-class': 0,
    },
  },
  {
    ignores: ['www/', 'build/', 'eslint.config.mjs'],
  },
);
